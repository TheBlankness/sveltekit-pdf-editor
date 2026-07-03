<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		isPenLikePointerEvent,
		LiveStroke,
		type StrokeCommand
	} from './utils/liveStroke';
	import {
		getBoundedCanvasBackingScale,
		getCappedDevicePixelRatio
	} from './utils/annotationRendering';

	let {
		pageScale,
		highlightSize = 10,
		highlightColor = '#ffff00',
		highlightOpacity = 0.5,
		isPenMode = $bindable(false),
		onStrokeStart,
		onStrokeEnd,
		onStrokeCancel,
		onFinishHighlight
	} = $props();

	let canvas: HTMLElement | undefined = $state();
	let previewCanvas: HTMLCanvasElement | undefined = $state();
	let lastPreviewBitmapWidth = 0;
	let lastPreviewBitmapHeight = 0;

	let highlighting = false;
	let currentHighlightType: string | null = null;
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
		const wasHighlighting = highlighting;
		resetHighlightingState();
		if (wasHighlighting) notifyStrokeCancel();
	}

	function resetPointerLocks() {
		window.removeEventListener('pointermove', handlePointermove);
		window.removeEventListener('pointerup', handlePointerup);
		window.removeEventListener('pointercancel', handlePointercancel);
		window.removeEventListener('touchmove', handleTouchmove);
		window.removeEventListener('touchend', handleTouchend);
		window.removeEventListener('touchcancel', handleTouchcancel);
		const wasHighlighting = highlighting;
		resetHighlightingState();
		if (wasHighlighting) notifyStrokeCancel();
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

	function resetHighlightingState() {
		highlighting = false;
		currentHighlightType = null;
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

	function renderPreview(commands: readonly StrokeCommand[]) {
		const preview = getPreviewContext();
		if (!preview) return;

		const { context, width, height } = preview;
		// Highlighter strokes must be composited once per frame. Incremental segment
		// drawing stacks alpha at segment joins and makes the live preview look opaque.
		context.clearRect(0, 0, width, height);
		if (commands.length === 0) {
			return;
		}

		context.save();
		context.globalAlpha = highlightOpacity;
		context.strokeStyle = highlightColor;
		context.lineWidth = Math.max(0.1, highlightSize * Math.max(pageScale || 1, 0.1));
		context.lineJoin = 'round';
		context.lineCap = 'round';
		context.beginPath();

		const startIndex = 0;
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
				if (currentHighlightType === 'touch') cancelHighlighting();
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
			currentHighlightType = 'pen';
			startHighlighting(event.clientX, event.clientY, event.target);
		} else if (event.pointerType === 'mouse' && !isPenMode) {
			if (activePointers.size === 1) {
				currentHighlightType = 'mouse';
				startHighlighting(event.clientX, event.clientY, event.target);
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
			(isActivePen && currentHighlightType === 'pen') ||
			(event.pointerType === 'mouse' &&
				currentHighlightType === 'mouse' &&
				activePointers.size === 1 &&
				!isPenActive)
		) {
			continueHighlighting(event);
		}
	}

	function handlePointerup(event: PointerEvent) {
		const activePointer = activePointers.get(event.pointerId);
		const isActivePen = activePointer?.type === 'pen' || isPenLikePointerEvent(event);
		activePointers.delete(event.pointerId);

		if (isActivePen && currentHighlightType === 'pen') {
			isPenActive = false;
			currentHighlightType = null;
			endHighlighting();
		} else if (
			event.pointerType === 'mouse' &&
			currentHighlightType === 'mouse' &&
			activePointers.size === 0 &&
			!isPenMode
		) {
			currentHighlightType = null;
			endHighlighting();
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
			const wasHighlighting = highlighting;
			resetHighlightingState();
			if (wasHighlighting) notifyStrokeCancel();
			window.removeEventListener('pointermove', handlePointermove);
			window.removeEventListener('pointerup', handlePointerup);
			window.removeEventListener('pointercancel', handlePointercancel);
		}
	}

	function handleTouchStart(event: TouchEvent) {
		if (isPenMode) {
			event.preventDefault();
			event.stopPropagation();
			if (currentHighlightType === 'touch') cancelHighlighting();
			return;
		}

		if (event.touches.length > 1) {
			if (currentHighlightType === 'touch') cancelHighlighting();
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
			currentHighlightType = 'touch';
			startHighlighting(touch.clientX, touch.clientY, touch.target);
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
			if (currentHighlightType === 'touch') cancelHighlighting();
			return;
		}

		event.preventDefault();

		for (const touch of event.touches) {
			activeTouches.set(touch.identifier, {
				x: touch.clientX,
				y: touch.clientY
			});
		}

		if (!isPenActive && currentHighlightType === 'touch') {
			const touch = event.touches[0];
			continueHighlighting(touch);
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

		if (activeTouches.size === 0 && currentHighlightType === 'touch') {
			currentHighlightType = null;
			endHighlighting();
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

	function cancelHighlighting() {
		if (highlighting) {
			resetHighlightingState();
			notifyStrokeCancel();
		}
	}

	function startHighlighting(clientX: number, clientY: number, target: EventTarget | null) {
		highlighting = liveStroke.start(clientX, clientY, target);
		if (highlighting) notifyStrokeStart();
	}

	function continueHighlighting(event: PointerEvent | Touch) {
		if (!highlighting) return;

		if ('pointerId' in event) {
			liveStroke.addPointerEvent(event);
		} else {
			liveStroke.addClientPoint(event.clientX, event.clientY);
		}
	}

	function endHighlighting() {
		if (!highlighting) return;
		finish();
	}

	function finish() {
		const highlightData = liveStroke.finish(pageScale);
		if (!highlightData) return;

		try {
			onFinishHighlight({
				originWidth: highlightData.originWidth,
				originHeight: highlightData.originHeight,
				path: highlightData.path,
				brushSize: highlightSize,
				brushColor: highlightColor,
				brushOpacity: highlightOpacity
			});
		} finally {
			resetHighlightingState();
			notifyStrokeEnd();
		}
	}
</script>

<div
	bind:this={canvas}
	class="absolute top-0 left-0 h-full w-full select-none"
	style="cursor: {isPenMode ? 'crosshair' : 'crosshair'};"
>
	<canvas bind:this={previewCanvas} class="pointer-events-none h-full w-full"></canvas>
</div>
