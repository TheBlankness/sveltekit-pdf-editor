<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		isPenLikePointerEvent,
		LiveStroke,
		type StrokeCommand,
		type StrokeRenderRange
	} from './utils/liveStroke';
	import {
		getBoundedCanvasBackingScale,
		getCappedDevicePixelRatio
	} from './utils/annotationRendering';

	let {
		pageScale,
		isPenMode = $bindable(false),
		onStrokeStart,
		onStrokeEnd,
		onStrokeCancel,
		onFinishPointing
	} = $props();

	let canvas: HTMLElement | undefined = $state();
	let previewCanvas: HTMLCanvasElement | undefined = $state();
	let lastPreviewBitmapWidth = 0;
	let lastPreviewBitmapHeight = 0;

	let drawing = false;
	let currentDrawingType: string | null = null;
	let strokeNotified = false;

	const liveStroke = new LiveStroke(
		() => canvas,
		() => {},
		{
			renderCommands: renderPreview
		}
	);

	// Pannable state
	let activeTouches = new Map();
	let activePointers = new Map();
	let isPenActive = false;

	// Pointer stroke configuration
	const POINTER_STROKE_WIDTH = 1;

	onMount(async () => {
		setupPannable();
	});

	onDestroy(() => {
		cleanupPannable();
	});

	function setupPannable() {
		if (!canvas) return;

		canvas.addEventListener('pointerdown', handlePointerdown);
		canvas.addEventListener('touchstart', handleTouchStart);
		window.addEventListener('pdf-editor-reset-pointer-locks', resetPointerLocks);
	}

	function cleanupPannable() {
		if (canvas) {
			canvas.removeEventListener('pointerdown', handlePointerdown);
			canvas.removeEventListener('touchstart', handleTouchStart);
		}

		window.removeEventListener('pointermove', handlePointermove);
		window.removeEventListener('pointerup', handlePointerup);
		window.removeEventListener('pointercancel', handlePointercancel);
		window.removeEventListener('touchmove', handleTouchmove);
		window.removeEventListener('touchend', handleTouchend);
		window.removeEventListener('touchcancel', handleTouchcancel);
		window.removeEventListener('pdf-editor-reset-pointer-locks', resetPointerLocks);
		const wasDrawing = drawing;
		resetDrawingState();
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
		resetDrawingState();
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

	function resetDrawingState() {
		drawing = false;
		currentDrawingType = null;
		isPenActive = false;
		activePointers.clear();
		activeTouches.clear();
		liveStroke.reset();
	}

	function getPreviewContext() {
		if (!canvas || !previewCanvas) return null;

		const rect = canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return null;

		const dpr = getCappedDevicePixelRatio();
		const backingScale = getBoundedCanvasBackingScale(rect.width, rect.height, dpr);
		const bitmapWidth = Math.max(1, Math.round(rect.width * backingScale));
		const bitmapHeight = Math.max(1, Math.round(rect.height * backingScale));

		const resized =
			lastPreviewBitmapWidth !== bitmapWidth ||
			lastPreviewBitmapHeight !== bitmapHeight;

		if (resized) {
			previewCanvas.width = bitmapWidth;
			previewCanvas.height = bitmapHeight;
			lastPreviewBitmapWidth = bitmapWidth;
			lastPreviewBitmapHeight = bitmapHeight;
		}

		const context = previewCanvas.getContext('2d');
		if (!context) return null;

		context.setTransform(backingScale, 0, 0, backingScale, 0, 0);
		return { context, width: rect.width, height: rect.height, resized };
	}

	function renderPreview(commands: readonly StrokeCommand[], range: StrokeRenderRange = { from: 0 }) {
		const preview = getPreviewContext();
		if (!preview) return;

		const { context, width, height, resized } = preview;
		const shouldRedrawAll = resized || range.reset || range.from <= 0;
		if (shouldRedrawAll) {
			context.clearRect(0, 0, width, height);
		}
		if (commands.length === 0) {
			if (!shouldRedrawAll) context.clearRect(0, 0, width, height);
			return;
		}

		const gradient = context.createLinearGradient(0, 0, width, 0);
		gradient.addColorStop(0, '#ff0000');
		gradient.addColorStop(0.1666, '#ff8000');
		gradient.addColorStop(0.3333, '#ffff00');
		gradient.addColorStop(0.5, '#00ff00');
		gradient.addColorStop(0.6666, '#0080ff');
		gradient.addColorStop(0.8333, '#8000ff');
		gradient.addColorStop(1, '#ff0080');

		context.save();
		context.strokeStyle = gradient;
		context.lineWidth = Math.max(0.1, POINTER_STROKE_WIDTH * Math.max(pageScale || 1, 0.1));
		context.lineJoin = 'round';
		context.lineCap = 'round';
		context.beginPath();

		const startIndex = shouldRedrawAll ? 0 : Math.max(0, range.from);
		if (startIndex > 0) {
			const [, previousX, previousY] = commands[startIndex - 1];
			context.moveTo(previousX, previousY);
		}

		for (let index = startIndex; index < commands.length; index += 1) {
			const [command, x, y] = commands[index];
			if (command === 'M') {
				context.moveTo(x, y);
			} else {
				context.lineTo(x, y);
			}
		}

		context.stroke();
		context.restore();
	}

	function setPenMode(active: boolean) {
		isPenMode = active;
	}

	function handlePointerdown(event: PointerEvent) {
		if (event.pointerType === 'touch') {
			if (isPenMode) {
				event.preventDefault();
				event.stopPropagation();
				if (currentDrawingType === 'touch') cancelDrawing();
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
			setPenMode(true);
			currentDrawingType = 'pen';
			startDrawing(event.clientX, event.clientY, event.target);
		} else if (event.pointerType === 'mouse' && !isPenMode) {
			if (activePointers.size === 1) {
				currentDrawingType = 'mouse';
				startDrawing(event.clientX, event.clientY, event.target);
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
			continueDrawing(event);
		}
	}

	function handlePointerup(event: PointerEvent) {
		const activePointer = activePointers.get(event.pointerId);
		const isActivePen = activePointer?.type === 'pen' || isPenLikePointerEvent(event);
		activePointers.delete(event.pointerId);

		if (isActivePen && currentDrawingType === 'pen') {
			isPenActive = false;
			currentDrawingType = null;
			endDrawing();
		} else if (
			event.pointerType === 'mouse' &&
			currentDrawingType === 'mouse' &&
			activePointers.size === 0 &&
			!isPenMode
		) {
			currentDrawingType = null;
			endDrawing();
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
			const wasDrawing = drawing;
			resetDrawingState();
			if (wasDrawing) notifyStrokeCancel();
			window.removeEventListener('pointermove', handlePointermove);
			window.removeEventListener('pointerup', handlePointerup);
			window.removeEventListener('pointercancel', handlePointercancel);
		}
	}

	function handleTouchStart(event: TouchEvent) {
		if (isPenMode) {
			event.preventDefault();
			event.stopPropagation();
			if (currentDrawingType === 'touch') cancelDrawing();
			return;
		}

		if (event.touches.length > 1) {
			if (currentDrawingType === 'touch') cancelDrawing();
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
			startDrawing(touch.clientX, touch.clientY, touch.target);
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
			if (currentDrawingType === 'touch') cancelDrawing();
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
			continueDrawing(touch);
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
			endDrawing();
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

	function startDrawing(clientX: number, clientY: number, target: EventTarget | null) {
		drawing = liveStroke.start(clientX, clientY, target);
		if (drawing) notifyStrokeStart();
	}

	function continueDrawing(event: PointerEvent | Touch) {
		if (!drawing) return;

		if ('pointerId' in event) {
			liveStroke.addPointerEvent(event);
		} else {
			liveStroke.addClientPoint(event.clientX, event.clientY);
		}
	}

	function endDrawing() {
		if (!drawing) return;
		finish();
	}

	function cancelDrawing() {
		if (drawing) {
			resetDrawingState();
			notifyStrokeCancel();
		}
	}

	function finish() {
		const pointingData = liveStroke.finish(pageScale);
		if (!pointingData) return;

		try {
			onFinishPointing({
				originWidth: pointingData.originWidth,
				originHeight: pointingData.originHeight,
				path: pointingData.path
			});
		} finally {
			resetDrawingState();
			notifyStrokeEnd();
		}
	}
</script>

<div
	bind:this={canvas}
	class="absolute top-0 left-0 h-full w-full select-none"
	style="cursor: crosshair;"
>
	<canvas bind:this={previewCanvas} class="pointer-events-none h-full w-full"></canvas>
</div>
