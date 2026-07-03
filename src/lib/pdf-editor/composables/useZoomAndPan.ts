/**
 * useZoomAndPan Composable
 *
 * Manages zoom controls and touch gesture handling for the PDF editor.
 */

import { getPDFEditorContext } from '../context/pdfEditorContext.svelte';
import {
	clampPdfZoom,
	MAX_PDF_ZOOM,
	MIN_PDF_ZOOM,
	PDF_ZOOM_STEP,
	SOFT_MIN_PDF_ZOOM
} from '../utils/zoomLimits';
import { canReleaseCameraRedraw } from '../utils/cameraRedrawGate';

type ScrollRootGetter = () => HTMLElement | null | undefined;

function isIOSLikeDevice() {
	if (typeof navigator === 'undefined') return false;

	return (
		/iPad|iPhone|iPod/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
	);
}

export function useZoomAndPan(getScrollRoot?: ScrollRootGetter) {
	const ctx = getPDFEditorContext();

	let initialDistance: number | null = null;
	let initialCenter: { x: number; y: number } | null = null;
	let gestureType: 'pinch' | 'pan' | null = null;
	let gestureScrollStartX = 0;
	let gestureScrollStartY = 0;

	// Hand mode panning state
	let isPanning = false;
	let panStartX = 0;
	let panStartY = 0;
	let scrollStartX = 0;
	let scrollStartY = 0;
	let panMaxScrollX = 0;
	let panMaxScrollY = 0;
	let pendingScrollX = 0;
	let pendingScrollY = 0;
	let panFrame: number | null = null;
	let documentPanListenersAttached = false;
	let zoomAnchorFrame: number | null = null;
	let zoomSettleTimeout: ReturnType<typeof setTimeout> | null = null;
	let cameraIdleTimeout: ReturnType<typeof setTimeout> | null = null;
	let panningReleaseTimeout: ReturnType<typeof setTimeout> | null = null;
	let momentumFrame: number | null = null;
	let isMomentumScrolling = false;
	let momentumLastTime = 0;
	let lastPanSampleTime = 0;
	let lastPanSampleX = 0;
	let lastPanSampleY = 0;
	let panVelocityX = 0;
	let panVelocityY = 0;
	let pendingZoomCorrection: {
		anchor: { element: HTMLElement; ratioX: number; ratioY: number };
		centerX: number;
		centerY: number;
	} | null = null;
	let lastZoomAnchorElement: HTMLElement | null = null;

	// Double-tap to zoom state
	let lastTapTime = 0;
	let lastTapPosition: { x: number; y: number } | null = null;
	const DOUBLE_TAP_DELAY = 300; // ms
	const DOUBLE_TAP_DISTANCE = 50; // pixels
	const MOMENTUM_MIN_VELOCITY = 0.25; // px/ms
	const MOMENTUM_MAX_VELOCITY = 2.2; // px/ms
	const MOMENTUM_FRICTION = 0.0048;
	const SMOOTH_ZOOM_DURATION = 300;
	const OVERRIDE_ZOOM_STEP = 0.1;
	const CAMERA_IDLE_DELAY = 140;
	const PANNING_RELEASE_DELAY = 100;
	const ZOOM_ANCHOR_REUSE_MARGIN = 160;

	// Smooth transition state
	let transitionTimeout: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Enable smooth transitions temporarily
	 */
	function enableSmoothTransition(duration = 300) {
		ctx.state.smoothTransition = true;
		if (transitionTimeout) clearTimeout(transitionTimeout);
		transitionTimeout = setTimeout(() => {
			ctx.state.smoothTransition = false;
		}, duration);
	}

	/**
	 * Disable smooth transitions immediately
	 */
	function disableSmoothTransition() {
		ctx.state.smoothTransition = false;
		if (transitionTimeout) clearTimeout(transitionTimeout);
	}

	function clearCameraIdleTimeout() {
		if (cameraIdleTimeout) {
			clearTimeout(cameraIdleTimeout);
			cameraIdleTimeout = null;
		}
	}

	function clearPanningReleaseTimeout() {
		if (panningReleaseTimeout) {
			clearTimeout(panningReleaseTimeout);
			panningReleaseTimeout = null;
		}
	}

	function setCameraPanningActive() {
		clearPanningReleaseTimeout();
		if (!ctx.state.isPanning) {
			ctx.state.isPanning = true;
		}
	}

	function scheduleCameraPanningRelease(delay = PANNING_RELEASE_DELAY) {
		clearPanningReleaseTimeout();

		panningReleaseTimeout = setTimeout(() => {
			panningReleaseTimeout = null;

			if (isPanning || isMomentumScrolling || gestureType !== null) {
				return;
			}

			ctx.state.isPanning = false;
			scheduleCameraIdle();
		}, delay);
	}

	function markCameraInteraction(mode: 'panning' | 'zooming') {
		if (ctx.state.isDrawingStroke) return;

		clearCameraIdleTimeout();
		if (ctx.state.activeInteraction !== mode) {
			ctx.state.activeInteraction = mode;
		}
		const nextIsZooming = mode === 'zooming';
		if (ctx.state.isZooming !== nextIsZooming) {
			ctx.state.isZooming = nextIsZooming;
		}
		if (!ctx.state.deferAnnotationRedraw) {
			ctx.state.deferAnnotationRedraw = true;
		}
	}

	function scheduleCameraIdle(delay = CAMERA_IDLE_DELAY) {
		clearCameraIdleTimeout();

		cameraIdleTimeout = setTimeout(() => {
			cameraIdleTimeout = null;

			if (
				!canReleaseCameraRedraw({
					isDrawingStroke: ctx.state.isDrawingStroke,
					isPanning,
					isMomentumScrolling,
					hasGesture: gestureType !== null
				})
			) {
				scheduleCameraIdle(delay);
				return;
			}

			ctx.state.isZooming = false;
			ctx.state.deferAnnotationRedraw = false;
			if (ctx.state.activeInteraction === 'panning' || ctx.state.activeInteraction === 'zooming') {
				ctx.state.activeInteraction = 'idle';
			}
			ctx.state.cameraRevision += 1;
		}, delay);
	}

	/**
	 * Coalesce high-frequency drag/touch scroll updates into one scroll per frame.
	 */
	function scheduleScrollTo(x: number, y: number) {
		markCameraInteraction('panning');
		pendingScrollX = x;
		pendingScrollY = y;

		if (panFrame !== null) return;

		panFrame = requestAnimationFrame(() => {
			panFrame = null;
			scrollToPosition(pendingScrollX, pendingScrollY);
		});
	}

	function resetPanVelocity() {
		const scrollPosition = getScrollPosition();
		lastPanSampleTime = performance.now();
		lastPanSampleX = scrollPosition.x;
		lastPanSampleY = scrollPosition.y;
		panVelocityX = 0;
		panVelocityY = 0;
	}

	function recordPanTarget(x: number, y: number) {
		const now = performance.now();

		if (lastPanSampleTime > 0) {
			const elapsed = now - lastPanSampleTime;
			if (elapsed > 0) {
				const nextVelocityX = (x - lastPanSampleX) / elapsed;
				const nextVelocityY = (y - lastPanSampleY) / elapsed;
				panVelocityX = panVelocityX * 0.55 + nextVelocityX * 0.45;
				panVelocityY = panVelocityY * 0.55 + nextVelocityY * 0.45;
			}
		}

		lastPanSampleTime = now;
		lastPanSampleX = x;
		lastPanSampleY = y;
	}

	function endMomentumScroll() {
		momentumFrame = null;
		isMomentumScrolling = false;

		if (!isPanning && gestureType === null) {
			scheduleCameraPanningRelease();
		}
	}

	function cancelMomentum() {
		if (momentumFrame !== null) {
			cancelAnimationFrame(momentumFrame);
		}

		if (isMomentumScrolling) {
			endMomentumScroll();
		} else {
			momentumFrame = null;
		}
	}

	function flushPendingPanScroll() {
		if (panFrame === null) return;

		cancelAnimationFrame(panFrame);
		panFrame = null;
		scrollToPosition(pendingScrollX, pendingScrollY);
	}

	function clampVelocity(value: number) {
		return clampNumber(value, -MOMENTUM_MAX_VELOCITY, MOMENTUM_MAX_VELOCITY);
	}

	function startMomentumScroll() {
		cancelMomentum();
		flushPendingPanScroll();

		let velocityX = clampVelocity(panVelocityX);
		let velocityY = clampVelocity(panVelocityY);
		if (Math.hypot(velocityX, velocityY) < MOMENTUM_MIN_VELOCITY) return false;

		isMomentumScrolling = true;
		setCameraPanningActive();
		markCameraInteraction('panning');
		momentumLastTime = performance.now();

		const step = (time: number) => {
			const elapsed = Math.min(32, time - momentumLastTime);
			momentumLastTime = time;

			velocityX *= Math.exp(-MOMENTUM_FRICTION * elapsed);
			velocityY *= Math.exp(-MOMENTUM_FRICTION * elapsed);

			if (Math.hypot(velocityX, velocityY) < 0.02) {
				endMomentumScroll();
				return;
			}

			const scrollPosition = getScrollPosition();
			const nextX = clampNumber(scrollPosition.x + velocityX * elapsed, 0, panMaxScrollX);
			const nextY = clampNumber(scrollPosition.y + velocityY * elapsed, 0, panMaxScrollY);

			if (nextX === scrollPosition.x && nextY === scrollPosition.y) {
				endMomentumScroll();
				return;
			}

			scrollToPosition(nextX, nextY);
			momentumFrame = requestAnimationFrame(step);
		};

		momentumFrame = requestAnimationFrame(step);
		return true;
	}

	function removeDocumentPanListeners() {
		if (typeof document === 'undefined' || !documentPanListenersAttached) return;

		document.removeEventListener('mousemove', handleDocumentPanning);
		document.removeEventListener('mouseup', handleDocumentPanEnd);
		document.removeEventListener('mouseleave', handleDocumentPanEnd);
		documentPanListenersAttached = false;
	}

	function handleDocumentPanning(e: MouseEvent) {
		handlePanning(e);
	}

	function handleDocumentPanEnd() {
		stopPanning();
	}

	function clampNumber(value: number, min: number, max: number) {
		if (min > max) return min;
		return Math.max(min, Math.min(value, max));
	}

	function getSoftZoomMin() {
		return ctx.state.zoom <= SOFT_MIN_PDF_ZOOM ? MIN_PDF_ZOOM : SOFT_MIN_PDF_ZOOM;
	}

	function getActiveScrollRoot() {
		return getScrollRoot?.() ?? null;
	}

	function getScrollPosition() {
		const scrollRoot = getActiveScrollRoot();

		if (scrollRoot) {
			return {
				x: scrollRoot.scrollLeft,
				y: scrollRoot.scrollTop
			};
		}

		return {
			x: window.scrollX,
			y: window.scrollY
		};
	}

	function scrollToPosition(left: number, top: number, behavior?: ScrollBehavior) {
		const scrollRoot = getActiveScrollRoot();

		if (scrollRoot) {
			if (!behavior) {
				if (scrollRoot.scrollLeft !== left) scrollRoot.scrollLeft = left;
				if (scrollRoot.scrollTop !== top) scrollRoot.scrollTop = top;
				return;
			}

			scrollRoot.scrollTo({
				left,
				top,
				behavior
			});
			return;
		}

		if (!behavior) {
			window.scrollTo(left, top);
			return;
		}

		window.scrollTo({
			left,
			top,
			behavior
		});
	}

	function getDocumentMaxScroll() {
		const scrollRoot = getActiveScrollRoot();

		if (scrollRoot) {
			return {
				x: Math.max(0, scrollRoot.scrollWidth - scrollRoot.clientWidth),
				y: Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight)
			};
		}

		const root = document.documentElement;
		const body = document.body;
		const viewport = getViewportMetrics();

		return {
			x: Math.max(
				0,
				Math.max(root?.scrollWidth || 0, body?.scrollWidth || 0) - viewport.width
			),
			y: Math.max(
				0,
				Math.max(root?.scrollHeight || 0, body?.scrollHeight || 0) - viewport.height
			)
		};
	}

	function getViewportMetrics() {
		const scrollRoot = getActiveScrollRoot();

		if (scrollRoot) {
			const rect = scrollRoot.getBoundingClientRect();

			return {
				offsetLeft: 0,
				offsetTop: 0,
				left: rect.left,
				top: rect.top,
				width: scrollRoot.clientWidth,
				height: scrollRoot.clientHeight
			};
		}

		const viewport = window.visualViewport;

		return {
			offsetLeft: viewport?.offsetLeft ?? 0,
			offsetTop: viewport?.offsetTop ?? 0,
			left: 0,
			top: 0,
			width: viewport?.width ?? window.innerWidth,
			height: viewport?.height ?? window.innerHeight
		};
	}

	function refreshPanBounds() {
		const maxScroll = getDocumentMaxScroll();
		panMaxScrollX = maxScroll.x;
		panMaxScrollY = maxScroll.y;
	}

	function getDocumentPoint(clientX: number, clientY: number) {
		const scrollRoot = getActiveScrollRoot();

		if (scrollRoot) {
			const rootRect = scrollRoot.getBoundingClientRect();

			return {
				x: scrollRoot.scrollLeft + clientX - rootRect.left,
				y: scrollRoot.scrollTop + clientY - rootRect.top
			};
		}

		const viewport = getViewportMetrics();

		return {
			x: window.scrollX + viewport.offsetLeft + clientX,
			y: window.scrollY + viewport.offsetTop + clientY
		};
	}

	function getElementDocumentRect(element: HTMLElement) {
		const rect = element.getBoundingClientRect();
		const scrollRoot = getActiveScrollRoot();

		if (scrollRoot) {
			const rootRect = scrollRoot.getBoundingClientRect();

			return {
				left: scrollRoot.scrollLeft + rect.left - rootRect.left,
				top: scrollRoot.scrollTop + rect.top - rootRect.top,
				width: rect.width,
				height: rect.height
			};
		}

		const viewport = getViewportMetrics();

		return {
			left: window.scrollX + viewport.offsetLeft + rect.left,
			top: window.scrollY + viewport.offsetTop + rect.top,
			width: rect.width,
			height: rect.height
		};
	}

	function getDistanceToRect(rect: DOMRect, x: number, y: number) {
		const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
		const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
		return Math.hypot(dx, dy);
	}

	function getPageZoomAnchor(centerX: number, centerY: number) {
		if (typeof document === 'undefined') return null;

		if (lastZoomAnchorElement?.isConnected) {
			const rect = lastZoomAnchorElement.getBoundingClientRect();
			if (
				rect.width > 0 &&
				rect.height > 0 &&
				centerX >= rect.left - ZOOM_ANCHOR_REUSE_MARGIN &&
				centerX <= rect.right + ZOOM_ANCHOR_REUSE_MARGIN &&
				centerY >= rect.top - ZOOM_ANCHOR_REUSE_MARGIN &&
				centerY <= rect.bottom + ZOOM_ANCHOR_REUSE_MARGIN
			) {
				const documentPoint = getDocumentPoint(centerX, centerY);
				const documentRect = getElementDocumentRect(lastZoomAnchorElement);

				return {
					element: lastZoomAnchorElement,
					ratioX: clampNumber(
						(documentPoint.x - documentRect.left) / documentRect.width,
						0,
						1
					),
					ratioY: clampNumber(
						(documentPoint.y - documentRect.top) / documentRect.height,
						0,
						1
					)
				};
			}
		}

		const directPageElement = document
			.elementsFromPoint(centerX, centerY)
			.find((element) => element instanceof HTMLElement && element.closest('[data-minimap-page]'))
			?.closest<HTMLElement>('[data-minimap-page]');
		const pageElement =
			directPageElement ||
			Array.from(document.querySelectorAll<HTMLElement>('[data-minimap-page]'))
				.map((element) => ({ element, rect: element.getBoundingClientRect() }))
				.filter(({ rect }) => rect.width > 0 && rect.height > 0)
				.sort(
					(a, b) =>
						getDistanceToRect(a.rect, centerX, centerY) -
						getDistanceToRect(b.rect, centerX, centerY)
				)[0]?.element;

		if (!pageElement) return null;

		lastZoomAnchorElement = pageElement;
		const rect = pageElement.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return null;
		const documentPoint = getDocumentPoint(centerX, centerY);
		const documentRect = getElementDocumentRect(pageElement);

		return {
			element: pageElement,
			ratioX: clampNumber((documentPoint.x - documentRect.left) / documentRect.width, 0, 1),
			ratioY: clampNumber((documentPoint.y - documentRect.top) / documentRect.height, 0, 1)
		};
	}

	function scheduleZoomAnchorCorrection() {
		if (zoomAnchorFrame !== null) return;

		zoomAnchorFrame = requestAnimationFrame(() => {
			zoomAnchorFrame = null;
			const correction = pendingZoomCorrection;
			pendingZoomCorrection = null;
			if (!correction) return;

			const rect = getElementDocumentRect(correction.anchor.element);
			const viewport = getViewportMetrics();
			const targetX = rect.left + rect.width * correction.anchor.ratioX;
			const targetY = rect.top + rect.height * correction.anchor.ratioY;
			const maxScroll = getDocumentMaxScroll();
			const scrollRoot = getActiveScrollRoot();
			const viewportCenterX = scrollRoot
				? correction.centerX - viewport.left
				: correction.centerX + viewport.offsetLeft;
			const viewportCenterY = scrollRoot
				? correction.centerY - viewport.top
				: correction.centerY + viewport.offsetTop;

			scrollToPosition(
				clampNumber(targetX - viewportCenterX, 0, maxScroll.x),
				clampNumber(targetY - viewportCenterY, 0, maxScroll.y),
				'instant' as ScrollBehavior
			);
		});
	}

	function correctScrollToZoomAnchor(
		anchor: ReturnType<typeof getPageZoomAnchor>,
		centerX: number,
		centerY: number,
		settleDelay = 0
	) {
		if (!anchor) return;

		if (zoomSettleTimeout !== null) {
			clearTimeout(zoomSettleTimeout);
			zoomSettleTimeout = null;
		}

		pendingZoomCorrection = { anchor, centerX, centerY };
		scheduleZoomAnchorCorrection();

		if (settleDelay > 0) {
			zoomSettleTimeout = setTimeout(() => {
				zoomSettleTimeout = null;
				if (!anchor.element.isConnected) return;

				pendingZoomCorrection = { anchor, centerX, centerY };
				scheduleZoomAnchorCorrection();
			}, settleDelay);
		}
	}

	/**
	 * Zoom at a specific point (preserves position)
	 */
	function zoomAtPoint(newZoom: number, centerX?: number, centerY?: number, useTransition = false) {
		newZoom = clampPdfZoom(newZoom);
		if (newZoom === ctx.state.zoom) return;
		cancelMomentum();
		markCameraInteraction('zooming');

		// Enable smooth transition if requested
		if (useTransition) {
			enableSmoothTransition();
		}

		// If no specific point provided, use viewport center
		if (centerX === undefined || centerY === undefined) {
			const viewport = getViewportMetrics();
			centerX = viewport.left + viewport.width / 2;
			centerY = viewport.top + viewport.height / 2;
		}
		const pendingAnchor = pendingZoomCorrection?.anchor;
		const pageAnchor = pendingAnchor?.element.isConnected
			? pendingAnchor
			: getPageZoomAnchor(centerX, centerY);

		// Update zoom
		ctx.state.zoom = newZoom;

		// Keep the same point on the editable PDF under the cursor/viewport center.
		// This stays accurate even when the whiteboard padding or side-page layout does not scale.
		correctScrollToZoomAnchor(
			pageAnchor,
			centerX,
			centerY,
			useTransition ? SMOOTH_ZOOM_DURATION + 50 : 0
		);
		scheduleCameraIdle(useTransition ? SMOOTH_ZOOM_DURATION + 80 : CAMERA_IDLE_DELAY);
	}

	/**
	 * Zoom in
	 */
	function handleZoomIn() {
		if (ctx.state.zoom < MAX_PDF_ZOOM) {
			zoomAtPoint(ctx.state.zoom + PDF_ZOOM_STEP, undefined, undefined, true);
		}
	}

	/**
	 * Zoom out
	 */
	function handleZoomOut() {
		if (ctx.state.zoom > MIN_PDF_ZOOM) {
			const minZoom = ctx.state.zoom <= SOFT_MIN_PDF_ZOOM ? MIN_PDF_ZOOM : SOFT_MIN_PDF_ZOOM;
			const zoomStep = ctx.state.zoom <= SOFT_MIN_PDF_ZOOM ? OVERRIDE_ZOOM_STEP : PDF_ZOOM_STEP;
			zoomAtPoint(
				clampPdfZoom(ctx.state.zoom - zoomStep, minZoom),
				undefined,
				undefined,
				true
			);
		}
	}

	/**
	 * Handle Ctrl+wheel zoom without triggering browser zoom.
	 */
	function handleWheelZoom(e: WheelEvent) {
		if (!e.ctrlKey && !e.metaKey) return;

		if (e.cancelable) {
			e.preventDefault();
		}

		e.stopPropagation();
		disableSmoothTransition();

		const zoomFactor = Math.exp(-e.deltaY * 0.001);
		const newZoom = clampPdfZoom(ctx.state.zoom * zoomFactor, getSoftZoomMin());

		zoomAtPoint(newZoom, e.clientX, e.clientY);
	}

	/**
	 * Reset zoom to default (100%)
	 */
	function handleResetZoom() {
		cancelMomentum();
		enableSmoothTransition();
		markCameraInteraction('zooming');
		ctx.state.zoom = 2;
		scheduleCameraIdle(SMOOTH_ZOOM_DURATION + 80);
	}

	/**
	 * Toggle zoom enabled/disabled
	 */
	function handleZoomToggle() {
		ctx.state.zoomEnabled = !ctx.state.zoomEnabled;
	}

	/**
	 * Handle touch move for pinch-zoom and pan
	 */
	function onTouchMove(e: TouchEvent) {
		if (e.touches.length === 2) {
			cancelMomentum();
			e.preventDefault(); // Block native zoom
			e.stopPropagation(); // iOS Safari fix

			// Disable smooth transitions during pinch-zoom
			disableSmoothTransition();

			const touch1 = e.touches[0];
			const touch2 = e.touches[1];

			const dx = touch1.clientX - touch2.clientX;
			const dy = touch1.clientY - touch2.clientY;
			const distance = Math.hypot(dx, dy);

			const centerX = (touch1.clientX + touch2.clientX) / 2;
			const centerY = (touch1.clientY + touch2.clientY) / 2;
			const currentCenter = { x: centerX, y: centerY };

			if (initialDistance === null) {
				// First frame with two fingers
				const scrollPosition = getScrollPosition();
				initialDistance = distance;
				initialCenter = currentCenter;
				gestureScrollStartX = scrollPosition.x;
				gestureScrollStartY = scrollPosition.y;
				refreshPanBounds();
				resetPanVelocity();
				gestureType = null;
			} else {
				const distanceChange = Math.abs(distance - initialDistance);
				const centerMovement = Math.hypot(
					currentCenter.x - initialCenter!.x,
					currentCenter.y - initialCenter!.y
				);

				const PINCH_THRESHOLD = 10; // adjust as needed
				const PAN_THRESHOLD = 5; // adjust as needed

				if (!gestureType) {
					// Decide gesture type on first significant move
					if (distanceChange > PINCH_THRESHOLD) {
						gestureType = 'pinch';
					} else if (centerMovement > PAN_THRESHOLD) {
						gestureType = 'pan';
					}
				}

				if (gestureType === 'pinch' && ctx.state.zoomEnabled) {
					setCameraPanningActive();

					// Handle pinch with center point
					const scaleChange = distance / initialDistance;
					const newZoom = clampPdfZoom(ctx.state.zoom * scaleChange, getSoftZoomMin());

					// Use the pinch center point for zooming
					zoomAtPoint(newZoom, currentCenter.x, currentCenter.y);

					initialDistance = distance; // update baseline
				} else if (gestureType === 'pan') {
					const panDeltaX = currentCenter.x - initialCenter!.x;
					const panDeltaY = currentCenter.y - initialCenter!.y;
					const targetX = clampNumber(gestureScrollStartX - panDeltaX, 0, panMaxScrollX);
					const targetY = clampNumber(gestureScrollStartY - panDeltaY, 0, panMaxScrollY);

					setCameraPanningActive();
					recordPanTarget(targetX, targetY);
					scheduleScrollTo(targetX, targetY);
				}
			}
		}
	}

	/**
	 * Handle touch end
	 */
	function onTouchEnd(e: TouchEvent) {
		if (e.touches.length < 2) {
			let momentumStarted = false;
			if (gestureType === 'pan') {
				momentumStarted = startMomentumScroll();
			}

			// Reset gesture state
			initialDistance = null;
			initialCenter = null;
			gestureScrollStartX = 0;
			gestureScrollStartY = 0;
			gestureType = null;
			if (!momentumStarted) {
				scheduleCameraPanningRelease();
			}
		}
	}

	/**
	 * Handle double-tap to zoom (only in hand mode and if enabled)
	 */
	function onDoubleTap(e: TouchEvent) {
		// Only allow double-tap zoom in hand mode and if enabled
		if (!ctx.state.isHandMode || !ctx.state.doubleTapZoomEnabled) {
			lastTapTime = 0;
			lastTapPosition = null;
			return;
		}

		if (e.touches.length !== 1) return;

		const touch = e.touches[0];
		const currentTime = Date.now();
		const currentPosition = { x: touch.clientX, y: touch.clientY };

		// Check if this is a double-tap
		if (
			lastTapTime &&
			currentTime - lastTapTime < DOUBLE_TAP_DELAY &&
			lastTapPosition
		) {
			const distance = Math.hypot(
				currentPosition.x - lastTapPosition.x,
				currentPosition.y - lastTapPosition.y
			);

			if (distance < DOUBLE_TAP_DISTANCE) {
				e.preventDefault();

				// Toggle zoom: if zoomed in, zoom out; if zoomed out, zoom in
				if (ctx.state.zoom > 2) {
					// Zoom out to default
					zoomAtPoint(2, currentPosition.x, currentPosition.y, true);
				} else {
					// Zoom in
					zoomAtPoint(ctx.state.zoom + 1, currentPosition.x, currentPosition.y, true);
				}

				// Reset tap tracking
				lastTapTime = 0;
				lastTapPosition = null;
				return;
			}
		}

		// Record this tap
		lastTapTime = currentTime;
		lastTapPosition = currentPosition;
	}

	/**
	 * Start panning (hand mode)
	 */
	function startPanning(e: MouseEvent) {
		if (!ctx.state.isHandMode) return;
		if (e.button !== 0) return;
		cancelMomentum();

		isPanning = true;
		panStartX = e.clientX;
		panStartY = e.clientY;
		const scrollPosition = getScrollPosition();
		scrollStartX = scrollPosition.x;
		scrollStartY = scrollPosition.y;
		refreshPanBounds();
		resetPanVelocity();
		setCameraPanningActive();
		markCameraInteraction('panning');

		if (typeof document !== 'undefined') {
			removeDocumentPanListeners();
			document.addEventListener('mousemove', handleDocumentPanning);
			document.addEventListener('mouseup', handleDocumentPanEnd);
			document.addEventListener('mouseleave', handleDocumentPanEnd);
			documentPanListenersAttached = true;
		}
	}

	/**
	 * Handle panning movement
	 */
	function handlePanning(e: MouseEvent) {
		if (!isPanning || !ctx.state.isHandMode) return;

		const deltaX = e.clientX - panStartX;
		const deltaY = e.clientY - panStartY;
		const targetX = clampNumber(scrollStartX - deltaX, 0, panMaxScrollX);
		const targetY = clampNumber(scrollStartY - deltaY, 0, panMaxScrollY);

		recordPanTarget(targetX, targetY);
		scheduleScrollTo(targetX, targetY);
	}

	/**
	 * Stop panning
	 */
	function stopPanning() {
		let momentumStarted = false;
		if (isPanning) {
			momentumStarted = startMomentumScroll();
		}

		isPanning = false;
		if (!momentumStarted) {
			scheduleCameraPanningRelease();
		}
		removeDocumentPanListeners();
	}

	function resetPointerState() {
		initialDistance = null;
		initialCenter = null;
		gestureScrollStartX = 0;
		gestureScrollStartY = 0;
		gestureType = null;
		isPanning = false;
		lastTapTime = 0;
		lastTapPosition = null;
		clearPanningReleaseTimeout();
		ctx.state.isPanning = false;
		removeDocumentPanListeners();
		disableSmoothTransition();

		if (panFrame !== null) {
			cancelAnimationFrame(panFrame);
			panFrame = null;
		}
		cancelMomentum();

		if (zoomAnchorFrame !== null) {
			cancelAnimationFrame(zoomAnchorFrame);
			zoomAnchorFrame = null;
			pendingZoomCorrection = null;
		}
		lastZoomAnchorElement = null;
		if (zoomSettleTimeout !== null) {
			clearTimeout(zoomSettleTimeout);
			zoomSettleTimeout = null;
		}
		clearCameraIdleTimeout();
		ctx.state.isZooming = false;
		ctx.state.deferAnnotationRedraw = false;
		if (ctx.state.activeInteraction === 'panning' || ctx.state.activeInteraction === 'zooming') {
			ctx.state.activeInteraction = 'idle';
		}
	}

	function cancelLowPriorityMotion() {
		resetPointerState();
		clearCameraIdleTimeout();
	}

	/**
	 * Start panning (hand mode) - Touch version
	 */
	function startPanningTouch(e: TouchEvent) {
		if (!ctx.state.isHandMode) return;
		if (e.touches.length !== 1) return;
		cancelMomentum();

		const touch = e.touches[0];
		isPanning = true;
		panStartX = touch.clientX;
		panStartY = touch.clientY;
		const scrollPosition = getScrollPosition();
		scrollStartX = scrollPosition.x;
		scrollStartY = scrollPosition.y;
		refreshPanBounds();
		resetPanVelocity();
		setCameraPanningActive();
		markCameraInteraction('panning');
	}

	/**
	 * Handle panning movement - Touch version
	 */
	function handlePanningTouch(e: TouchEvent) {
		if (!isPanning || !ctx.state.isHandMode) return;
		if (e.touches.length !== 1) return;

		if (isIOSLikeDevice() && e.cancelable) {
			e.preventDefault(); // iOS Safari fix: prevent momentum scrolling
			e.stopPropagation();
		}

		const touch = e.touches[0];
		const deltaX = touch.clientX - panStartX;
		const deltaY = touch.clientY - panStartY;
		const targetX = clampNumber(scrollStartX - deltaX, 0, panMaxScrollX);
		const targetY = clampNumber(scrollStartY - deltaY, 0, panMaxScrollY);

		recordPanTarget(targetX, targetY);
		scheduleScrollTo(targetX, targetY);
	}

	return {
		get smoothTransition() {
			return ctx.state.smoothTransition;
		},
		zoomAtPoint,
		handleZoomIn,
		handleZoomOut,
		handleWheelZoom,
		handleResetZoom,
		handleZoomToggle,
		onTouchMove,
		onTouchEnd,
		onDoubleTap,
		startPanning,
		handlePanning,
		stopPanning,
		resetPointerState,
		cancelLowPriorityMotion,
		startPanningTouch,
		handlePanningTouch
	};
}
