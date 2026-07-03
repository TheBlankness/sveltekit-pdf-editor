<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		LucidePlus,
		LucideMinus,
		LucideMaximize2,
		LucideChevronLeft,
		LucideChevronRight
	} from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	import { getPDFEditorContext } from '../../context/pdfEditorContext.svelte';
	import {
		MAX_PDF_ZOOM,
		MIN_PDF_ZOOM,
		PDF_ZOOM_STEP,
		pdfZoomFromPercent,
		pdfZoomToPercent
	} from '../../utils/zoomLimits';
	import { getPathGeometry, getTransformedDrawingBBox } from '../../utils/hitTest';
	import { createRenderSignature, mixRenderSignature } from '../../utils/renderSignature';
	import { getCappedDevicePixelRatio } from '../../utils/annotationRendering';
	import { getTeacherMarkColorPreset } from '../../utils/teacherMarkPresets';
	import type { DrawingObject } from '../../utils/hitTest';

	type MiniAnnotationObject = Omit<Partial<DrawingObject>, 'id'> & {
		id?: string | number;
		height?: number;
		strokeWidth?: number;
		size?: number;
		lines?: unknown[];
		stampColor?: string;
	};

	interface Props {
		zoom: number;
		currentPage: number;
		maxPage: number;
		pageWidth?: number;
		pageHeight?: number;
		pageObjectsByPage?: Record<number, MiniAnnotationObject[]>;
		layoutKey?: string;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onResetZoom: () => void;
		onZoomToFit?: () => void;
		onSetZoom?: (zoom: number) => void;
		scrollRoot?: HTMLElement;
		disabled?: boolean;
	}

	let {
		zoom,
		currentPage,
		maxPage,
		pageWidth = 595, // Default A4 width in points
		pageHeight = 842, // Default A4 height in points
		pageObjectsByPage = {},
		layoutKey = '',
		onZoomIn,
		onZoomOut,
		onResetZoom,
		onZoomToFit,
		onSetZoom,
		scrollRoot = undefined,
		disabled = false
	}: Props = $props();

	const MINIMAP_COMPACT_STORAGE_KEY = 'pdf-editor-minimap-compact';

	let isMenuOpen = $state(false);
	let isCompact = $state(false);
	let isDragging = $state(false);
	let isMinimapActive = $derived(!isCompact || isMenuOpen || isDragging);
	let expandedMinimapRef: HTMLDivElement | null = $state(null);
	let miniMinimapRef: HTMLDivElement | null = $state(null);
	let expandedAnnotationCanvasRef: HTMLCanvasElement | null = $state(null);
	let miniAnnotationCanvasRef: HTMLCanvasElement | null = $state(null);
	const ctx = getPDFEditorContext();
	let toolbarPosition = $derived(ctx.state.toolbarPosition);
	let shouldAvoidBottomToolbar = $state(false);
	let minimapPages = $state<
		Array<{
			pageNo: number;
			x: number;
			y: number;
			width: number;
			height: number;
			isCurrent: boolean;
		}>
	>([]);
	let sceneBounds = $state({ x: 0, y: 0, width: 1, height: 1 });

	let suppressNextMinimapClick = false;
	let stopActiveMinimapPan: (() => void) | null = null;
	let annotationDrawFrame: number | null = null;

	onMount(() => {
		try {
			isCompact = localStorage.getItem(MINIMAP_COMPACT_STORAGE_KEY) === 'true';
		} catch {
			// Local storage can be unavailable in private browsing or restricted contexts.
		}
	});

	// Viewport tracking
	let scrollX = $state(0);
	let scrollY = $state(0);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);

	type MiniAnnotationBox = { x: number; y: number; width: number; height: number };
	const miniAnnotationBoxCache = new Map<string, { key: number; box: MiniAnnotationBox | null }>();
	const miniAnnotationSignatureCache = new Map<string, { key: number; snapshot: unknown[] }>();
	let miniAnnotationSignatureCounter = 1;
	let miniAnnotationDrawKey = $derived.by(() => getMiniAnnotationDrawSignature());

	function getMiniAnnotationDrawSignature() {
		let signature = createRenderSignature();

		for (const [pageNo, objects] of Object.entries(pageObjectsByPage)) {
			signature = mixRenderSignature(signature, Number(pageNo) || 0);
			signature = mixRenderSignature(signature, objects?.length || 0);

			objects?.forEach((object, index) => {
				signature = mixRenderSignature(signature, index);
				signature = mixRenderSignature(signature, getMiniAnnotationCacheKey(object || {}, index));
			});
		}

		return signature;
	}

	function getDocumentScrollWidth() {
		if (scrollRoot) return Math.max(scrollRoot.scrollWidth, scrollRoot.clientWidth, viewportWidth);
		if (typeof document === 'undefined') return viewportWidth;
		const root = document.documentElement;
		const body = document.body;
		const scrollingElement = document.scrollingElement;
		return Math.max(
			scrollingElement?.scrollWidth || 0,
			root?.scrollWidth || 0,
			body?.scrollWidth || 0,
			root?.offsetWidth || 0,
			body?.offsetWidth || 0,
			viewportWidth
		);
	}

	function getDocumentScrollHeight() {
		if (scrollRoot)
			return Math.max(scrollRoot.scrollHeight, scrollRoot.clientHeight, viewportHeight);
		if (typeof document === 'undefined') return viewportHeight;
		const root = document.documentElement;
		const body = document.body;
		const scrollingElement = document.scrollingElement;
		return Math.max(
			scrollingElement?.scrollHeight || 0,
			root?.scrollHeight || 0,
			body?.scrollHeight || 0,
			root?.offsetHeight || 0,
			body?.offsetHeight || 0,
			viewportHeight
		);
	}

	// Calculate zoom percentage
	let zoomPercentage = $derived(pdfZoomToPercent(zoom));

	// Common zoom presets
	const zoomPresets = [50, 100, 200, 250];

	// Minimap dimensions
	const MINIMAP_WIDTH = 220;
	const MINIMAP_HEIGHT = 140;
	const MINIMAP_PADDING = 8;
	const MINI_MINIMAP_WIDTH = 150;
	const MINI_MINIMAP_HEIGHT = 86;
	const MINI_MINIMAP_PADDING = 8;
	const INSTANT_SCROLL_BEHAVIOR = 'instant' as 'auto';

	type MinimapMetrics = {
		width: number;
		height: number;
		padding: number;
		scale: number;
		contentWidth: number;
		contentHeight: number;
		offsetX: number;
		offsetY: number;
	};

	function getMinimapMetrics(width: number, height: number, padding: number): MinimapMetrics {
		const scale = Math.min(
			(width - padding * 2) / Math.max(sceneBounds.width, 1),
			(height - padding * 2) / Math.max(sceneBounds.height, 1)
		);
		const contentWidth = sceneBounds.width * scale;
		const contentHeight = sceneBounds.height * scale;

		return {
			width,
			height,
			padding,
			scale,
			contentWidth,
			contentHeight,
			offsetX: (width - contentWidth) / 2,
			offsetY: (height - contentHeight) / 2
		};
	}

	let expandedMinimapMetrics = $derived(
		getMinimapMetrics(MINIMAP_WIDTH, MINIMAP_HEIGHT, MINIMAP_PADDING)
	);
	let miniMinimapMetrics = $derived(
		getMinimapMetrics(MINI_MINIMAP_WIDTH, MINI_MINIMAP_HEIGHT, MINI_MINIMAP_PADDING)
	);
	let maxScrollX = $derived(
		typeof document === 'undefined'
			? 0
			: Math.max(
					0,
					Math.max(getDocumentScrollWidth(), sceneBounds.x + sceneBounds.width) - viewportWidth
				)
	);
	let maxScrollY = $derived(
		typeof document === 'undefined'
			? 0
			: Math.max(
					0,
					Math.max(getDocumentScrollHeight(), sceneBounds.y + sceneBounds.height) - viewportHeight
				)
	);
	let scrollXRatio = $derived(maxScrollX > 0 ? scrollX / maxScrollX : 0);
	let scrollYRatio = $derived(maxScrollY > 0 ? scrollY / maxScrollY : 0);

	// Update viewport and scroll tracking
	let rafId: number | null = null;

	function cancelViewportUpdate() {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	function updateMinimapPages() {
		if (!isMinimapActive || typeof document === 'undefined') return;

		const pageNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-minimap-page]'));
		const documentScrollWidth = getDocumentScrollWidth();
		const documentScrollHeight = getDocumentScrollHeight();

		if (pageNodes.length === 0) {
			sceneBounds = {
				x: 0,
				y: 0,
				width: Math.max(viewportWidth, documentScrollWidth, pageWidth * zoom),
				height: Math.max(viewportHeight, documentScrollHeight, pageHeight * zoom)
			};
			minimapPages = [
				{
					pageNo: currentPage,
					x: scrollX + (viewportWidth - pageWidth * zoom) / 2,
					y: scrollY + (viewportHeight - pageHeight * zoom) / 2,
					width: pageWidth * zoom,
					height: pageHeight * zoom,
					isCurrent: true
				}
			];
			return;
		}

		const nextPages = pageNodes
			.map((node) => {
				const rect = node.getBoundingClientRect();
				const rootRect = scrollRoot?.getBoundingClientRect();
				const pageNo = Number(node.dataset.minimapPage || currentPage);

				return {
					pageNo,
					x:
						scrollRoot && rootRect
							? scrollRoot.scrollLeft + rect.left - rootRect.left
							: rect.left + window.scrollX,
					y:
						scrollRoot && rootRect
							? scrollRoot.scrollTop + rect.top - rootRect.top
							: rect.top + window.scrollY,
					width: rect.width,
					height: rect.height,
					isCurrent: node.dataset.minimapCurrent === 'true'
				};
			})
			.filter((page) => page.width > 0 && page.height > 0);

		if (nextPages.length === 0) return;

		const left = Math.min(...nextPages.map((page) => page.x), scrollX);
		const top = Math.min(...nextPages.map((page) => page.y), scrollY);
		const right = Math.max(
			...nextPages.map((page) => page.x + page.width),
			scrollX + viewportWidth,
			documentScrollWidth
		);
		const bottom = Math.max(
			...nextPages.map((page) => page.y + page.height),
			scrollY + viewportHeight,
			documentScrollHeight
		);

		sceneBounds = {
			x: Math.min(0, left),
			y: Math.min(0, top),
			width: right - Math.min(0, left),
			height: bottom - Math.min(0, top)
		};
		minimapPages = nextPages;
	}

	function getScrollFromMinimapPoint(
		x: number,
		y: number,
		metrics: MinimapMetrics,
		centerViewport = true
	) {
		const boundedX = Math.max(metrics.offsetX, Math.min(metrics.offsetX + metrics.contentWidth, x));
		const boundedY = Math.max(
			metrics.offsetY,
			Math.min(metrics.offsetY + metrics.contentHeight, y)
		);
		const sceneX = (boundedX - metrics.offsetX) / metrics.scale + sceneBounds.x;
		const sceneY = (boundedY - metrics.offsetY) / metrics.scale + sceneBounds.y;

		return {
			x: Math.max(0, Math.min(maxScrollX, sceneX - (centerViewport ? viewportWidth / 2 : 0))),
			y: Math.max(0, Math.min(maxScrollY, sceneY - (centerViewport ? viewportHeight / 2 : 0)))
		};
	}

	function updateViewport() {
		if (!isMinimapActive || typeof window === 'undefined') {
			cancelViewportUpdate();
			return;
		}

		// Cancel any pending RAF to avoid multiple updates per frame
		cancelViewportUpdate();

		rafId = requestAnimationFrame(() => {
			if (!isMinimapActive) {
				rafId = null;
				return;
			}

			if (scrollRoot) {
				scrollX = scrollRoot.scrollLeft;
				scrollY = scrollRoot.scrollTop;
				viewportWidth = scrollRoot.clientWidth;
				viewportHeight = scrollRoot.clientHeight;
			} else {
				scrollX = window.pageXOffset || window.scrollX;
				scrollY = window.pageYOffset || window.scrollY;
				viewportWidth = window.innerWidth;
				viewportHeight = window.innerHeight;
			}
			updateMinimapPages();
			rafId = null;
		});
	}

	// Track scroll and resize events
	$effect(() => {
		if (!isMinimapActive || typeof window === 'undefined') {
			cancelViewportUpdate();
			return;
		}

		updateViewport();
		// Track whichever surface owns the editor scroll.
		if (scrollRoot) {
			scrollRoot.addEventListener('scroll', updateViewport, { passive: true });
		} else {
			window.addEventListener('scroll', updateViewport, { passive: true });
		}
		window.addEventListener('resize', updateViewport, { passive: true });

		return () => {
			cancelViewportUpdate();
			if (scrollRoot) {
				scrollRoot.removeEventListener('scroll', updateViewport);
			} else {
				window.removeEventListener('scroll', updateViewport);
			}
			window.removeEventListener('resize', updateViewport);
		};
	});

	$effect(() => {
		const resetPointerLocks = () => {
			stopActiveMinimapPan?.();
			stopActiveMinimapPan = null;
			isDragging = false;
			suppressNextMinimapClick = false;
		};

		window.addEventListener('pdf-editor-reset-pointer-locks', resetPointerLocks);

		return () => {
			window.removeEventListener('pdf-editor-reset-pointer-locks', resetPointerLocks);
			resetPointerLocks();
		};
	});

	// Get client coordinates from mouse or touch event
	function getClientCoordinates(e: MouseEvent | TouchEvent): { x: number; y: number } {
		if ('touches' in e && e.touches.length > 0) {
			return { x: e.touches[0].clientX, y: e.touches[0].clientY };
		} else if ('clientX' in e) {
			return { x: e.clientX, y: e.clientY };
		}
		return { x: 0, y: 0 };
	}

	function nonPassiveTouchStart(node: HTMLElement, handler: (event: TouchEvent) => void) {
		let currentHandler = handler;
		const listener = (event: TouchEvent) => currentHandler(event);

		node.addEventListener('touchstart', listener, { passive: false });

		return {
			update(handler: (event: TouchEvent) => void) {
				currentHandler = handler;
			},
			destroy() {
				node.removeEventListener('touchstart', listener);
			}
		};
	}

	function startMinimapPan(
		e: MouseEvent | TouchEvent,
		minimapNode: HTMLDivElement | null,
		getMetrics: () => MinimapMetrics
	) {
		if (!minimapNode || disabled) return;
		stopActiveMinimapPan?.();
		e.preventDefault();
		e.stopPropagation();
		isDragging = true;
		suppressNextMinimapClick = true;

		const moveToEventPoint = (event: MouseEvent | TouchEvent) => {
			if (!minimapNode) return;
			const rect = minimapNode.getBoundingClientRect();
			const coords = getClientCoordinates(event);
			const { x, y } = getScrollFromMinimapPoint(
				coords.x - rect.left,
				coords.y - rect.top,
				getMetrics()
			);

			if (scrollRoot) {
				scrollRoot.scrollTo({
					left: x,
					top: y,
					behavior: INSTANT_SCROLL_BEHAVIOR
				});
			} else {
				window.scrollTo({
					left: x,
					top: y,
					behavior: INSTANT_SCROLL_BEHAVIOR
				});
			}
			updateViewport();
		};

		moveToEventPoint(e);

		const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
			moveEvent.preventDefault();
			moveToEventPoint(moveEvent);
		};

		const handleEnd = () => {
			isDragging = false;
			document.removeEventListener('mousemove', handleMove);
			document.removeEventListener('mouseup', handleEnd);
			document.removeEventListener('touchmove', handleMove);
			document.removeEventListener('touchend', handleEnd);
			document.removeEventListener('touchcancel', handleEnd);
			stopActiveMinimapPan = null;
			setTimeout(() => {
				suppressNextMinimapClick = false;
			}, 0);
		};

		document.addEventListener('mousemove', handleMove);
		document.addEventListener('mouseup', handleEnd);
		document.addEventListener('touchmove', handleMove, { passive: false });
		document.addEventListener('touchend', handleEnd);
		document.addEventListener('touchcancel', handleEnd);
		stopActiveMinimapPan = handleEnd;
	}

	// Click/tap on minimap to jump to position (supports both mouse and touch)
	function handleMinimapClick(
		e: MouseEvent | TouchEvent,
		minimapNode: HTMLDivElement | null,
		getMetrics: () => MinimapMetrics
	) {
		if (!minimapNode || disabled || isDragging) return;
		if (suppressNextMinimapClick) {
			suppressNextMinimapClick = false;
			return;
		}

		// Prevent default to avoid scrolling on touch
		e.preventDefault();

		const rect = minimapNode.getBoundingClientRect();
		const coords = getClientCoordinates(e);
		const x = coords.x - rect.left;
		const y = coords.y - rect.top;
		const { x: newScrollX, y: newScrollY } = getScrollFromMinimapPoint(x, y, getMetrics());

		if (scrollRoot) {
			scrollRoot.scrollTo({
				left: newScrollX,
				top: newScrollY,
				behavior: INSTANT_SCROLL_BEHAVIOR
			});
		} else {
			window.scrollTo({
				left: newScrollX,
				top: newScrollY,
				behavior: INSTANT_SCROLL_BEHAVIOR
			});
		}
		updateViewport();
	}

	function handleZoomPreset(preset: number) {
		const targetZoom = pdfZoomFromPercent(preset);

		// If we have direct zoom control, use it for accurate zooming
		if (onSetZoom) {
			onSetZoom(targetZoom);
		} else {
			// Fallback to incremental zoom (less accurate)
			const currentPercent = pdfZoomToPercent(zoom);
			const diff = preset - currentPercent;
			const stepPercent = (PDF_ZOOM_STEP / 2) * 100;
			const steps = Math.ceil(Math.abs(diff) / stepPercent);

			if (diff > 0) {
				for (let i = 0; i < steps; i++) {
					setTimeout(() => onZoomIn(), i * 50);
				}
			} else {
				for (let i = 0; i < steps; i++) {
					setTimeout(() => onZoomOut(), i * 50);
				}
			}
		}
		isMenuOpen = false;
	}

	function getPageMiniStyle(
		page: { x: number; y: number; width: number; height: number },
		metrics: MinimapMetrics
	) {
		return `
			left: ${metrics.offsetX + (page.x - sceneBounds.x) * metrics.scale}px;
			top: ${metrics.offsetY + (page.y - sceneBounds.y) * metrics.scale}px;
			width: ${page.width * metrics.scale}px;
			height: ${page.height * metrics.scale}px;
		`;
	}

	function getMiniAnnotationCacheKey(object: MiniAnnotationObject, index = 0) {
		const cacheId = object.id ? `id:${object.id}` : `index:${index}`;
		const snapshot = [
			object.type || '',
			object.x || 0,
			object.y || 0,
			object.width || 0,
			object.height || 0,
			object.originWidth || 0,
			object.originHeight || 0,
			object.scale || 1,
			object.rotation || 0,
			object.brushSize || 1,
			object.strokeWidth || 0,
			object.size || 0,
			object.path || '',
			object.lines?.length || 0,
			object.stampColor || ''
		];
		const cached = miniAnnotationSignatureCache.get(cacheId);

		if (
			cached &&
			cached.snapshot.length === snapshot.length &&
			cached.snapshot.every((value, snapshotIndex) => value === snapshot[snapshotIndex])
		) {
			return cached.key;
		}

		const key = miniAnnotationSignatureCounter++;
		miniAnnotationSignatureCache.set(cacheId, { key, snapshot });
		return key;
	}

	function pruneMiniAnnotationBoxCache() {
		const liveIds = new Set<string>();
		Object.values(pageObjectsByPage).forEach((objects) => {
			objects?.forEach((object) => {
				if (object?.id) liveIds.add(String(object.id));
			});
		});

		for (const id of miniAnnotationBoxCache.keys()) {
			if (!liveIds.has(id)) {
				miniAnnotationBoxCache.delete(id);
			}
		}
	}

	function computeMiniAnnotationBox(
		object: MiniAnnotationObject | null | undefined
	): MiniAnnotationBox | null {
		if (!object) return null;

		if (object.type === 'line') {
			return {
				x: Math.min(object.x || 0, (object.x || 0) + (object.width || 0)),
				y: Math.min(object.y || 0, (object.y || 0) + (object.height || 0)),
				width: Math.max(Math.abs(object.width || 0), object.strokeWidth || 2),
				height: Math.max(Math.abs(object.height || 0), object.strokeWidth || 2)
			};
		}

		if ((object.type === 'drawing' || object.type === 'highlight') && object.path) {
			const scale =
				object.scale ??
				(object.originWidth ? (object.width || object.originWidth) / object.originWidth : 1);
			const pathBBox = getPathGeometry(object.path).bbox;
			if (pathBBox) {
				const transformedBox = getTransformedDrawingBBox(
					object as DrawingObject,
					pathBBox,
					Number.isFinite(scale) && scale !== 0 ? scale : 1,
					object.rotation || 0
				);
				const strokePadding = Math.max(1, ((object.brushSize || 2) * Math.abs(scale || 1)) / 2);

				return {
					x: transformedBox.x - strokePadding,
					y: transformedBox.y - strokePadding,
					width: Math.max(2, transformedBox.width + strokePadding * 2),
					height: Math.max(2, transformedBox.height + strokePadding * 2)
				};
			}

			return {
				x: object.x || 0,
				y: object.y || 0,
				width: Math.max(3, object.width || (object.originWidth || 24) * scale),
				height: Math.max(3, object.height || (object.originHeight || 24) * scale)
			};
		}

		if (object.type === 'text') {
			return {
				x: object.x || 0,
				y: object.y || 0,
				width: Math.max(12, object.width || 80),
				height: Math.max(8, (object.lines?.length || 1) * (object.size || 14) * 1.2)
			};
		}

		return {
			x: object.x || 0,
			y: object.y || 0,
			width: Math.max(8, object.width || 24),
			height: Math.max(8, object.height || 18)
		};
	}

	function getMiniAnnotationBox(object: MiniAnnotationObject) {
		if (!object?.id) return computeMiniAnnotationBox(object);

		const id = String(object.id);
		const key = getMiniAnnotationCacheKey(object);
		const cached = miniAnnotationBoxCache.get(id);
		if (cached?.key === key) return cached.box;

		const box = computeMiniAnnotationBox(object);
		miniAnnotationBoxCache.set(id, { key, box });
		return box;
	}

	function getMiniAnnotationColor(object: MiniAnnotationObject) {
		if (object?.type === 'highlight') return 'rgb(253 224 71 / 0.7)';
		if (object?.type === 'text') return 'rgb(14 165 233 / 0.75)';
		if (object?.type === 'line') return 'rgb(244 63 94 / 0.8)';
		if (object?.type === 'teacher-mark') return getTeacherMarkColorPreset(object.stampColor).border;
		return 'rgb(249 115 22 / 0.65)';
	}

	function ensureMiniAnnotationCanvasSize(
		canvas: HTMLCanvasElement,
		context: CanvasRenderingContext2D,
		metrics: MinimapMetrics
	) {
		const dpr = getCappedDevicePixelRatio();
		const bitmapWidth = Math.max(1, Math.round(metrics.width * dpr));
		const bitmapHeight = Math.max(1, Math.round(metrics.height * dpr));

		if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
			canvas.width = bitmapWidth;
			canvas.height = bitmapHeight;
		}

		context.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function drawMiniAnnotationCanvas(canvas: HTMLCanvasElement | null, metrics: MinimapMetrics) {
		if (!canvas) return;

		const context = canvas.getContext('2d');
		if (!context) return;

		ensureMiniAnnotationCanvasSize(canvas, context, metrics);
		context.clearRect(0, 0, metrics.width, metrics.height);

		for (const page of minimapPages) {
			const objects = pageObjectsByPage[page.pageNo] || [];
			if (objects.length === 0) continue;

			const pageX = metrics.offsetX + (page.x - sceneBounds.x) * metrics.scale;
			const pageY = metrics.offsetY + (page.y - sceneBounds.y) * metrics.scale;
			const pageMiniWidth = page.width * metrics.scale;
			const pageMiniHeight = page.height * metrics.scale;

			context.save();
			context.beginPath();
			context.rect(pageX, pageY, pageMiniWidth, pageMiniHeight);
			context.clip();

			for (const object of objects) {
				const box = getMiniAnnotationBox(object);
				if (!box) continue;

				const annotationX = pageX + (box.x / pageWidth) * pageMiniWidth;
				const annotationY = pageY + (box.y / pageHeight) * pageMiniHeight;
				const annotationWidth = Math.max(1.5, (box.width / pageWidth) * pageMiniWidth);
				const annotationHeight = Math.max(1.5, (box.height / pageHeight) * pageMiniHeight);

				context.fillStyle = getMiniAnnotationColor(object);
				context.fillRect(annotationX, annotationY, annotationWidth, annotationHeight);
			}

			context.restore();
		}
	}

	function drawMiniAnnotationCanvases() {
		if (!isMinimapActive) return;

		drawMiniAnnotationCanvas(expandedAnnotationCanvasRef, expandedMinimapMetrics);
		drawMiniAnnotationCanvas(miniAnnotationCanvasRef, miniMinimapMetrics);
	}

	function scheduleMiniAnnotationCanvasDraw() {
		if (annotationDrawFrame !== null) return;

		if (typeof requestAnimationFrame === 'undefined') {
			drawMiniAnnotationCanvases();
			return;
		}

		annotationDrawFrame = requestAnimationFrame(() => {
			annotationDrawFrame = null;
			drawMiniAnnotationCanvases();
		});
	}

	function getViewportIndicatorStyle(metrics: MinimapMetrics) {
		const indicatorWidth = Math.min(
			metrics.contentWidth,
			Math.max(8, viewportWidth * metrics.scale)
		);
		const indicatorHeight = Math.min(
			metrics.contentHeight,
			Math.max(8, viewportHeight * metrics.scale)
		);
		const indicatorX = Math.max(
			metrics.offsetX,
			Math.min(
				metrics.offsetX + metrics.contentWidth - indicatorWidth,
				metrics.offsetX + (scrollX - sceneBounds.x) * metrics.scale
			)
		);
		const indicatorY = Math.max(
			metrics.offsetY,
			Math.min(
				metrics.offsetY + metrics.contentHeight - indicatorHeight,
				metrics.offsetY + (scrollY - sceneBounds.y) * metrics.scale
			)
		);

		return `
			left: ${indicatorX}px;
			top: ${indicatorY}px;
			width: ${indicatorWidth}px;
			height: ${indicatorHeight}px;
			touch-action: none;
		`;
	}

	function toggleMenu() {
		if (!disabled) {
			isMenuOpen = !isMenuOpen;
		}
	}

	function toggleCompact() {
		if (disabled) return;
		isCompact = !isCompact;
		try {
			localStorage.setItem(MINIMAP_COMPACT_STORAGE_KEY, String(isCompact));
		} catch {
			// Ignore storage failures; the toggle should still work for this session.
		}
		if (isCompact) {
			isMenuOpen = false;
			stopActiveMinimapPan?.();
			stopActiveMinimapPan = null;
			isDragging = false;
		}
	}

	// Close menu when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.minimap-zoom-control')) {
			isMenuOpen = false;
		}
	}

	$effect(() => {
		if (isMenuOpen) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});

	$effect(() => {
		if (!isMinimapActive) return;

		zoom;
		currentPage;
		pageObjectsByPage;
		layoutKey;
		updateViewport();
	});

	$effect(() => {
		if (!isMinimapActive) return;

		expandedAnnotationCanvasRef;
		miniAnnotationCanvasRef;
		minimapPages;
		sceneBounds;
		expandedMinimapMetrics;
		miniMinimapMetrics;
		pageWidth;
		pageHeight;
		miniAnnotationDrawKey;
		scheduleMiniAnnotationCanvasDraw();
	});

	$effect(() => {
		pageObjectsByPage;
		pruneMiniAnnotationBoxCache();
	});

	$effect(() => {
		const mediaQuery = window.matchMedia('(max-width: 529px)');
		const updateDocking = () => {
			shouldAvoidBottomToolbar = mediaQuery.matches;
		};

		updateDocking();
		mediaQuery.addEventListener('change', updateDocking);

		return () => {
			mediaQuery.removeEventListener('change', updateDocking);
		};
	});

	onDestroy(() => {
		if (annotationDrawFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
			cancelAnimationFrame(annotationDrawFrame);
		}
		miniAnnotationBoxCache.clear();
		miniAnnotationSignatureCache.clear();
	});
</script>

<!-- Fixed positioning to prevent iOS zoom issues -->
<div
	class="minimap-zoom-control fixed left-4 z-[80] transition-[bottom] duration-300"
	class:bottom-24={toolbarPosition === 'bottom' && shouldAvoidBottomToolbar}
	class:bottom-4={toolbarPosition !== 'bottom' || !shouldAvoidBottomToolbar}
	style="touch-action: manipulation; -webkit-user-select: none; user-select: none;"
>
	<!-- Zoom Menu Popup -->
	{#if isMenuOpen}
		<div
			transition:fly={{ y: 10, duration: 200 }}
			class="absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
			style="pointer-events: auto;"
		>
			<!-- Interactive Minimap Visualization -->
			<div class="border-b border-gray-200 bg-gray-50 p-3">
				<div class="mb-2 text-xs font-medium text-gray-600">
					Workspace - page {currentPage} of {maxPage}
				</div>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					bind:this={expandedMinimapRef}
					onmousedown={(event) =>
						startMinimapPan(event, expandedMinimapRef, () => expandedMinimapMetrics)}
					onclick={(event) =>
						handleMinimapClick(event, expandedMinimapRef, () => expandedMinimapMetrics)}
					use:nonPassiveTouchStart={(event) =>
						startMinimapPan(event, expandedMinimapRef, () => expandedMinimapMetrics)}
					class="relative rounded border border-gray-300 bg-white"
					class:cursor-grab={!isDragging && !disabled}
					class:cursor-grabbing={isDragging}
					style="width: {MINIMAP_WIDTH}px; height: {MINIMAP_HEIGHT}px; touch-action: none;"
				>
					{#each minimapPages as page (page.pageNo)}
						<div
							class="absolute overflow-hidden rounded-sm border bg-white shadow-sm"
							class:border-amber-500={page.isCurrent}
							class:border-gray-300={!page.isCurrent}
							class:ring-2={page.isCurrent}
							class:ring-amber-200={page.isCurrent}
							style={getPageMiniStyle(page, expandedMinimapMetrics)}
						>
							<span
								class="minimap-page-number"
								class:minimap-page-number--two-digit={page.pageNo >= 10 && page.pageNo < 100}
								class:minimap-page-number--three-digit={page.pageNo >= 100}
								class:minimap-page-number--current={page.isCurrent}
								aria-hidden="true"
							>
								{page.pageNo}
							</span>
						</div>
					{/each}

					<canvas
						bind:this={expandedAnnotationCanvasRef}
						class="pointer-events-none absolute inset-0 block"
						style="width: {MINIMAP_WIDTH}px; height: {MINIMAP_HEIGHT}px;"
						aria-hidden="true"
					></canvas>

					<!-- Viewport indicator (draggable) -->
					<div
						class="pointer-events-none absolute rounded border-2 border-blue-500 bg-blue-100/25 transition-opacity"
						class:cursor-grabbing={isDragging}
						class:opacity-80={isDragging}
						style={getViewportIndicatorStyle(expandedMinimapMetrics)}
					></div>
				</div>
				<div class="mt-2 text-xs text-gray-500">
					{zoomPercentage}% • {Math.round(scrollXRatio * 100)}%H, {Math.round(scrollYRatio * 100)}%V
				</div>
			</div>

			<!-- Zoom Controls -->
			<div class="p-2">
				<!-- Quick Zoom Buttons -->
				<div class="mb-2 flex items-center justify-between gap-1">
					<button
						onclick={onZoomOut}
						disabled={disabled || zoom <= MIN_PDF_ZOOM}
						class="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
						title="Zoom out"
					>
						<LucideMinus size={14} />
					</button>

					<button
						onclick={onResetZoom}
						{disabled}
						class="flex-1 rounded px-2 py-1 text-xs font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
						title="Reset and center editing page"
					>
						Reset view
					</button>

					<button
						onclick={onZoomIn}
						disabled={disabled || zoom >= MAX_PDF_ZOOM}
						class="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
						title="Zoom in"
					>
						<LucidePlus size={14} />
					</button>
				</div>

				<!-- Divider -->
				<div class="my-2 border-t border-gray-200"></div>

				<!-- Zoom Presets -->
				<div class="space-y-1">
					{#each zoomPresets as preset}
						<button
							onclick={() => handleZoomPreset(preset)}
							{disabled}
							class="flex w-full items-center justify-between rounded px-3 py-1.5 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
							class:bg-blue-50={zoomPercentage === preset}
							class:text-blue-600={zoomPercentage === preset}
							class:font-medium={zoomPercentage === preset}
						>
							<span>{preset}%</span>
							{#if zoomPercentage === preset}
								<span class="text-xs">✓</span>
							{/if}
						</button>
					{/each}
				</div>

				<!-- Zoom to Fit (optional) -->
				{#if onZoomToFit}
					<div class="mt-2 border-t border-gray-200 pt-2">
						<button
							onclick={() => {
								onZoomToFit();
								isMenuOpen = false;
							}}
							{disabled}
							class="flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
						>
							<LucideMaximize2 size={14} />
							<span>Fit to screen</span>
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if isCompact}
		<div
			class="flex h-10 overflow-hidden rounded-lg border border-gray-300 bg-white shadow-lg"
			class:ring-2={isMenuOpen}
			class:ring-blue-400={isMenuOpen}
			style="pointer-events: auto;"
		>
			<button
				onclick={toggleMenu}
				{disabled}
				class="flex min-w-[64px] items-center justify-center px-3 text-sm font-semibold text-gray-800 transition-all hover:bg-gray-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
				title="Zoom controls"
			>
				{zoomPercentage}%
			</button>

			<div class="my-2 w-px bg-gray-200"></div>

			<button
				onclick={toggleCompact}
				{disabled}
				class="flex w-10 items-center justify-center transition-all hover:bg-gray-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
				title="Show minimap"
			>
				<LucideChevronRight size={16} class="text-gray-600" />
			</button>
		</div>
	{:else}
		<div
			class="overflow-hidden rounded-lg border border-gray-300 bg-gray-100 shadow-lg"
			class:ring-2={isMenuOpen}
			class:ring-blue-400={isMenuOpen}
			style="width: 166px; pointer-events: auto;"
		>
			<div class="flex h-9 items-center justify-between px-2">
				<button
					onclick={onZoomOut}
					disabled={disabled || zoom <= MIN_PDF_ZOOM}
					class="flex h-7 w-7 items-center justify-center rounded hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40"
					title="Zoom out"
				>
					<LucideMinus size={14} />
				</button>

				<button
					onclick={toggleMenu}
					{disabled}
					class="min-w-[56px] rounded px-2 py-1 text-xs font-semibold text-gray-900 hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40"
					title="Zoom controls"
				>
					{zoomPercentage}%
				</button>

				<button
					onclick={onZoomIn}
					disabled={disabled || zoom >= MAX_PDF_ZOOM}
					class="flex h-7 w-7 items-center justify-center rounded hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40"
					title="Zoom in"
				>
					<LucidePlus size={14} />
				</button>

				<button
					onclick={toggleCompact}
					{disabled}
					class="flex h-7 w-7 items-center justify-center rounded hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40"
					title="Hide minimap"
				>
					<LucideChevronLeft size={14} />
				</button>
			</div>

			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				bind:this={miniMinimapRef}
				onmousedown={(event) => startMinimapPan(event, miniMinimapRef, () => miniMinimapMetrics)}
				onclick={(event) => handleMinimapClick(event, miniMinimapRef, () => miniMinimapMetrics)}
				use:nonPassiveTouchStart={(event) =>
					startMinimapPan(event, miniMinimapRef, () => miniMinimapMetrics)}
				class="relative mx-2 mb-2 overflow-hidden rounded-md bg-gray-50"
				class:cursor-grab={!isDragging && !disabled}
				class:cursor-grabbing={isDragging}
				style="width: {MINI_MINIMAP_WIDTH}px; height: {MINI_MINIMAP_HEIGHT}px; touch-action: none;"
				title="Drag or click to move around the document"
			>
				{#each minimapPages as page (page.pageNo)}
					<div
						class="absolute overflow-hidden rounded-[2px] border bg-white/90 shadow-sm"
						class:border-amber-500={page.isCurrent}
						class:border-gray-300={!page.isCurrent}
						class:ring-2={page.isCurrent}
						class:ring-amber-200={page.isCurrent}
						style={getPageMiniStyle(page, miniMinimapMetrics)}
					>
						<span
							class="minimap-page-number minimap-page-number--mini"
							class:minimap-page-number--two-digit={page.pageNo >= 10 && page.pageNo < 100}
							class:minimap-page-number--three-digit={page.pageNo >= 100}
							class:minimap-page-number--current={page.isCurrent}
							aria-hidden="true"
						>
							{page.pageNo}
						</span>
					</div>
				{/each}

				<canvas
					bind:this={miniAnnotationCanvasRef}
					class="pointer-events-none absolute inset-0 block"
					style="width: {MINI_MINIMAP_WIDTH}px; height: {MINI_MINIMAP_HEIGHT}px;"
					aria-hidden="true"
				></canvas>

				<div
					class="pointer-events-none absolute rounded border border-blue-500 bg-blue-100/25 transition-opacity"
					class:opacity-80={isDragging}
					style={getViewportIndicatorStyle(miniMinimapMetrics)}
				></div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Prevent iOS zoom on double tap */
	.minimap-zoom-control * {
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}

	.minimap-page-number {
		position: absolute;
		inset: 0;
		z-index: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		max-width: 100%;
		overflow: hidden;
		color: rgb(75 85 99 / 0.38);
		font-size: 22px;
		font-weight: 800;
		line-height: 1;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
		pointer-events: none;
		user-select: none;
	}

	.minimap-page-number--mini {
		font-size: 15px;
	}

	.minimap-page-number--two-digit {
		font-size: 18px;
	}

	.minimap-page-number--three-digit {
		font-size: 14px;
	}

	.minimap-page-number--mini.minimap-page-number--two-digit {
		font-size: 11px;
	}

	.minimap-page-number--mini.minimap-page-number--three-digit {
		font-size: 8px;
	}

	.minimap-page-number--current {
		color: rgb(146 64 14 / 0.42);
	}

	/* Smooth transitions */
	button {
		transition:
			background-color 150ms,
			transform 100ms,
			opacity 150ms;
	}

	/* Active state feedback */
	button:active:not(:disabled) {
		transform: scale(0.96);
	}

	/* Prevent text selection during drag */
	.cursor-grabbing,
	.cursor-grabbing * {
		user-select: none;
		-webkit-user-select: none;
	}
</style>
