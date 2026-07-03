<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		getPathGeometry,
		getTransformedDrawingBBox,
		pointInBBox,
		pointNearPath,
		screenToDrawingCoords
	} from './utils/hitTest';
	import type { BBox, DrawingObject, Point } from './utils/hitTest';
	import { getCoalescedPointerEvents, isPenLikePointerEvent } from './utils/liveStroke';
	import { createObjectSpatialIndex } from './utils/spatialIndex';

	let {
		pageScale,
		brushSize,
		brushColor,
		allObjects,
		isPenMode = $bindable(false),
		batchDeleteObjects,
		onHighlightChange,
		onStrokeStart,
		onStrokeEnd,
		onStrokeCancel
	} = $props();

	let canvas: HTMLElement | undefined = $state();
	let path = '';
	let drawing = false;

	let cursorX = $state(0);
	let cursorY = $state(0);
	let showCursor = $state(false);
	let toDelete = $state(new Set<string>());
	let isTouchDevice = $state(false);

	let activeTouches = new Map();
	let activePointers = new Map();
	let isPenActive = false;
	let currentDrawingType: string | null = null;
	let canvasRect: DOMRect | null = null;
	let eraserFrame: number | null = null;
	let pendingEraserPoint: { clientX: number; clientY: number; mode: 'hover' | 'erase' } | null =
		null;
	let appliedHighlightedObjects = new Set<string>();
	let strokeNotified = false;
	let objectById = $derived.by(() => {
		const byId = new Map<string, any>();
		for (const object of allObjects || []) {
			if (object?.id) byId.set(String(object.id), object);
		}
		return byId;
	});
	let objectSpatialIndex = $derived.by(() => createObjectSpatialIndex(allObjects || []));

	type EraserGeometry = {
		key: string;
		points: Point[];
		pageBox: BBox;
	};

	const eraserGeometryCache = new Map<string, EraserGeometry>();

	onMount(() => {
		setupInputListeners();
	});

	onDestroy(() => {
		cleanupInputListeners();
	});

	function setupInputListeners() {
		if (!canvas) return;

		canvas.addEventListener('pointerdown', handlePointerdown);
		canvas.addEventListener('touchstart', handleTouchStart);
		canvas.addEventListener('pointermove', handlePointerHover);
		canvas.addEventListener('pointerleave', handlePointerLeave);
		window.addEventListener('pdf-editor-reset-pointer-locks', resetPointerLocks);
	}

	function cleanupInputListeners() {
		if (canvas) {
			canvas.removeEventListener('pointerdown', handlePointerdown);
			canvas.removeEventListener('touchstart', handleTouchStart);
			canvas.removeEventListener('pointermove', handlePointerHover);
			canvas.removeEventListener('pointerleave', handlePointerLeave);
		}

		window.removeEventListener('pointermove', handlePointermove);
		window.removeEventListener('pointerup', handlePointerup);
		window.removeEventListener('pointercancel', handlePointercancel);
		window.removeEventListener('touchmove', handleTouchmove);
		window.removeEventListener('touchend', handleTouchend);
		window.removeEventListener('touchcancel', handleTouchcancel);
		window.removeEventListener('pdf-editor-reset-pointer-locks', resetPointerLocks);
		cancelPendingEraserFrame();
		const wasDrawing = drawing;
		clearHighlightedObjects();
		if (wasDrawing) notifyStrokeCancel();
	}

	function resetPointerLocks() {
		window.removeEventListener('pointermove', handlePointermove);
		window.removeEventListener('pointerup', handlePointerup);
		window.removeEventListener('pointercancel', handlePointercancel);
		window.removeEventListener('touchmove', handleTouchmove);
		window.removeEventListener('touchend', handleTouchend);
		window.removeEventListener('touchcancel', handleTouchcancel);

		const wasDrawing = drawing;
		drawing = false;
		currentDrawingType = null;
		isPenActive = false;
		isTouchDevice = false;
		showCursor = false;
		canvasRect = null;
		activePointers.clear();
		activeTouches.clear();
		toDelete = new Set();
		cancelPendingEraserFrame();
		clearHighlightedObjects();
		if (wasDrawing) notifyStrokeCancel();
	}

	function notifyStrokeStart() {
		if (strokeNotified) return;
		strokeNotified = true;
		onStrokeStart?.();
	}

	function notifyStrokeEnd() {
		if (!strokeNotified) return;
		strokeNotified = false;
		onStrokeEnd?.();
	}

	function notifyStrokeCancel() {
		if (!strokeNotified) return;
		strokeNotified = false;
		onStrokeCancel?.();
	}

	function handlePointerdown(event: PointerEvent) {
		if (event.pointerType === 'touch') {
			if (isPenMode) {
				event.preventDefault();
				event.stopPropagation();
				if (currentDrawingType === 'touch') cancelErasing();
			}
			return;
		}

		const isPenPointer = isPenLikePointerEvent(event);
		activePointers.set(event.pointerId, {
			type: isPenPointer ? 'pen' : event.pointerType,
			x: event.clientX,
			y: event.clientY
		});

		if (isPenPointer) {
			isPenActive = true;
			isPenMode = true;
			currentDrawingType = 'pen';
			startErasing(event.clientX, event.clientY, event.target);
		} else if (event.pointerType === 'mouse' && !isPenMode) {
			if (activePointers.size === 1) {
				currentDrawingType = 'mouse';
				startErasing(event.clientX, event.clientY, event.target);
			}
		}

		window.addEventListener('pointermove', handlePointermove);
		window.addEventListener('pointerup', handlePointerup);
		window.addEventListener('pointercancel', handlePointercancel);
	}

	function handlePointermove(event: PointerEvent) {
		const activePointer = activePointers.get(event.pointerId);
		if (!activePointer) return;
		const isActivePen = activePointer.type === 'pen' || isPenLikePointerEvent(event);

		activePointers.set(event.pointerId, {
			...activePointer,
			x: event.clientX,
			y: event.clientY
		});

		if (
			(isActivePen && currentDrawingType === 'pen') ||
			(event.pointerType === 'mouse' &&
				currentDrawingType === 'mouse' &&
				activePointers.size === 1 &&
				!isPenMode)
		) {
			const events = getCoalescedPointerEvents(event);
			const latestEvent = events[events.length - 1] || event;
			continueErasing(latestEvent.clientX, latestEvent.clientY);
		}
	}

	function handlePointerup(event: PointerEvent) {
		const activePointer = activePointers.get(event.pointerId);
		const isActivePen = activePointer?.type === 'pen' || isPenLikePointerEvent(event);
		activePointers.delete(event.pointerId);

		if (isActivePen && currentDrawingType === 'pen') {
			isPenActive = false;
			currentDrawingType = null;
			endErasing();
		} else if (
			event.pointerType === 'mouse' &&
			currentDrawingType === 'mouse' &&
			activePointers.size === 0 &&
			!isPenMode
		) {
			currentDrawingType = null;
			endErasing();
		}

		if (activePointers.size === 0) {
			window.removeEventListener('pointermove', handlePointermove);
			window.removeEventListener('pointerup', handlePointerup);
			window.removeEventListener('pointercancel', handlePointercancel);
		}
	}

	function handlePointercancel(event: PointerEvent) {
		activePointers.delete(event.pointerId);

		if (activePointers.size === 0) {
			cancelErasing();
			window.removeEventListener('pointermove', handlePointermove);
			window.removeEventListener('pointerup', handlePointerup);
			window.removeEventListener('pointercancel', handlePointercancel);
		}
	}

	function handleTouchStart(event: TouchEvent) {
		if (isPenMode) {
			event.preventDefault();
			event.stopPropagation();
			if (currentDrawingType === 'touch') cancelErasing();
			return;
		}

		if (event.touches.length > 1) {
			if (currentDrawingType === 'touch') cancelErasing();
			return;
		}

		for (const touch of event.touches) {
			activeTouches.set(touch.identifier, {
				x: touch.clientX,
				y: touch.clientY
			});
		}

		if (!isPenActive) {
			const touch = event.touches[0];
			currentDrawingType = 'touch';
			startErasing(touch.clientX, touch.clientY, touch.target);
		}

		window.addEventListener('touchmove', handleTouchmove, { passive: false });
		window.addEventListener('touchend', handleTouchend);
		window.addEventListener('touchcancel', handleTouchcancel);
	}

	function handleTouchmove(event: TouchEvent) {
		if (isPenMode) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}

		if (event.touches.length > 1) {
			if (currentDrawingType === 'touch') cancelErasing();
			return;
		}

		event.preventDefault();

		for (const touch of event.touches) {
			activeTouches.set(touch.identifier, {
				x: touch.clientX,
				y: touch.clientY
			});
		}

		if (!isPenActive && currentDrawingType === 'touch') {
			const touch = event.touches[0];
			continueErasing(touch.clientX, touch.clientY);
		}
	}

	function handleTouchend(event: TouchEvent) {
		if (isPenMode) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}

		for (const touch of event.changedTouches) {
			activeTouches.delete(touch.identifier);
		}

		if (activeTouches.size === 0 && currentDrawingType === 'touch') {
			currentDrawingType = null;
			endErasing();
		}

		if (activeTouches.size === 0) {
			window.removeEventListener('touchmove', handleTouchmove);
			window.removeEventListener('touchend', handleTouchend);
			window.removeEventListener('touchcancel', handleTouchcancel);
		}
	}

	function handleTouchcancel() {
		resetPointerLocks();
	}

	function handlePointerHover(event: PointerEvent) {
		if (!canvas || drawing) return;
		if (event.pointerType === 'touch') return;
		if (isPenMode && event.pointerType !== 'pen') return;

		if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
			showCursor = true;
		}

		scheduleEraserPoint(event.clientX, event.clientY, 'hover');
	}

	function handlePointerLeave() {
		showCursor = false;
		canvasRect = null;
		cancelPendingEraserFrame();
		clearHighlightedObjects();
	}

	function startErasing(clientX: number, clientY: number, target: EventTarget | null) {
		if (target !== canvas) {
			drawing = false;
			return;
		}

		cancelPendingEraserFrame();
		drawing = true;
		notifyStrokeStart();
		toDelete = new Set();
		isTouchDevice = currentDrawingType === 'touch';
		showCursor = true;
		canvasRect = canvas?.getBoundingClientRect() || null;

		processEraserPoint(clientX, clientY, 'erase');
	}

	function continueErasing(clientX: number, clientY: number) {
		scheduleEraserPoint(clientX, clientY, 'erase');
	}

	function endErasing() {
		flushPendingEraserPoint();
		drawing = false;

		const objectIdsToDelete = Array.from(toDelete);
		toDelete = new Set();
		// Clear transient eraser state before deletion so undo history restores clean objects.
		clearHighlightedObjects();

		if (objectIdsToDelete.length > 0) {
			batchDeleteObjects(objectIdsToDelete);
		}

		if (isTouchDevice) {
			showCursor = false;
		}

		canvasRect = null;
		finish();
		notifyStrokeEnd();
	}

	function cancelErasing() {
		if (!drawing) return;

		drawing = false;
		toDelete = new Set();
		showCursor = false;
		currentDrawingType = null;
		canvasRect = null;
		cancelPendingEraserFrame();
		clearHighlightedObjects();
		notifyStrokeCancel();
	}

	function getCanvasRect() {
		if (!canvas) return null;
		canvasRect ||= canvas.getBoundingClientRect();
		return canvasRect;
	}

	function scheduleEraserPoint(clientX: number, clientY: number, mode: 'hover' | 'erase') {
		pendingEraserPoint = { clientX, clientY, mode };

		if (eraserFrame !== null) return;

		eraserFrame = requestAnimationFrame(() => {
			eraserFrame = null;
			flushPendingEraserPoint();
		});
	}

	function flushPendingEraserPoint() {
		if (eraserFrame !== null) {
			cancelAnimationFrame(eraserFrame);
			eraserFrame = null;
		}

		if (!pendingEraserPoint) return;

		const point = pendingEraserPoint;
		pendingEraserPoint = null;
		processEraserPoint(point.clientX, point.clientY, point.mode);
	}

	function cancelPendingEraserFrame() {
		if (eraserFrame !== null) {
			cancelAnimationFrame(eraserFrame);
			eraserFrame = null;
		}

		pendingEraserPoint = null;
	}

	function processEraserPoint(clientX: number, clientY: number, mode: 'hover' | 'erase') {
		const rect = getCanvasRect();
		if (!rect) return;

		cursorX = clientX - rect.left;
		cursorY = clientY - rect.top;

		const pageX = cursorX / pageScale;
		const pageY = cursorY / pageScale;

		if (mode === 'erase') {
			markObjectsForDeletion(pageX, pageY);
		} else {
			updateHighlightedObjects(pageX, pageY);
		}
	}

	function updateHighlightedObjects(x: number, y: number) {
		applyHighlightedObjects(new Set(detectObjectsInEraserRadius(x, y)));
	}

	function markObjectsForDeletion(x: number, y: number) {
		const objectsInRadius = detectObjectsInEraserRadius(x, y);

		for (const id of objectsInRadius) {
			toDelete.add(id);
		}

		applyHighlightedObjects(new Set(toDelete));
	}

	function finish() {}

	function getObjectCacheKey(drawing: any) {
		return [
			drawing.path,
			drawing.x || 0,
			drawing.y || 0,
			drawing.brushSize || 1,
			drawing.width || 0,
			drawing.originWidth || 0,
			drawing.originHeight || 0,
			drawing.scale || 1,
			drawing.rotation || 0
		].join('|');
	}

	function getDrawingScale(drawing: any) {
		const scale =
			drawing.scale ??
			(drawing.originWidth ? (drawing.width || drawing.originWidth) / drawing.originWidth : 1);

		return Number.isFinite(scale) && scale !== 0 ? scale : 1;
	}

	function toDrawingObject(drawing: any): DrawingObject {
		return {
			...drawing,
			x: Number(drawing.x || 0),
			y: Number(drawing.y || 0),
			width: Number(drawing.width || drawing.originWidth || 1),
			originWidth: Number(drawing.originWidth || drawing.width || 1),
			originHeight: Number(drawing.originHeight || drawing.height || 1),
			scale: getDrawingScale(drawing),
			rotation: Number(drawing.rotation || 0),
			path: drawing.path || ''
		};
	}

	function getEraserGeometry(drawing: any): EraserGeometry | null {
		if (!drawing?.id || !drawing?.path) return null;

		const drawingId = String(drawing.id);
		const key = getObjectCacheKey(drawing);
		const cached = eraserGeometryCache.get(drawingId);
		if (cached?.key === key) return cached;

		const { points, bbox: pathBox } = getPathGeometry(drawing.path);
		if (!pathBox || points.length === 0) return null;

		const drawingObject = toDrawingObject(drawing);
		const scale = getDrawingScale(drawingObject);
		const transformedBox = getTransformedDrawingBBox(
			drawingObject,
			pathBox,
			scale,
			Number(drawingObject.rotation || 0)
		);
		const strokePadding = Math.max(((drawing.brushSize || 1) * Math.abs(scale)) / 2, 1);
		const pageBox = {
			x: transformedBox.x - strokePadding,
			y: transformedBox.y - strokePadding,
			width: transformedBox.width + strokePadding * 2,
			height: transformedBox.height + strokePadding * 2
		};
		const geometry = { key, points, pageBox };

		eraserGeometryCache.set(drawingId, geometry);
		return geometry;
	}

	function detectObjectsInEraserRadius(x: number, y: number) {
		const objectsToErase: string[] = [];
		const eraserPoint: Point = { x, y };
		const candidates = objectSpatialIndex.queryPoint(
			x,
			y,
			brushSize + 4 / Math.max(pageScale || 1, 0.1)
		);

		for (const drawing of candidates) {
			if (drawing.type === 'text') continue;
			if (drawing.type === 'line') continue;

			const geometry = getEraserGeometry(drawing);
			if (!geometry) continue;

			if (!pointInBBox(eraserPoint, geometry.pageBox, brushSize)) continue;

			const drawingObject = toDrawingObject(drawing);
			const scale = Math.max(Math.abs(getDrawingScale(drawingObject)), 0.1);
			const localPoint = screenToDrawingCoords(eraserPoint, drawingObject, pageScale);
			const eraserRadiusInLocalSpace = brushSize / scale;
			const strokeRadiusInLocalSpace = Math.max((drawing.brushSize || 1) / 2, 1);

			if (
				pointNearPath(
					localPoint,
					geometry.points,
					eraserRadiusInLocalSpace + strokeRadiusInLocalSpace
				)
			) {
				objectsToErase.push(drawing.id);
			}
		}

		return objectsToErase;
	}

	function setObjectEraserHighlight(id: string, shouldHighlight: boolean) {
		const obj = objectById.get(id);
		if (
			(obj?.type === 'drawing' || obj?.type === 'highlight') &&
			obj._eraserHighlight !== shouldHighlight
		) {
			obj._eraserHighlight = shouldHighlight;
			return true;
		}

		return false;
	}

	function applyHighlightedObjects(nextHighlightedObjects: Set<string>) {
		let changed = false;

		for (const id of appliedHighlightedObjects) {
			if (!nextHighlightedObjects.has(id)) {
				changed = setObjectEraserHighlight(id, false) || changed;
			}
		}

		for (const id of nextHighlightedObjects) {
			if (!appliedHighlightedObjects.has(id)) {
				changed = setObjectEraserHighlight(id, true) || changed;
			}
		}

		appliedHighlightedObjects = new Set(nextHighlightedObjects);

		if (changed) {
			onHighlightChange?.();
		}
	}

	function clearHighlightedObjects() {
		applyHighlightedObjects(new Set());
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={canvas}
	class="absolute top-0 left-0 h-full w-full select-none"
	style="cursor: crosshair;"
>
	<!-- Eraser cursor circle preview -->
	{#if showCursor}
		<div
			class="pointer-events-none absolute"
			style="
				left: {cursorX}px;
				top: {cursorY}px;
				width: {brushSize * 2 * pageScale}px;
				height: {brushSize * 2 * pageScale}px;
				transform: translate(-50%, -50%);
				border: 2px solid rgba(239, 68, 68, 0.8);
				border-radius: 50%;
				background-color: rgba(239, 68, 68, 0.1);
			"
		></div>
	{/if}

	<svg class="pointer-events-none h-full w-full">
		<path
			stroke-width={brushSize}
			stroke-linejoin="round"
			stroke-linecap="round"
			d={path}
			stroke={brushColor}
			fill="none"
		/>
	</svg>
</div>
