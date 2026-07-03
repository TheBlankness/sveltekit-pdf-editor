<script>
	import { onMount, onDestroy } from 'svelte';
	import {
		hitTestDrawingWithBox,
		findDrawingsAtPoint,
		lineIntersectsBox
	} from './utils/hitTest';
	import { createObjectSpatialIndex } from './utils/spatialIndex';

	let {
		isDraggingSelection,
		pageScale,
		allObjects,
		selectedObjectIds = $bindable([]),
		onSelectionChange,
		onLassoComplete,
		onSelectionActiveChange,
		onTextDoubleClick,
		onLineDoubleClick,
		allowTeacherMark = false,
		isPenMode = $bindable(false)
	} = $props();

	let canvas = $state();
	let isSelecting = $state(false);
	let selectionBox = $state({ x: 0, y: 0, width: 0, height: 0 });
	let startPoint = { x: 0, y: 0 };
	let activeCanvasRect = null;
	let pendingSelectionBox = null;
	let selectionFrame = null;
	let objectById = $derived.by(() => {
		const byId = new Map();
		for (const object of allObjects || []) {
			if (object?.id) byId.set(String(object.id), object);
		}
		return byId;
	});
	let objectSpatialIndex = $derived.by(() => createObjectSpatialIndex(allObjects || []));
	let selectedObjectIdSet = $derived.by(() => new Set(selectedObjectIds));

	// Click tracking state for custom double-click detection
	let lastClickedItemId = $state(null);
	let lastClickTime = $state(0);
	let lastClickPosition = $state({ x: 0, y: 0 });
	const DOUBLE_CLICK_TIME_THRESHOLD = 400; // milliseconds
	const DOUBLE_CLICK_POSITION_THRESHOLD = 15; // pixels

	function getObjectById(id) {
		return id ? objectById.get(id) : undefined;
	}

	function isSelectedObjectId(id) {
		return id ? selectedObjectIdSet.has(id) : false;
	}

	function findObjectsAtPoint(point) {
		const candidates = objectSpatialIndex.queryPoint(
			point.x,
			point.y,
			6 / Math.max(pageScale || 1, 0.1)
		);
		return findDrawingsAtPoint(point, allObjects, pageScale, candidates);
	}

	onMount(() => {
		window.addEventListener('pdf-editor-reset-pointer-locks', resetPointerLocks);
	});

	onDestroy(() => {
		window.removeEventListener('pdf-editor-reset-pointer-locks', resetPointerLocks);
		cancelSelectionFrame();
	});

	// Custom pannable action that respects isPenMode
	function selectionPannable(node) {
		let startX, startY;
		let isActive = false;
		let shouldHandle = false; // Track if we should handle this interaction

		function getEventCoords(event) {
			if (event.touches && event.touches.length > 0) {
				return { x: event.touches[0].clientX, y: event.touches[0].clientY };
			} else if (event.changedTouches && event.changedTouches.length > 0) {
				return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
			} else {
				return { x: event.clientX, y: event.clientY };
			}
		}

		function isPenEvent(event) {
			return (
				event.pointerType === 'pen' ||
				(event.touches && event.touches[0] && event.touches[0].touchType === 'stylus')
			);
		}

		function isMultiTouchEvent(event) {
			return event.touches && event.touches.length > 1;
		}

		function isTouchPointerEvent(event) {
			return event.type.startsWith('pointer') && event.pointerType === 'touch';
		}

		function cancelActiveSelection() {
			if (!isActive) return;

			isActive = false;
			shouldHandle = false;
			node.dispatchEvent(new CustomEvent('selectioncancel'));
		}

		function shouldHandleEvent(coords) {
			// Check if clicking on a selected object - if so, don't handle (allow dragging)
			if (isDraggingSelection) return false;

			const canvasRect = canvas?.getBoundingClientRect();
			if (!canvasRect) return true;

			const x = (coords.x - canvasRect.left) / pageScale;
			const y = (coords.y - canvasRect.top) / pageScale;
			const clickPoint = { x, y };

			// Use the same hit testing logic as the main editor
			const hitObjectIds = findObjectsAtPoint(clickPoint);
			const topHitObject = getObjectById(hitObjectIds[hitObjectIds.length - 1]);
			if (topHitObject?.type === 'teacher-mark' && !allowTeacherMark) {
				return false;
			}

			// Check if any hit object is selected
			for (const hitId of hitObjectIds) {
				if (isSelectedObjectId(hitId)) {
					const obj = getObjectById(hitId);
					// Text objects should NOT be draggable - only editable via double-click
					if (obj && obj.type === 'text') {
						continue; // Skip text objects
					}
					// For drawings and lines, allow dragging
					return false;
				}
			}
			return true;
		}

		function handleStart(event) {
			if (isTouchPointerEvent(event)) return;

			if (isMultiTouchEvent(event)) {
				cancelActiveSelection();
				return;
			}

			// Prevent default for touch events if in pen mode (to avoid passive listener warning)
			if (isPenMode && !isPenEvent(event)) {
				if (event.type === 'touchstart') {
					event.preventDefault();
				}
				return;
			}
			if (isPenEvent(event)) isPenMode = true;

			const coords = getEventCoords(event);
			shouldHandle = shouldHandleEvent(coords);

			if (!shouldHandle) {
				// For touch events and non-mouse pointer events, prevent default to stop parent panning
				// For mouse pointer events, let them bubble to PDFPage handlers
				const isMousePointer = event.type === 'pointerdown' && event.pointerType === 'mouse';
				const isMouseEvent = event.type === 'mousedown';

				if (!isMousePointer && !isMouseEvent) {
					event.preventDefault();
				}
				return;
			}

			// Check if clicking on text - don't prevent default to allow double-click
			const canvasRect = canvas?.getBoundingClientRect();
			if (canvasRect) {
				const x = (coords.x - canvasRect.left) / pageScale;
				const y = (coords.y - canvasRect.top) / pageScale;
				const clickPoint = { x, y };
				const hitObjectIds = findObjectsAtPoint(clickPoint);

				const clickedOnText = hitObjectIds.some((id) => {
					const obj = getObjectById(id);
					return obj && obj.type === 'text';
				});

				if (clickedOnText) {
					// Don't prevent default or start selection - allow double-click to work
					return;
				}
			}

			event.preventDefault();
			isActive = true;
			startX = coords.x;
			startY = coords.y;

			node.dispatchEvent(
				new CustomEvent('selectionstart', {
					detail: { x: coords.x, y: coords.y, target: event.target }
				})
			);
		}

		function handleMove(event) {
			if (isTouchPointerEvent(event)) return;

			if (isMultiTouchEvent(event)) {
				cancelActiveSelection();
				return;
			}

			// If we're dragging selected objects, prevent parent panning but let PDFPage handle it
			if (isDraggingSelection) {
				// Only prevent default for touch events and non-mouse pointer events
				const isMousePointer = event.type === 'pointermove' && event.pointerType === 'mouse';
				const isMouseEvent = event.type === 'mousemove';

				if (!isMousePointer && !isMouseEvent) {
					event.preventDefault();
				}
				return;
			}

			if (!isActive) return;

			// Prevent default for touch events if in pen mode (to avoid passive listener warning)
			if (isPenMode && !isPenEvent(event)) {
				if (event.type === 'touchmove') {
					event.preventDefault();
				}
				return;
			}

			event.preventDefault();
			const coords = getEventCoords(event);

			node.dispatchEvent(
				new CustomEvent('selectionmove', {
					detail: {
						x: coords.x,
						y: coords.y,
						dx: coords.x - startX,
						dy: coords.y - startY
					}
				})
			);
		}

		function handleEnd(event) {
			if (isTouchPointerEvent(event)) return;

			// If we're dragging selected objects, prevent parent panning but let PDFPage handle it
			if (isDraggingSelection) {
				// Only prevent default for touch events and non-mouse pointer events
				const isMousePointer =
					(event.type === 'pointerup' || event.type === 'pointercancel') &&
					event.pointerType === 'mouse';
				const isMouseEvent = event.type === 'mouseup' || event.type === 'mouseleave';

				if (!isMousePointer && !isMouseEvent) {
					event.preventDefault();
				}
				return;
			}

			if (!isActive) return;

			// Prevent default for touch events if in pen mode (to avoid passive listener warning)
			if (isPenMode && !isPenEvent(event)) {
				if (event.type === 'touchend' || event.type === 'touchcancel') {
					event.preventDefault();
				}
				return;
			}

			event.preventDefault();
			isActive = false;
			shouldHandle = false;
			const coords = getEventCoords(event);

			node.dispatchEvent(
				new CustomEvent('selectionend', {
					detail: { x: coords.x, y: coords.y }
				})
			);
		}

		node.addEventListener('pointerdown', handleStart);
		node.addEventListener('pointermove', handleMove);
		node.addEventListener('pointerup', handleEnd);
		node.addEventListener('pointercancel', handleEnd);

		node.addEventListener('touchstart', handleStart, { passive: false });
		node.addEventListener('touchmove', handleMove, { passive: false });
		node.addEventListener('touchend', handleEnd, { passive: false });
		node.addEventListener('touchcancel', handleEnd, { passive: false });

		node.addEventListener('mousedown', handleStart);
		node.addEventListener('mousemove', handleMove);
		node.addEventListener('mouseup', handleEnd);
		node.addEventListener('mouseleave', handleEnd);
		window.addEventListener('pdf-editor-reset-pointer-locks', cancelActiveSelection);

		return {
			destroy() {
				node.removeEventListener('pointerdown', handleStart);
				node.removeEventListener('pointermove', handleMove);
				node.removeEventListener('pointerup', handleEnd);
				node.removeEventListener('pointercancel', handleEnd);

				node.removeEventListener('touchstart', handleStart);
				node.removeEventListener('touchmove', handleMove);
				node.removeEventListener('touchend', handleEnd);
				node.removeEventListener('touchcancel', handleEnd);

				node.removeEventListener('mousedown', handleStart);
				node.removeEventListener('mousemove', handleMove);
				node.removeEventListener('mouseup', handleEnd);
				node.removeEventListener('mouseleave', handleEnd);
				window.removeEventListener('pdf-editor-reset-pointer-locks', cancelActiveSelection);
			}
		};
	}

	function resetPointerLocks() {
		isSelecting = false;
		onSelectionActiveChange?.(false);
		cancelSelectionFrame();
		activeCanvasRect = null;
		pendingSelectionBox = null;
		selectionBox = { x: 0, y: 0, width: 0, height: 0 };
		lastClickedItemId = null;
		lastClickTime = 0;
		lastClickPosition = { x: 0, y: 0 };
	}

	function cancelSelectionFrame() {
		if (selectionFrame === null || typeof cancelAnimationFrame === 'undefined') return;

		cancelAnimationFrame(selectionFrame);
		selectionFrame = null;
	}

	function areIdArraysEqual(a = [], b = []) {
		if (a.length !== b.length) return false;

		for (let index = 0; index < a.length; index += 1) {
			if (a[index] !== b[index]) return false;
		}

		return true;
	}

	function applySelectionBox(box) {
		pendingSelectionBox = null;
		selectionBox = box;
		updateSelection(box);
	}

	function scheduleSelectionUpdate(box) {
		pendingSelectionBox = box;

		if (typeof requestAnimationFrame === 'undefined') {
			applySelectionBox(box);
			return;
		}

		if (selectionFrame !== null) return;

		selectionFrame = requestAnimationFrame(() => {
			selectionFrame = null;
			if (!pendingSelectionBox || !isSelecting) return;
			applySelectionBox(pendingSelectionBox);
		});
	}

	function flushSelectionUpdate() {
		if (selectionFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
			cancelAnimationFrame(selectionFrame);
			selectionFrame = null;
		}

		if (pendingSelectionBox) {
			applySelectionBox(pendingSelectionBox);
			return;
		}

		updateSelection(selectionBox);
	}

	function handleSelectionStart(event) {
		if (event.detail.target !== canvas) return;

		// Don't start lasso selection if we're already dragging selected objects
		if (isDraggingSelection) return;

		activeCanvasRect = canvas?.getBoundingClientRect();
		if (!activeCanvasRect) return;

		const x = (event.detail.x - activeCanvasRect.left) / pageScale;
		const y = (event.detail.y - activeCanvasRect.top) / pageScale;

		isSelecting = true;
		onSelectionActiveChange?.(true);
		startPoint = { x, y };
		pendingSelectionBox = null;
		selectionBox = { x, y, width: 0, height: 0 };
	}

	function handleSelectionMove(event) {
		if (!isSelecting) return;

		const canvasRect = activeCanvasRect || canvas?.getBoundingClientRect();
		if (!canvasRect) return;
		activeCanvasRect = canvasRect;

		const currentX = (event.detail.x - canvasRect.left) / pageScale;
		const currentY = (event.detail.y - canvasRect.top) / pageScale;

		// Calculate selection box
		const minX = Math.min(startPoint.x, currentX);
		const minY = Math.min(startPoint.y, currentY);
		const maxX = Math.max(startPoint.x, currentX);
		const maxY = Math.max(startPoint.y, currentY);

		const nextSelectionBox = {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY
		};

		scheduleSelectionUpdate(nextSelectionBox);
	}

	function handleSelectionEnd() {
		flushSelectionUpdate();
		const wasLassoSelection = isSelecting && (selectionBox.width > 5 || selectionBox.height > 5);

		isSelecting = false;
		onSelectionActiveChange?.(false);
		activeCanvasRect = null;

		// Notify parent that lasso selection completed
		if (wasLassoSelection && onLassoComplete) {
			onLassoComplete();
		}

		// Don't reset selection box immediately - keep it visible
	}

	function handleSelectionCancel() {
		isSelecting = false;
		onSelectionActiveChange?.(false);
		cancelSelectionFrame();
		activeCanvasRect = null;
		pendingSelectionBox = null;
		selectionBox = { x: 0, y: 0, width: 0, height: 0 };
	}

	function updateSelection(box = selectionBox) {
		const selected = [];
		const candidates = objectSpatialIndex.queryBox(
			box,
			6 / Math.max(pageScale || 1, 0.1)
		);

		for (const obj of candidates) {
			if (isSelectableObject(obj) && isObjectInSelectionBox(obj, box)) {
				selected.push(obj.id);
			}
		}

		if (areIdArraysEqual(selectedObjectIds, selected)) return;

		selectedObjectIds = selected;
		if (onSelectionChange) {
			onSelectionChange(selected);
		}
	}

	function isSelectableObject(obj) {
		return obj && (allowTeacherMark || obj.type !== 'teacher-mark');
	}

	function isObjectInSelectionBox(obj, box) {
		// Handle different object types
		if (obj.type === 'text') {
			// Use text bounding box instead of just anchor point for more accurate selection
			const textBox = {
				x: obj.x,
				y: obj.y,
				width: obj.width || 100, // Use actual width or default
				height: (obj.lines?.length || 1) * (obj.size || 16) * (obj.lineHeight || 1.2)
			};
			return boxesIntersect(textBox, box);
		} else if (obj.type === 'drawing' || obj.type === 'highlight') {
			// Use mathematical hit-testing for precise selection
			return hitTestDrawingWithBox(box, obj);
		} else if (obj.type === 'line') {
			// Use geometric line-to-box intersection detection
			// Line is defined by start point (x, y) and end point (x + width, y + height)
			return lineIntersectsBox(obj.x, obj.y, obj.width, obj.height, box, obj.strokeWidth || 2);
		} else if (obj.type === 'teacher-mark') {
			const markBox = {
				x: obj.x,
				y: obj.y,
				width: obj.width || 60,
				height: obj.height || 40
			};
			return boxesIntersect(markBox, box);
		}
		return false;
	}

	function boxesIntersect(box1, box2) {
		return !(
			box1.x + box1.width < box2.x ||
			box2.x + box2.width < box1.x ||
			box1.y + box1.height < box2.y ||
			box2.y + box2.height < box1.y
		);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	bind:this={canvas}
	use:selectionPannable
	onselectionstart={handleSelectionStart}
	onselectionmove={handleSelectionMove}
	onselectionend={handleSelectionEnd}
	onselectioncancel={handleSelectionCancel}
	onclick={(e) => {
		// Custom double-click detection for text and line objects
		const canvasRect = canvas?.getBoundingClientRect();
		if (!canvasRect) return;

		const x = (e.clientX - canvasRect.left) / pageScale;
		const y = (e.clientY - canvasRect.top) / pageScale;
		const clickPoint = { x, y };

		const hitObjectIds = findObjectsAtPoint(clickPoint);
		const topHitObject = getObjectById(hitObjectIds[hitObjectIds.length - 1]);
		if (topHitObject?.type === 'teacher-mark' && !allowTeacherMark) {
			lastClickedItemId = null;
			lastClickTime = 0;
			lastClickPosition = { x: 0, y: 0 };
			return;
		}

		// Find what type of object was clicked (prioritize text over line)
		let clickedObject = null;
		let clickedType = null;

		for (const hitId of hitObjectIds) {
			const obj = getObjectById(hitId);
			if (!isSelectableObject(obj)) {
				continue;
			}
			if (obj && obj.type === 'text') {
				clickedObject = obj;
				clickedType = 'text';
				break;
			} else if (obj && obj.type === 'line' && !clickedObject) {
				clickedObject = obj;
				clickedType = 'line';
			}
		}

		if (clickedObject) {
			const currentTime = Date.now();
			const timeDiff = currentTime - lastClickTime;
			const distance = Math.sqrt((x - lastClickPosition.x) ** 2 + (y - lastClickPosition.y) ** 2);

			// Check if this is a double-click: same item, within time threshold, within position threshold
			const isSameItem = lastClickedItemId === clickedObject.id;
			const isWithinTimeThreshold = timeDiff <= DOUBLE_CLICK_TIME_THRESHOLD;
			const isWithinPositionThreshold = distance <= DOUBLE_CLICK_POSITION_THRESHOLD;

			if (isSameItem && isWithinTimeThreshold && isWithinPositionThreshold) {
				// Trigger appropriate double-click handler
				if (clickedType === 'text' && onTextDoubleClick) {
					onTextDoubleClick(clickedObject.id);
				} else if (clickedType === 'line' && onLineDoubleClick) {
					onLineDoubleClick(clickedObject.id);
				}
			}

			// Update tracking state
			lastClickedItemId = clickedObject.id;
			lastClickTime = currentTime;
			lastClickPosition = { x, y };
		} else {
			// Reset tracking state if no relevant object was clicked
			lastClickedItemId = null;
			lastClickTime = 0;
			lastClickPosition = { x: 0, y: 0 };
		}
	}}
	class="absolute top-0 left-0 h-full w-full select-none"
	style="cursor: cursor; pointer-events: auto;"
>
	<!-- Selection box visualization -->
	{#if isSelecting && selectionBox.width > 0 && selectionBox.height > 0}
		<div
			class="pointer-events-none absolute"
			style="
				left: {selectionBox.x * pageScale}px;
				top: {selectionBox.y * pageScale}px;
				width: {selectionBox.width * pageScale}px;
				height: {selectionBox.height * pageScale}px;
				border: 2px solid rgba(59, 130, 246, 0.8);
				background-color: rgba(59, 130, 246, 0.1);
			"
		></div>
	{/if}
</div>
