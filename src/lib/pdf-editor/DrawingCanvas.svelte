<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		isIOSLikeDevice,
		isPenLikePointerEvent,
		LiveStroke,
		type StrokeCommand,
		type StrokeRenderRange
	} from './utils/liveStroke';
	import {
		getBoundedCanvasBackingScale,
		getCappedDevicePixelRatio
	} from './utils/annotationRendering';

	type DrawingInputType = 'pen' | 'mouse' | 'touch';
	type ActivePointer = {
		type: DrawingInputType;
		x: number;
		y: number;
	};
	type ActiveTouch = {
		x: number;
		y: number;
	};
	type DrawingEndReason =
		| 'cleanup'
		| 'interrupted'
		| 'lostpointercapture'
		| 'new-pointerdown'
		| 'new-touchstart'
		| 'pointercancel'
		| 'reset'
		| 'touchcancel'
		| 'visibilitychange';

	const NON_PASSIVE_EVENT_OPTIONS = { passive: false };
	const POINTER_RELIABILITY_WINDOW_MS = 2500;
	const POINTER_RELIABILITY_FAILURE_THRESHOLD = 2;
	const DRAWING_INPUT_DEBUG_STORAGE_KEY = 'pdf-editor-drawing-input-debug';

	let {
		pageScale,
		brushSize,
		brushColor,
		brushOpacity,
		isPenMode = $bindable(false),
		onStrokeStart,
		onStrokeEnd,
		onStrokeCancel,
		onFinishDrawing
	} = $props();

	let canvas: HTMLElement | undefined = $state();
	let previewCanvas: HTMLCanvasElement | undefined = $state();
	let lastPreviewBitmapWidth = 0;
	let lastPreviewBitmapHeight = 0;

	let drawing = false;
	let currentDrawingType: DrawingInputType | null = null;
	let strokeNotified = false;
	let activePointerId: number | null = null;
	let activeTouchId: number | null = null;
	let capturedPointerId: number | null = null;
	let useTouchFallback = false;
	let pointerReliabilityFailures: number[] = [];
	let previewResizeDeferred = false;
	let strokePageScale = pageScale;

	const liveStroke = new LiveStroke(
		() => canvas,
		() => {},
		{
			renderCommands: renderPreview
		}
	);

	// Pannable state
	let activeTouches = new Map<number, ActiveTouch>();
	let activePointers = new Map<number, ActivePointer>();
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
		canvas.addEventListener('gotpointercapture', handleGotPointerCapture);
		canvas.addEventListener('lostpointercapture', handleLostPointerCapture);
		canvas.addEventListener('touchstart', handleTouchStart, NON_PASSIVE_EVENT_OPTIONS);
		window.addEventListener('blur', handleInterruptedDrawing);
		window.addEventListener('pdf-editor-reset-pointer-locks', resetPointerLocks);
		document.addEventListener('visibilitychange', handleVisibilityChange);
	}

	function cleanupPannable() {
		if (canvas) {
			canvas.removeEventListener('pointerdown', handlePointerdown);
			canvas.removeEventListener('gotpointercapture', handleGotPointerCapture);
			canvas.removeEventListener('lostpointercapture', handleLostPointerCapture);
			canvas.removeEventListener('touchstart', handleTouchStart);
		}

		detachPointerListeners();
		detachTouchListeners();
		window.removeEventListener('blur', handleInterruptedDrawing);
		window.removeEventListener('pdf-editor-reset-pointer-locks', resetPointerLocks);
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		cancelActiveStroke('cleanup');
	}

	function resetPointerLocks() {
		cancelActiveStroke('reset');
	}

	function attachPointerListeners() {
		window.addEventListener('pointermove', handlePointermove);
		window.addEventListener('pointerup', handlePointerup);
		window.addEventListener('pointercancel', handlePointercancel);
	}

	function detachPointerListeners() {
		window.removeEventListener('pointermove', handlePointermove);
		window.removeEventListener('pointerup', handlePointerup);
		window.removeEventListener('pointercancel', handlePointercancel);
	}

	function attachTouchListeners() {
		window.addEventListener('touchmove', handleTouchmove, NON_PASSIVE_EVENT_OPTIONS);
		window.addEventListener('touchend', handleTouchend, NON_PASSIVE_EVENT_OPTIONS);
		window.addEventListener('touchcancel', handleTouchcancel, NON_PASSIVE_EVENT_OPTIONS);
	}

	function detachTouchListeners() {
		window.removeEventListener('touchmove', handleTouchmove);
		window.removeEventListener('touchend', handleTouchend);
		window.removeEventListener('touchcancel', handleTouchcancel);
	}

	function isIOSSafari() {
		if (!isIOSLikeDevice() || typeof navigator === 'undefined') return false;

		const userAgent = navigator.userAgent;
		return (
			/Safari/i.test(userAgent) &&
			!/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent)
		);
	}

	function isDrawingInputDebugEnabled() {
		if (typeof window === 'undefined') return false;

		const debugWindow = window as typeof window & {
			__PDF_EDITOR_DRAWING_INPUT_DEBUG__?: boolean;
		};
		if (debugWindow.__PDF_EDITOR_DRAWING_INPUT_DEBUG__) return true;

		try {
			return (
				window.localStorage?.getItem(DRAWING_INPUT_DEBUG_STORAGE_KEY) === 'true' ||
				window.sessionStorage?.getItem(DRAWING_INPUT_DEBUG_STORAGE_KEY) === 'true' ||
				new URLSearchParams(window.location.search).get('drawingInputDebug') === '1'
			);
		} catch {
			return false;
		}
	}

	function describeTarget(target: EventTarget | null) {
		if (typeof Element === 'undefined' || !(target instanceof Element)) {
			if (target === window) return 'window';
			if (target === document) return 'document';
			return target ? target.constructor?.name || 'unknown' : null;
		}

		const id = target.id ? `#${target.id}` : '';
		const className = Array.from(target.classList)
			.slice(0, 4)
			.map((name) => `.${name}`)
			.join('');
		return `${target.tagName.toLowerCase()}${id}${className}`;
	}

	function getDrawingDebugState() {
		return {
			drawing,
			currentDrawingType,
			activePointerId,
			activeTouchId,
			capturedPointerId,
			activePointers: activePointers.size,
			activeTouches: activeTouches.size,
			isPenActive,
			isPenMode,
			useTouchFallback,
			pointerReliabilityFailures: pointerReliabilityFailures.length,
			strokePoints: liveStroke.length
		};
	}

	function logDrawingInput(
		name: string,
		event?: Event,
		detail: Record<string, unknown> = {}
	) {
		if (!isDrawingInputDebugEnabled()) return;

		const pointerEvent =
			typeof PointerEvent !== 'undefined' && event instanceof PointerEvent ? event : null;
		const touchEvent =
			typeof TouchEvent !== 'undefined' && event instanceof TouchEvent ? event : null;

		console.debug('[pdf-editor:drawing-input]', {
			event: name,
			pointerId: pointerEvent?.pointerId ?? null,
			pointerType: pointerEvent?.pointerType ?? null,
			buttons: pointerEvent?.buttons ?? null,
			pressure: pointerEvent?.pressure ?? null,
			isPrimary: pointerEvent?.isPrimary ?? null,
			touches: touchEvent?.touches.length ?? null,
			changedTouches: touchEvent
				? Array.from(touchEvent.changedTouches).map((touch) => touch.identifier)
				: null,
			target: describeTarget(event?.target ?? null),
			currentTarget: describeTarget(event?.currentTarget ?? null),
			state: getDrawingDebugState(),
			...detail
		});
	}

	function preventDrawingDefault(event: Event) {
		if (event.cancelable) event.preventDefault();
		event.stopPropagation();
	}

	function recordPointerReliabilityFailure(source: 'lostpointercapture' | 'pointercancel') {
		if (!isIOSSafari()) return;

		const now = Date.now();
		pointerReliabilityFailures = pointerReliabilityFailures.filter(
			(time) => now - time <= POINTER_RELIABILITY_WINDOW_MS
		);
		pointerReliabilityFailures.push(now);

		if (
			!useTouchFallback &&
			pointerReliabilityFailures.length >= POINTER_RELIABILITY_FAILURE_THRESHOLD
		) {
			useTouchFallback = true;
			logDrawingInput('touch-fallback-enabled', undefined, {
				source,
				failures: pointerReliabilityFailures.length
			});
		}
	}

	function clearPointerReliabilityFailures() {
		pointerReliabilityFailures = [];
		useTouchFallback = false;
	}

	function setPointerCaptureSafely(event: PointerEvent) {
		if (!canvas || typeof canvas.setPointerCapture !== 'function') return;
		if (isIOSSafari() && isPenLikePointerEvent(event)) {
			logDrawingInput('setpointercapture-skipped-ios-pen', event);
			return;
		}

		try {
			canvas.setPointerCapture(event.pointerId);
			capturedPointerId = event.pointerId;
		} catch (error) {
			capturedPointerId = null;
			logDrawingInput('setpointercapture-failed', event, { error });
		}
	}

	function releasePointerCaptureSafely(pointerId = capturedPointerId) {
		if (pointerId === null || !canvas || typeof canvas.releasePointerCapture !== 'function') {
			return;
		}

		try {
			const hasCapture =
				typeof canvas.hasPointerCapture === 'function'
					? canvas.hasPointerCapture(pointerId)
					: capturedPointerId === pointerId;
			if (hasCapture) {
				canvas.releasePointerCapture(pointerId);
			}
		} catch (error) {
			// Ignore release failures; stale capture state is cleared below.
			logDrawingInput('releasepointercapture-failed', undefined, { pointerId, error });
		} finally {
			if (capturedPointerId === pointerId) {
				capturedPointerId = null;
			}
		}
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
		const pointerIdToRelease = capturedPointerId;
		releasePointerCaptureSafely(pointerIdToRelease);
		drawing = false;
		currentDrawingType = null;
		isPenActive = false;
		activePointerId = null;
		activeTouchId = null;
		capturedPointerId = null;
		activePointers.clear();
		activeTouches.clear();
		liveStroke.reset();
		previewResizeDeferred = false;
		strokePageScale = pageScale;
	}

	function cancelActiveStroke(reason: DrawingEndReason) {
		const wasDrawing = drawing;
		logDrawingInput('cancel-active-stroke', undefined, { reason });
		detachPointerListeners();
		detachTouchListeners();
		resetDrawingState();
		if (wasDrawing) notifyStrokeCancel();
	}

	function clearStaleDrawingState(reason: DrawingEndReason) {
		if (
			!drawing &&
			activePointerId === null &&
			activeTouchId === null &&
			activePointers.size === 0
		) {
			return;
		}

		cancelActiveStroke(reason);
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
			if (drawing && lastPreviewBitmapWidth > 0 && lastPreviewBitmapHeight > 0) {
				previewResizeDeferred = true;
			} else {
				previewCanvas.width = bitmapWidth;
				previewCanvas.height = bitmapHeight;
				lastPreviewBitmapWidth = bitmapWidth;
				lastPreviewBitmapHeight = bitmapHeight;
				previewResizeDeferred = false;
			}
		}

		const context = previewCanvas.getContext('2d');
		if (!context) return null;

		const activeBackingScale =
			resized && drawing && lastPreviewBitmapWidth > 0
				? lastPreviewBitmapWidth / Math.max(rect.width, 1)
				: backingScale;
		context.setTransform(activeBackingScale, 0, 0, activeBackingScale, 0, 0);
		return {
			context,
			width: rect.width,
			height: rect.height,
			resized: resized && !previewResizeDeferred
		};
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

		context.save();
		context.globalAlpha = brushOpacity;
		context.strokeStyle = brushColor;
		const renderScale = drawing ? strokePageScale : pageScale;
		context.lineWidth = Math.max(0.1, brushSize * Math.max(renderScale || 1, 0.1));
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

	function handleInterruptedDrawing() {
		cancelActiveStroke('interrupted');
	}

	function handleVisibilityChange() {
		if (document.hidden) {
			cancelActiveStroke('visibilitychange');
		}
	}

	function setPenMode(active: boolean) {
		isPenMode = active;
	}

	function handlePointerdown(event: PointerEvent) {
		logDrawingInput('pointerdown', event);
		clearStaleDrawingState('new-pointerdown');

		const isPenPointer = isPenLikePointerEvent(event);

		if (useTouchFallback && isIOSSafari() && !isPenPointer && event.pointerType !== 'mouse') {
			logDrawingInput('pointerdown-ignored-touch-fallback', event);
			preventDrawingDefault(event);
			return;
		}

		if (event.pointerType === 'touch') {
			if (isPenMode) {
				preventDrawingDefault(event);
				if (currentDrawingType === 'touch') cancelDrawing();
			}
			return;
		}

		let nextDrawingType: DrawingInputType | null = null;

		if (isPenPointer) {
			nextDrawingType = 'pen';
		} else if (event.pointerType === 'mouse' && !isPenMode) {
			if (event.button !== 0) return;
			nextDrawingType = 'mouse';
		}

		if (!nextDrawingType) return;

		preventDrawingDefault(event);
		activePointerId = event.pointerId;
		activePointers.set(event.pointerId, {
			type: nextDrawingType,
			x: event.clientX,
			y: event.clientY
		});
		setPointerCaptureSafely(event);

		if (nextDrawingType === 'pen') {
			isPenActive = true;
			setPenMode(true);
		}

		currentDrawingType = nextDrawingType;
		startDrawing(event.clientX, event.clientY, event.target);

		if (!drawing) {
			resetDrawingState();
			return;
		}

		attachPointerListeners();
	}

	function handlePointermove(event: PointerEvent) {
		if (activePointerId !== event.pointerId) {
			return;
		}

		preventDrawingDefault(event);

		const activePointer =
			activePointers.get(event.pointerId) ||
			(currentDrawingType
				? {
						type: currentDrawingType,
						x: event.clientX,
						y: event.clientY
					}
				: null);
		if (!activePointer) return;
		activePointers.set(event.pointerId, {
			...activePointer,
			x: event.clientX,
			y: event.clientY
		});

		if (currentDrawingType === 'mouse' && event.buttons === 0) {
			activePointerId = null;
			currentDrawingType = null;
			endDrawing();
			detachPointerListeners();
			return;
		}

		if (currentDrawingType === activePointer.type) {
			continueDrawing(event);
		}
	}

	function handlePointerup(event: PointerEvent) {
		if (activePointerId !== event.pointerId) {
			activePointers.delete(event.pointerId);
			return;
		}

		preventDrawingDefault(event);
		const endingDrawingType = currentDrawingType;
		activePointerId = null;
		activePointers.delete(event.pointerId);
		releasePointerCaptureSafely(event.pointerId);

		if (endingDrawingType === 'pen') {
			isPenActive = false;
			currentDrawingType = null;
			endDrawing();
		} else if (endingDrawingType === 'mouse' && !isPenMode) {
			currentDrawingType = null;
			endDrawing();
		}

		detachPointerListeners();
	}

	function handlePointercancel(event: PointerEvent) {
		logDrawingInput('pointercancel', event);
		if (activePointerId === event.pointerId) {
			recordPointerReliabilityFailure('pointercancel');
			preventDrawingDefault(event);
			activePointerId = null;
			releasePointerCaptureSafely(event.pointerId);
			cancelActiveStroke('pointercancel');
			return;
		}

		activePointers.delete(event.pointerId);
		releasePointerCaptureSafely(event.pointerId);
	}

	function handleGotPointerCapture(event: PointerEvent) {
		capturedPointerId = event.pointerId;
	}

	function handleLostPointerCapture(event: PointerEvent) {
		logDrawingInput('lostpointercapture', event);
		if (capturedPointerId === event.pointerId) {
			capturedPointerId = null;
		}

		if (activePointerId === event.pointerId && drawing) {
			recordPointerReliabilityFailure('lostpointercapture');
			if (isIOSSafari() && isPenLikePointerEvent(event)) {
				logDrawingInput('lostpointercapture-ignored-ios-pen', event);
				return;
			}
			cancelActiveStroke('lostpointercapture');
		}
	}

	function shouldAllowTouchDrawing() {
		return !isPenMode;
	}

	function getActiveTouch(touches: TouchList) {
		if (activeTouchId === null) return null;

		for (const touch of Array.from(touches)) {
			if (touch.identifier === activeTouchId) return touch;
		}

		return null;
	}

	function handleTouchStart(event: TouchEvent) {
		logDrawingInput('touchstart', event);
		if (event.touches.length !== 1) {
			if (currentDrawingType === 'touch') cancelDrawing();
			return;
		}

		if (!shouldAllowTouchDrawing()) {
			preventDrawingDefault(event);
			if (currentDrawingType === 'touch') cancelDrawing();
			return;
		}

		preventDrawingDefault(event);
		clearStaleDrawingState('new-touchstart');

		const touch = event.touches[0];
		activeTouchId = touch.identifier;
		activeTouches.set(touch.identifier, {
			x: touch.clientX,
			y: touch.clientY
		});

		if (!isPenActive || useTouchFallback) {
			currentDrawingType = 'touch';
			startDrawing(touch.clientX, touch.clientY, touch.target);
		}

		if (!drawing) {
			resetDrawingState();
			return;
		}

		attachTouchListeners();
	}

	function handleTouchmove(event: TouchEvent) {
		if (event.touches.length > 1) {
			if (currentDrawingType === 'touch') cancelDrawing();
			return;
		}

		if (!shouldAllowTouchDrawing()) {
			preventDrawingDefault(event);
			if (currentDrawingType === 'touch') cancelDrawing();
			return;
		}

		const touch = getActiveTouch(event.touches);
		if (!touch) {
			preventDrawingDefault(event);
			cancelActiveStroke('touchcancel');
			return;
		}

		preventDrawingDefault(event);
		activeTouches.set(touch.identifier, {
			x: touch.clientX,
			y: touch.clientY
		});

		if ((!isPenActive || useTouchFallback) && currentDrawingType === 'touch') {
			continueDrawing(touch);
		}
	}

	function handleTouchend(event: TouchEvent) {
		if (!shouldAllowTouchDrawing()) {
			preventDrawingDefault(event);
			return;
		}

		preventDrawingDefault(event);
		let endedActiveTouch = false;
		for (const touch of event.changedTouches) {
			activeTouches.delete(touch.identifier);
			if (touch.identifier === activeTouchId) endedActiveTouch = true;
		}

		if (endedActiveTouch && currentDrawingType === 'touch') {
			activeTouchId = null;
			currentDrawingType = null;
			endDrawing();
		}

		if (activeTouchId === null) {
			detachTouchListeners();
		}
	}

	function handleTouchcancel(event: TouchEvent) {
		preventDrawingDefault(event);
		cancelActiveStroke('touchcancel');
	}

	function startDrawing(clientX: number, clientY: number, target: EventTarget | null) {
		strokePageScale = pageScale;
		drawing = liveStroke.start(clientX, clientY, target);
		logDrawingInput(drawing ? 'stroke-started' : 'stroke-start-rejected', undefined, {
			clientX,
			clientY,
			target: describeTarget(target)
		});
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
		cancelActiveStroke('reset');
	}

	function finish() {
		const drawingData = liveStroke.finish(strokePageScale, true);
		if (!drawingData) {
			cancelActiveStroke('reset');
			return;
		}

		try {
			onFinishDrawing({
				originWidth: drawingData.originWidth,
				originHeight: drawingData.originHeight,
				path: drawingData.path,
				brushSize,
				brushColor,
				brushOpacity
			});
		} finally {
			detachPointerListeners();
			detachTouchListeners();
			clearPointerReliabilityFailures();
			resetDrawingState();
			notifyStrokeEnd();
		}
	}
</script>

<div
	bind:this={canvas}
	class="drawing-input-layer absolute top-0 left-0 h-full w-full select-none"
	style="cursor: {isPenMode ? 'crosshair' : 'crosshair'};"
>
	<canvas bind:this={previewCanvas} class="drawing-preview-canvas pointer-events-none h-full w-full"></canvas>
</div>

<style>
	.drawing-input-layer,
	.drawing-preview-canvas {
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		overscroll-behavior: contain;
	}
</style>
