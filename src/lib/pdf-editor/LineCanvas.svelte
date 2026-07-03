<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let {
		pageScale,
		strokeColor = '#000000',
		strokeWidth = 2,
		lineType = 'solid',
		isPenMode = $bindable(false),
		isAddingLine = false,
		onFinishLine
	} = $props();

	let canvas: HTMLDivElement | undefined = $state();
	let isCreating = $state(false);
	let startPoint = { x: 0, y: 0 };
	let currentPoint = { x: 0, y: 0 };
	let previewLine: {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		strokeColor: string;
		strokeWidth: number;
		lineType: 'solid' | 'dotted' | 'dashed';
	} | null = $state(null);

	// Pen mode detection function
	function isPenEvent(event: MouseEvent | TouchEvent | PointerEvent): boolean {
		// Check if it's a pen/stylus event
		if ('pointerType' in event) {
			return event.pointerType === 'pen';
		}
		if ('touches' in event && event.touches && event.touches[0]) {
			// @ts-ignore - touchType may not be defined in all browsers
			return event.touches[0].touchType === 'stylus';
		}
		return false;
	}

	onMount(() => {
		setupCanvas();
	});

	onDestroy(() => {
		cleanupCanvas();
	});

	function setupCanvas() {
		if (!canvas) return;

		canvas.addEventListener('mousedown', handleMouseDown);
		canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
		window.addEventListener('pdf-editor-reset-pointer-locks', resetPointerLocks);
	}

	function cleanupCanvas() {
		if (canvas) {
			canvas.removeEventListener('mousedown', handleMouseDown);
			canvas.removeEventListener('touchstart', handleTouchStart);
		}

		resetPointerLocks();
		window.removeEventListener('pdf-editor-reset-pointer-locks', resetPointerLocks);
	}

	function resetPointerLocks() {
		isCreating = false;
		previewLine = null;
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
		window.removeEventListener('touchmove', handleTouchMove);
		window.removeEventListener('touchend', handleTouchEnd);
		window.removeEventListener('touchcancel', handleTouchCancel);
	}

	function clampCanvasCoordinate(value: number, max: number) {
		return Math.max(0, Math.min(value, max));
	}

	function getCanvasPoint(clientX: number, clientY: number, canvasRect: DOMRect) {
		return {
			x: clampCanvasCoordinate(clientX - canvasRect.left, canvasRect.width),
			y: clampCanvasCoordinate(clientY - canvasRect.top, canvasRect.height)
		};
	}

	function handleMouseDown(event: MouseEvent) {
		// If pen mode is active, only respond to pen events
		if (isPenMode && !isPenEvent(event)) {
			return;
		}

		// If we detect a pen event, enable pen mode (but not when actively adding lines)
		if (isPenEvent(event) && !isAddingLine) {
			isPenMode = true;
		}

		if (event.button !== 0) return; // Only left click
		if (!canvas) return;

		event.preventDefault();
		event.stopPropagation();

		const canvasRect = canvas.getBoundingClientRect();
		startPoint = getCanvasPoint(event.clientX, event.clientY, canvasRect);
		currentPoint = { ...startPoint };
		isCreating = true;

		updatePreviewLine();

		// Add window-level listeners for mouse move and up
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isCreating || !canvas) return;

		// If pen mode is active, only respond to pen events
		if (isPenMode && !isPenEvent(event)) {
			return;
		}

		const canvasRect = canvas.getBoundingClientRect();
		currentPoint = getCanvasPoint(event.clientX, event.clientY, canvasRect);

		updatePreviewLine();
	}

	function handleMouseUp(event: MouseEvent) {
		if (!isCreating || !canvas) return;

		// If pen mode is active, only respond to pen events
		if (isPenMode && !isPenEvent(event)) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const canvasRect = canvas.getBoundingClientRect();
		const endPoint = getCanvasPoint(event.clientX, event.clientY, canvasRect);

		// Only create line if there's meaningful movement
		const minDistance = 5;
		const distance = Math.sqrt(
			Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2)
		);

		if (distance > minDistance) {
			createLine(startPoint, endPoint, canvasRect);
		}

		// Reset state
		isCreating = false;
		previewLine = null;

		// Remove window-level listeners
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	}

	// Touch event handlers
	function handleTouchStart(event: TouchEvent) {
		// Don't handle touch events if in pen mode
		if (isPenMode && !isPenEvent(event)) {
			return;
		}

		// Only handle single touch
		if (event.touches.length !== 1) return;
		if (!canvas) return;

		// If we detect a pen/stylus touch, enable pen mode (but not when actively adding lines)
		if (isPenEvent(event) && !isAddingLine) {
			isPenMode = true;
		}

		event.preventDefault();
		event.stopPropagation();

		const touch = event.touches[0];
		const canvasRect = canvas.getBoundingClientRect();
		startPoint = getCanvasPoint(touch.clientX, touch.clientY, canvasRect);
		currentPoint = { ...startPoint };
		isCreating = true;

		updatePreviewLine();

		// Add window-level listeners for touch move and end
		window.addEventListener('touchmove', handleTouchMove, { passive: false });
		window.addEventListener('touchend', handleTouchEnd);
		window.addEventListener('touchcancel', handleTouchCancel);
	}

	function handleTouchMove(event: TouchEvent) {
		if (!isCreating || !canvas) return;

		// Don't handle touch events if in pen mode
		if (isPenMode && !isPenEvent(event)) {
			return;
		}

		// Only handle single touch
		if (event.touches.length !== 1) return;

		event.preventDefault();
		event.stopPropagation();

		const touch = event.touches[0];
		const canvasRect = canvas.getBoundingClientRect();
		currentPoint = getCanvasPoint(touch.clientX, touch.clientY, canvasRect);

		updatePreviewLine();
	}

	function handleTouchEnd(event: TouchEvent) {
		if (!isCreating || !canvas) return;

		// Don't handle touch events if in pen mode
		if (isPenMode && !isPenEvent(event)) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const canvasRect = canvas.getBoundingClientRect();
		const endPoint = {
			x: currentPoint.x,
			y: currentPoint.y
		};

		// Only create line if there's meaningful movement
		const minDistance = 5;
		const distance = Math.sqrt(
			Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2)
		);

		if (distance > minDistance) {
			createLine(startPoint, endPoint, canvasRect);
		}

		// Reset state
		isCreating = false;
		previewLine = null;

		// Remove window-level listeners
		window.removeEventListener('touchmove', handleTouchMove);
		window.removeEventListener('touchend', handleTouchEnd);
		window.removeEventListener('touchcancel', handleTouchCancel);
	}

	function handleTouchCancel() {
		resetPointerLocks();
	}

	function updatePreviewLine() {
		previewLine = {
			x1: startPoint.x,
			y1: startPoint.y,
			x2: currentPoint.x,
			y2: currentPoint.y,
			strokeColor,
			strokeWidth,
			lineType
		};
	}

	function createLine(
		start: { x: number; y: number },
		end: { x: number; y: number },
		canvasRect: DOMRect
	) {
		const lineData = {
			originWidth: canvasRect.width / pageScale,
			originHeight: canvasRect.height / pageScale,
			x: start.x / pageScale,
			y: start.y / pageScale,
			width: (end.x - start.x) / pageScale, // dx from start to end
			height: (end.y - start.y) / pageScale, // dy from start to end
			strokeColor,
			fillColor: 'transparent',
			strokeWidth,
			lineType
		};

		if (onFinishLine) {
			onFinishLine(lineData);
		}
	}
</script>

<div
	bind:this={canvas}
	class="absolute top-0 left-0 h-full w-full select-none"
	style="cursor: crosshair;"
>
	<!-- Preview line while creating -->
	{#if isCreating && previewLine}
		{@const dashArray =
			previewLine.lineType === 'dotted'
				? `${previewLine.strokeWidth * 2},${previewLine.strokeWidth * 2}`
				: previewLine.lineType === 'dashed'
					? `${previewLine.strokeWidth * 4},${previewLine.strokeWidth * 2}`
					: 'none'}
		<svg class="pointer-events-none absolute top-0 left-0 h-full w-full">
			<line
				x1={previewLine.x1}
				y1={previewLine.y1}
				x2={previewLine.x2}
				y2={previewLine.y2}
				stroke={previewLine.strokeColor}
				stroke-width={previewLine.strokeWidth}
				stroke-dasharray={dashArray}
				opacity="0.7"
			/>
		</svg>
	{/if}
</div>
