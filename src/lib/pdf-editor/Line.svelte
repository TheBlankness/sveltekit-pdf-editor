<script lang="ts">
	import { onMount } from 'svelte';

	let {
		originWidth,
		originHeight,
		x,
		y,
		shapeWidth = $bindable(),
		shapeHeight = $bindable(),
		strokeColor,
		strokeWidth,
		lineType = 'solid',
		object,
		user,
		pageScale,
		isPenMode = $bindable(false),
		isAddingLine = false,
		isSelected,
		isObjectSelected,
		isPreviewed = false,
		onSelect,
		onUpdate,
		onDelete
	} = $props();

	let lineElement: HTMLElement | undefined = $state();
	let isResizing = $state(false);
	let activeResizePoint: string | null = $state(null);
	let resizeStart = { x: 0, y: 0, shapeX: 0, shapeY: 0, width: 0, height: 0 };

	// Selection state is computed from parent's selectedShapeId
	let selected = $derived(isSelected ?? false);

	// Pen mode detection function
	function isPenEvent(event: MouseEvent | TouchEvent | PointerEvent): boolean {
		if ('pointerType' in event) {
			return event.pointerType === 'pen';
		}
		if ('touches' in event && event.touches && event.touches[0]) {
			// @ts-ignore - touchType may not be defined in all browsers
			return event.touches[0].touchType === 'stylus';
		}
		return false;
	}

	// Helper function to convert screen coordinates to shape coordinates
	function getScaledCoordinates(clientX: number, clientY: number) {
		if (!lineElement) return { x: clientX, y: clientY };

		const pageContainer = lineElement.parentElement;
		if (!pageContainer) return { x: clientX, y: clientY };

		const rect = pageContainer.getBoundingClientRect();
		const canvasX = clientX - rect.left;
		const canvasY = clientY - rect.top;

		return {
			x: canvasX / pageScale,
			y: canvasY / pageScale
		};
	}

	// Calculate line endpoints
	let startPoint = $derived({ x: 0, y: 0 });
	let endPoint = $derived({ x: shapeWidth, y: shapeHeight });

	// Calculate line length and angle for hit detection
	let lineLength = $derived(Math.sqrt(shapeWidth * shapeWidth + shapeHeight * shapeHeight));
	let lineAngle = $derived(Math.atan2(shapeHeight, shapeWidth));

	// Calculate stroke-dasharray based on line type
	let strokeDashArray = $derived.by(() => {
		switch (lineType) {
			case 'dotted':
				return `${strokeWidth * 2},${strokeWidth * 2}`;
			case 'dashed':
				return `${strokeWidth * 4},${strokeWidth * 2}`;
			default:
				return 'none';
		}
	});

	function handleLineClick(event: MouseEvent | TouchEvent) {
		// If pen mode is active, only respond to pen events
		if (isPenMode && !isPenEvent(event)) {
			return;
		}

		event.stopPropagation();
		if (onSelect) {
			// If this line is already selected, deselect it
			if (isSelected) {
				onSelect(null);
			} else {
				onSelect(object.id);
			}
		}
	}


	function handleResizeMouseDown(event: MouseEvent, point: string) {
		event.stopPropagation();
		event.preventDefault();

		if (object.owner !== user) return;

		// If pen mode is active, only respond to pen events
		if (isPenMode && !isPenEvent(event)) {
			return;
		}

		// If we detect a pen event, enable pen mode (but not when actively adding lines)
		if (isPenEvent(event) && !isAddingLine) {
			isPenMode = true;
		}

		isResizing = true;
		activeResizePoint = point;
		resizeStart = {
			x: event.clientX,
			y: event.clientY,
			shapeX: x,
			shapeY: y,
			width: shapeWidth,
			height: shapeHeight
		};

		document.addEventListener('mousemove', handleResizeMouseMove);
		document.addEventListener('mouseup', handleResizeMouseUp);
	}

	function previewResize(clientX: number, clientY: number) {
		const scaled = getScaledCoordinates(clientX, clientY);
		const startScaled = getScaledCoordinates(resizeStart.x, resizeStart.y);

		let dx = scaled.x - startScaled.x;
		let dy = scaled.y - startScaled.y;

		let newX = resizeStart.shapeX;
		let newY = resizeStart.shapeY;
		let newWidth = resizeStart.width;
		let newHeight = resizeStart.height;

		if (activeResizePoint === 'start') {
			// Moving the start point - adjust position and size
			newX = resizeStart.shapeX + dx;
			newY = resizeStart.shapeY + dy;
			newWidth = resizeStart.width - dx;
			newHeight = resizeStart.height - dy;
		} else if (activeResizePoint === 'end') {
			// Moving the end point - only adjust size
			newWidth = resizeStart.width + dx;
			newHeight = resizeStart.height + dy;
		}

		x = newX;
		y = newY;
		shapeWidth = newWidth;
		shapeHeight = newHeight;
	}

	function hasResizeChanged() {
		return (
			x !== resizeStart.shapeX ||
			y !== resizeStart.shapeY ||
			shapeWidth !== resizeStart.width ||
			shapeHeight !== resizeStart.height
		);
	}

	function commitResize() {
		if (!hasResizeChanged()) return;

		onUpdate?.(object.id, { x, y, width: shapeWidth, height: shapeHeight });
	}

	function restoreResizeStart() {
		x = resizeStart.shapeX;
		y = resizeStart.shapeY;
		shapeWidth = resizeStart.width;
		shapeHeight = resizeStart.height;
	}

	function handleResizeMouseMove(event: MouseEvent) {
		if (!isResizing || !activeResizePoint) return;

		// If pen mode is active, only respond to pen events
		if (isPenMode && !isPenEvent(event)) {
			return;
		}

		previewResize(event.clientX, event.clientY);
	}


	function handleResizeMouseUp() {
		if (!isResizing) return;

		commitResize();
		isResizing = false;
		activeResizePoint = null;
		document.removeEventListener('mousemove', handleResizeMouseMove);
		document.removeEventListener('mouseup', handleResizeMouseUp);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Delete' && selected && onDelete) {
			event.preventDefault();
			onDelete(object.id);
		}
	}

	function resetPointerLocks() {
		if (isResizing) {
			restoreResizeStart();
		}

		isResizing = false;
		activeResizePoint = null;
		document.removeEventListener('mousemove', handleResizeMouseMove);
		document.removeEventListener('mouseup', handleResizeMouseUp);
		document.removeEventListener('touchmove', handleResizeTouchMove);
		document.removeEventListener('touchend', handleResizeTouchEnd);
		document.removeEventListener('touchcancel', handleResizeTouchCancel);
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeyDown);
		window.addEventListener('pdf-editor-reset-pointer-locks', resetPointerLocks);
		return () => {
			resetPointerLocks();
			document.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('pdf-editor-reset-pointer-locks', resetPointerLocks);
		};
	});


	// Touch event handlers for resize handles
	function handleResizeTouchStart(event: TouchEvent, point: string) {
		if (object.owner !== user) return;

		// Don't handle touch events if in pen mode unless it's a pen touch
		if (isPenMode && !isPenEvent(event)) {
			return;
		}

		// Only handle single touch
		if (event.touches.length !== 1) return;

		event.stopPropagation();
		event.preventDefault();

		// If we detect a pen/stylus touch, enable pen mode (but not when actively adding lines)
		if (isPenEvent(event) && !isAddingLine) {
			isPenMode = true;
		}

		const touch = event.touches[0];
		isResizing = true;
		activeResizePoint = point;
		resizeStart = {
			x: touch.clientX,
			y: touch.clientY,
			shapeX: x,
			shapeY: y,
			width: shapeWidth,
			height: shapeHeight
		};

		document.addEventListener('touchmove', handleResizeTouchMove, { passive: false });
		document.addEventListener('touchend', handleResizeTouchEnd, { passive: false });
		document.addEventListener('touchcancel', handleResizeTouchCancel, { passive: false });
	}

	function handleResizeTouchMove(event: TouchEvent) {
		if (!isResizing || !activeResizePoint) return;

		// Don't handle touch events if in pen mode unless it's a pen touch
		if (isPenMode && !isPenEvent(event)) {
			return;
		}

		// Only handle single touch
		if (event.touches.length !== 1) return;

		event.preventDefault();

		const touch = event.touches[0];
		previewResize(touch.clientX, touch.clientY);
	}

	function handleResizeTouchEnd(event: TouchEvent) {
		if (!isResizing) return;

		event.preventDefault();
		commitResize();
		isResizing = false;
		activeResizePoint = null;
		document.removeEventListener('touchmove', handleResizeTouchMove);
		document.removeEventListener('touchend', handleResizeTouchEnd);
		document.removeEventListener('touchcancel', handleResizeTouchCancel);
	}

	function handleResizeTouchCancel(event: TouchEvent) {
		if (event.cancelable) event.preventDefault();
		resetPointerLocks();
	}
</script>

<!-- Line container - minimal size, no bounding box -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="absolute top-0 left-0 select-none"
	style="width: {Math.abs(shapeWidth) + strokeWidth + 12}px; height: {Math.abs(shapeHeight) +
		strokeWidth +
		12}px; transform: translate({x + Math.min(0, shapeWidth) - 6}px, {y +
		Math.min(0, shapeHeight) -
		6}px); touch-action: none; user-select: none; -webkit-user-drag: none; pointer-events: none;"
	bind:this={lineElement}
	oncontextmenu={(e) => e.preventDefault()}
	onselectstart={(e) => e.preventDefault()}
	ondragstart={(e) => e.preventDefault()}
>
	<svg width="100%" height="100%" class="overflow-visible">
		<!-- Invisible wider line for easier clicking/selection -->
		<line
			x1={Math.abs(Math.min(0, shapeWidth)) + 6}
			y1={Math.abs(Math.min(0, shapeHeight)) + 6}
			x2={Math.abs(Math.min(0, shapeWidth)) + 6 + shapeWidth}
			y2={Math.abs(Math.min(0, shapeHeight)) + 6 + shapeHeight}
			stroke="transparent"
			stroke-width={Math.max(strokeWidth + 6, 8)}
			style="pointer-events: stroke; outline: none;"
			ondblclick={handleLineClick}
			onkeydown={handleKeyDown}
			role="button"
			tabindex="0"
			aria-label="Line shape"
		/>

		<!-- Selection indicator - only highlight the line itself -->
		{#if isObjectSelected}
			<line
				x1={Math.abs(Math.min(0, shapeWidth)) + 6}
				y1={Math.abs(Math.min(0, shapeHeight)) + 6}
				x2={Math.abs(Math.min(0, shapeWidth)) + 6 + shapeWidth}
				y2={Math.abs(Math.min(0, shapeHeight)) + 6 + shapeHeight}
				stroke="blue"
				stroke-width={strokeWidth + 4}
				stroke-opacity="0.3"
				stroke-dasharray={strokeDashArray}
				style="pointer-events: none;"
			/>
		{/if}

		{#if isPreviewed}
			<line
				x1={Math.abs(Math.min(0, shapeWidth)) + 6}
				y1={Math.abs(Math.min(0, shapeHeight)) + 6}
				x2={Math.abs(Math.min(0, shapeWidth)) + 6 + shapeWidth}
				y2={Math.abs(Math.min(0, shapeHeight)) + 6 + shapeHeight}
				stroke="rgb(217, 119, 6)"
				stroke-width={strokeWidth + 6}
				stroke-opacity="0.55"
				stroke-dasharray={strokeDashArray}
				class="preview-line"
				style="pointer-events: none;"
			/>
		{/if}

		<!-- Visible line -->
		<line
			x1={Math.abs(Math.min(0, shapeWidth)) + 6}
			y1={Math.abs(Math.min(0, shapeHeight)) + 6}
			x2={Math.abs(Math.min(0, shapeWidth)) + 6 + shapeWidth}
			y2={Math.abs(Math.min(0, shapeHeight)) + 6 + shapeHeight}
			stroke={strokeColor}
			stroke-width={strokeWidth}
			stroke-dasharray={strokeDashArray}
			style="pointer-events: none;"
		/>
	</svg>

	<!-- Resize handles - only show when selected, only at start and end points -->
	{#if selected}
		<!-- Start point handle -->
		<div
			class="resize-handle absolute h-3 w-3 cursor-move rounded-full border-2 border-white bg-blue-500 transition-colors hover:bg-blue-600"
			style="left: {Math.abs(Math.min(0, shapeWidth)) + 6 - 6}px; top: {Math.abs(
				Math.min(0, shapeHeight)
			) +
				6 -
				6}px; pointer-events: auto;"
			onmousedown={(e) => handleResizeMouseDown(e, 'start')}
			ontouchstart={(e) => handleResizeTouchStart(e, 'start')}
			role="button"
			tabindex="0"
			aria-label="Resize start point handle"
		></div>

		<!-- End point handle -->
		<div
			class="resize-handle absolute h-3 w-3 cursor-move rounded-full border-2 border-white bg-blue-500 transition-colors hover:bg-blue-600"
			style="left: {Math.abs(Math.min(0, shapeWidth)) + 6 + shapeWidth - 6}px; top: {Math.abs(
				Math.min(0, shapeHeight)
			) +
				6 +
				shapeHeight -
				6}px; pointer-events: auto;"
			onmousedown={(e) => handleResizeMouseDown(e, 'end')}
			ontouchstart={(e) => handleResizeTouchStart(e, 'end')}
			role="button"
			tabindex="0"
			aria-label="Resize end point handle"
		></div>
	{/if}
</div>

<style>
	.preview-line {
		animation: preview-pulse 0.75s ease-in-out infinite alternate;
	}

	@keyframes preview-pulse {
		from {
			opacity: 0.65;
		}
		to {
			opacity: 1;
		}
	}
</style>
