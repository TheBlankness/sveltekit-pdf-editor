<script lang="ts">
	import { onDestroy } from 'svelte';
	import { useDocumentState } from '@embedpdf/core/svelte';
	import { useRenderCapability } from '@embedpdf/plugin-render/svelte';
	import { getCappedDevicePixelRatio } from './utils/annotationRendering';
	import { isIOSLikeDevice } from './utils/liveStroke';

	type RenderQualityMode = 'performance' | 'default' | 'sharp';

	let {
		documentId,
		pageIndex,
		zoom,
		width,
		height,
		isPanning = false,
		renderQualityMode = 'default',
		deferUpdates = false,
		visibilityRevision = 0,
		visibilityViewport = null
	}: {
		documentId: string;
		pageIndex: number;
		zoom: number;
		width: number;
		height: number;
		isPanning?: boolean;
		renderQualityMode?: RenderQualityMode;
		deferUpdates?: boolean;
		visibilityRevision?: number;
		visibilityViewport?: ViewportBounds | null;
	} = $props();

	const MIN_RENDER_SCALE = 0.1;
	type RenderProfile = {
		maxScale: number;
		maxDpr: number;
		panScale: number;
		panDpr: number;
		maxPixels: number;
		maxDimension: number;
	};

	const RENDER_PROFILES: Record<'performance' | 'default' | 'sharp', RenderProfile> = {
		performance: {
			maxScale: 1.5,
			maxDpr: 1,
			panScale: 1,
			panDpr: 1,
			maxPixels: 6000000,
			maxDimension: 4096
		},
		default: {
			maxScale: 2,
			maxDpr: 1,
			panScale: 1.25,
			panDpr: 1,
			maxPixels: 10000000,
			maxDimension: 4096
		},
		sharp: {
			maxScale: Number.POSITIVE_INFINITY,
			maxDpr: Number.POSITIVE_INFINITY,
			panScale: Number.POSITIVE_INFINITY,
			panDpr: Number.POSITIVE_INFINITY,
			maxPixels: 16000000,
			maxDimension: 4096
		}
	};
	const PDF_ERROR_CANCELLED = 9;
	const TILE_OUTPUT_SIZE = 768;
	const TILE_BUFFER_SCREEN_PX = 320;
	const STANDARD_MAX_VISIBLE_TILES = 32;
	const LOW_END_MAX_VISIBLE_TILES = 24;
	const LOW_END_MAX_HARDWARE_CONCURRENCY = 4;
	const POST_PAN_SHARP_RENDER_DELAY_MS = 150;
	const IOS_DEFAULT_RENDER_DPR = 1;
	const cancelReason = { code: PDF_ERROR_CANCELLED, message: 'canceled render task' };
	const ignoreRenderError = () => {};
	const renderCapability = useRenderCapability();
	const documentState = useDocumentState(() => documentId);

	let imageUrl: string | null = $state(null);
	let displayedUrl: string | null = null;
	let pendingDisplayedUrl: string | null = null;
	let pageElement: HTMLDivElement | undefined = $state();
	let visibleTileRects = $state<RenderTileRect[]>([]);
	let visibleTiles: RenderedTile[] = $state([]);
	let visibleTileUrls: string[] = [];
	let pendingVisibleTiles: RenderedTile[] | null = null;
	let pendingVisibleTileUrls: string[] = [];
	let activeRenderQualityMode = $state<RenderQualityMode>(renderQualityMode);
	let wasRenderInteractionLive = false;
	let postPanPerformanceRenderPending = false;
	let postPanRenderTimer: ReturnType<typeof setTimeout> | null = null;

	type RenderOptions = { scale: number; dpr: number; wasLimited: boolean };
	type RenderTileRect = {
		key: string;
		x: number;
		y: number;
		width: number;
		height: number;
	};
	type RenderedTile = RenderTileRect & { url: string };
	type ViewportBounds = {
		left: number;
		top: number;
		right: number;
		bottom: number;
	};

	function getMaxVisibleTiles() {
		if (typeof navigator === 'undefined') return STANDARD_MAX_VISIBLE_TILES;

		const coreCount = navigator.hardwareConcurrency || STANDARD_MAX_VISIBLE_TILES;
		return coreCount <= LOW_END_MAX_HARDWARE_CONCURRENCY
			? LOW_END_MAX_VISIBLE_TILES
			: STANDARD_MAX_VISIBLE_TILES;
	}

	function clearPostPanRenderTimer() {
		if (postPanRenderTimer) {
			clearTimeout(postPanRenderTimer);
			postPanRenderTimer = null;
		}
	}

	function finishPostPanPerformanceRender() {
		if (!postPanPerformanceRenderPending) return;

		postPanPerformanceRenderPending = false;
		clearPostPanRenderTimer();
		activeRenderQualityMode = renderQualityMode;
	}

	function startPostPanPerformanceRender() {
		revokePendingDisplayedUrl();
		revokePendingVisibleTiles();

		if (renderQualityMode !== 'sharp') {
			postPanPerformanceRenderPending = false;
			clearPostPanRenderTimer();
			activeRenderQualityMode = renderQualityMode;
			return;
		}

		postPanPerformanceRenderPending = true;
		activeRenderQualityMode = 'performance';
		clearPostPanRenderTimer();
		postPanRenderTimer = setTimeout(() => {
			postPanRenderTimer = null;
			finishPostPanPerformanceRender();
		}, POST_PAN_SHARP_RENDER_DELAY_MS);
	}

	function applyDisplayedUrl(url: string) {
		if (displayedUrl) {
			URL.revokeObjectURL(displayedUrl);
		}

		displayedUrl = url;
		imageUrl = url;
	}

	function queueDisplayedUrl(url: string) {
		if (pendingDisplayedUrl) {
			URL.revokeObjectURL(pendingDisplayedUrl);
		}

		pendingDisplayedUrl = url;
	}

	function revokePendingDisplayedUrl() {
		if (!pendingDisplayedUrl) return;

		URL.revokeObjectURL(pendingDisplayedUrl);
		pendingDisplayedUrl = null;
	}

	function revokeDisplayedUrl() {
		if (displayedUrl) {
			URL.revokeObjectURL(displayedUrl);
			displayedUrl = null;
		}
		imageUrl = null;
		revokePendingDisplayedUrl();
	}

	function revokeVisibleTiles() {
		for (const url of visibleTileUrls) {
			URL.revokeObjectURL(url);
		}
		visibleTileUrls = [];
		visibleTiles = [];
	}

	function revokePendingVisibleTiles() {
		for (const url of pendingVisibleTileUrls) {
			URL.revokeObjectURL(url);
		}

		pendingVisibleTileUrls = [];
		pendingVisibleTiles = null;
	}

	function queueVisibleTiles(tiles: RenderedTile[], urls: string[]) {
		const nextUrls = new Set(urls);
		for (const url of pendingVisibleTileUrls) {
			if (!nextUrls.has(url)) {
				URL.revokeObjectURL(url);
			}
		}

		pendingVisibleTiles = tiles;
		pendingVisibleTileUrls = urls;
	}

	function applyVisibleTiles(tiles: RenderedTile[], urls: string[]) {
		revokeVisibleTiles();
		visibleTiles = tiles;
		visibleTileUrls = urls;
	}

	function flushDeferredUpdates() {
		if (deferUpdates) return;

		if (pendingDisplayedUrl) {
			const url = pendingDisplayedUrl;
			pendingDisplayedUrl = null;
			applyDisplayedUrl(url);
		}

		if (pendingVisibleTiles) {
			const tiles = pendingVisibleTiles;
			const urls = pendingVisibleTileUrls;
			pendingVisibleTiles = null;
			pendingVisibleTileUrls = [];
			applyVisibleTiles(tiles, urls);
		}
	}

	function getSafeRenderOptions(
		requestedScale: number,
		requestedDpr: number,
		profile: RenderProfile
	): RenderOptions {
		const pageWidth = Math.max(1, width);
		const pageHeight = Math.max(1, height);
		const maxEffectiveScale = Math.max(
			0.01,
			Math.min(
				Math.sqrt(profile.maxPixels / (pageWidth * pageHeight)),
				profile.maxDimension / pageWidth,
				profile.maxDimension / pageHeight
			)
		);
		const minScale = Math.min(MIN_RENDER_SCALE, maxEffectiveScale);
		let scale = Math.max(minScale, requestedScale);
		let dpr = Math.max(1, requestedDpr);

		if (scale * dpr > maxEffectiveScale) {
			dpr = Math.max(1, Math.min(dpr, maxEffectiveScale / scale));
		}

		if (scale * dpr > maxEffectiveScale) {
			scale = Math.max(minScale, maxEffectiveScale / dpr);
		}

		return {
			scale,
			dpr,
			wasLimited: scale < requestedScale || dpr < requestedDpr
		};
	}

	function getRequestedRenderOptions() {
		const deviceDpr = getCappedDevicePixelRatio();
		const profile = RENDER_PROFILES[activeRenderQualityMode] || RENDER_PROFILES.default;
		const scaleLimit = isPanning ? profile.panScale : profile.maxScale;
		let dprLimit = isPanning ? profile.panDpr : profile.maxDpr;

		if (activeRenderQualityMode === 'default' && isIOSLikeDevice()) {
			dprLimit = Math.min(dprLimit, IOS_DEFAULT_RENDER_DPR);
		}

		return {
			profile,
			scale: Math.max(MIN_RENDER_SCALE, Math.min(zoom, scaleLimit)),
			dpr: Math.min(deviceDpr, dprLimit)
		};
	}

	function setVisibleTileRects(nextTiles: RenderTileRect[]) {
		if (
			visibleTileRects.length === nextTiles.length &&
			visibleTileRects.every((tile, index) => tile.key === nextTiles[index]?.key)
		) {
			return;
		}

		visibleTileRects = nextTiles;
	}

	function hasDocumentPage(document: any, page: number) {
		const pdfPage = document?.pages?.[page];
		return Boolean(pdfPage && (pdfPage.index === undefined || pdfPage.index === page));
	}

	function updateVisibleTileRects() {
		const node = pageElement;
		if (deferUpdates) return;

		if (!node || activeRenderQualityMode !== 'sharp' || isPanning) {
			setVisibleTileRects([]);
			return;
		}

		const requested = getRequestedRenderOptions();
		const safe = getSafeRenderOptions(requested.scale, requested.dpr, requested.profile);
		if (!safe.wasLimited) {
			setVisibleTileRects([]);
			return;
		}

		const rect = node.getBoundingClientRect();
		const scaleX = rect.width / Math.max(1, width);
		const scaleY = rect.height / Math.max(1, height);
		if (scaleX <= 0 || scaleY <= 0) {
			setVisibleTileRects([]);
			return;
		}

		const viewport =
			visibilityViewport ||
			(typeof window === 'undefined'
				? null
				: {
						left: 0,
						top: 0,
						right: window.innerWidth,
						bottom: window.innerHeight
					});
		if (!viewport) {
			setVisibleTileRects([]);
			return;
		}
		const viewportLeft = viewport.left - TILE_BUFFER_SCREEN_PX;
		const viewportTop = viewport.top - TILE_BUFFER_SCREEN_PX;
		const viewportRight = viewport.right + TILE_BUFFER_SCREEN_PX;
		const viewportBottom = viewport.bottom + TILE_BUFFER_SCREEN_PX;
		const left = Math.max(0, (viewportLeft - rect.left) / scaleX);
		const top = Math.max(0, (viewportTop - rect.top) / scaleY);
		const right = Math.min(width, (viewportRight - rect.left) / scaleX);
		const bottom = Math.min(height, (viewportBottom - rect.top) / scaleY);

		if (right <= left || bottom <= top) {
			setVisibleTileRects([]);
			return;
		}

		const tileWidth = Math.max(24, TILE_OUTPUT_SIZE / Math.max(1, requested.scale * requested.dpr));
		const tileHeight = tileWidth;
		const startX = Math.max(0, Math.floor(left / tileWidth) * tileWidth);
		const startY = Math.max(0, Math.floor(top / tileHeight) * tileHeight);
		const maxVisibleTiles = getMaxVisibleTiles();
		const nextTiles: RenderTileRect[] = [];

		for (let y = startY; y < bottom && nextTiles.length < maxVisibleTiles; y += tileHeight) {
			for (let x = startX; x < right && nextTiles.length < maxVisibleTiles; x += tileWidth) {
				const tileRight = Math.min(width, x + tileWidth);
				const tileBottom = Math.min(height, y + tileHeight);

				nextTiles.push({
					key: `${pageIndex}-${Math.round(requested.scale * 1000)}-${Math.round(requested.dpr * 1000)}-${Math.round(x * 10)}-${Math.round(y * 10)}-${Math.round(tileRight * 10)}-${Math.round(tileBottom * 10)}`,
					x,
					y,
					width: tileRight - x,
					height: tileBottom - y
				});
			}
		}

		setVisibleTileRects(nextTiles);
	}

	$effect(() => {
		if (isPanning) {
			wasRenderInteractionLive = true;
			postPanPerformanceRenderPending = false;
			clearPostPanRenderTimer();
			activeRenderQualityMode = renderQualityMode;
			return;
		}

		if (wasRenderInteractionLive) {
			wasRenderInteractionLive = false;
			startPostPanPerformanceRender();
			return;
		}

		if (!postPanPerformanceRenderPending) {
			activeRenderQualityMode = renderQualityMode;
		}
	});

	$effect(() => {
		const capability = renderCapability.provides;
		const document = documentState.current?.document;
		const docId = documentId;
		const page = pageIndex;
		const requested = getRequestedRenderOptions();
		const qualityMode = activeRenderQualityMode;
		const isPostPanPerformanceRender =
			postPanPerformanceRenderPending &&
			qualityMode === 'performance' &&
			renderQualityMode !== 'performance';
		const { scale, dpr } = getSafeRenderOptions(requested.scale, requested.dpr, requested.profile);

		if (!capability || !docId || !hasDocumentPage(document, page)) {
			revokeDisplayedUrl();
			return;
		}

		let isStale = false;
		let task;
		let taskPendingUrl: string | null = null;

		try {
			task = capability
				.forDocument(docId)
				.renderPage({ pageIndex: page, options: { scaleFactor: scale, dpr } });
		} catch {
			revokeDisplayedUrl();
			return;
		}

		task.wait((blob) => {
			const url = URL.createObjectURL(blob);

			if (isStale) {
				URL.revokeObjectURL(url);
				return;
			}

			if (deferUpdates) {
				taskPendingUrl = url;
				queueDisplayedUrl(url);
				if (isPostPanPerformanceRender) {
					finishPostPanPerformanceRender();
				}
				return;
			}

			applyDisplayedUrl(url);
			if (isPostPanPerformanceRender) {
				finishPostPanPerformanceRender();
			}
		}, ignoreRenderError);

		return () => {
			isStale = true;
			if (taskPendingUrl && pendingDisplayedUrl === taskPendingUrl) {
				pendingDisplayedUrl = null;
				URL.revokeObjectURL(taskPendingUrl);
			}
			try {
				task.abort(cancelReason);
			} catch {
				// A render task may already have completed by the time Svelte disposes this effect.
			}
		};
	});

	$effect(() => {
		pageElement;
		zoom;
		width;
		height;
		isPanning;
		renderQualityMode;
		activeRenderQualityMode;
		deferUpdates;
		visibilityRevision;
		visibilityViewport?.left;
		visibilityViewport?.top;
		visibilityViewport?.right;
		visibilityViewport?.bottom;

		updateVisibleTileRects();
	});

	$effect(() => {
		const capability = renderCapability.provides;
		const document = documentState.current?.document;
		const docId = documentId;
		const page = pageIndex;
		const requested = getRequestedRenderOptions();
		const tiles = visibleTileRects;

		if (!capability || !docId || tiles.length === 0 || !hasDocumentPage(document, page)) {
			revokeVisibleTiles();
			return;
		}

		let isStale = false;
		let visibleTilesRevoked = false;
		const tasks: Array<{ abort: (reason?: unknown) => void }> = [];
		const tileUrls: string[] = [];
		const nextRenderedTiles: RenderedTile[] = [];

		for (const tile of tiles) {
			let task;

			try {
				task = capability.forDocument(docId).renderPageRect({
					pageIndex: page,
					rect: {
						origin: { x: tile.x, y: tile.y },
						size: { width: tile.width, height: tile.height }
					},
					options: {
						scaleFactor: requested.scale,
						dpr: requested.dpr,
						imageType: 'image/webp',
						imageQuality: 0.92
					}
				});
			} catch {
				continue;
			}

			tasks.push(task);
			task.wait((blob) => {
				const url = URL.createObjectURL(blob);

				if (isStale) {
					URL.revokeObjectURL(url);
					return;
				}

				tileUrls.push(url);
				nextRenderedTiles.push({ ...tile, url });

				if (deferUpdates) {
					queueVisibleTiles([...nextRenderedTiles], [...tileUrls]);
					return;
				}

				if (!visibleTilesRevoked) {
					revokeVisibleTiles();
					visibleTilesRevoked = true;
				}

				visibleTileUrls.push(url);
				visibleTiles = [...nextRenderedTiles];
			}, ignoreRenderError);
		}

		return () => {
			isStale = true;
			for (const task of tasks) {
				try {
					task.abort(cancelReason);
				} catch {
					// A tile render may already have completed by the time Svelte disposes this effect.
				}
			}
			for (const url of tileUrls) {
				URL.revokeObjectURL(url);
			}
			visibleTileUrls = visibleTileUrls.filter((url) => !tileUrls.includes(url));
			if (pendingVisibleTileUrls.some((url) => tileUrls.includes(url))) {
				pendingVisibleTileUrls = pendingVisibleTileUrls.filter((url) => !tileUrls.includes(url));
				pendingVisibleTiles =
					pendingVisibleTiles?.filter((tile) => !tileUrls.includes(tile.url)) || null;
			}
			visibleTiles = [];
		};
	});

	$effect(() => {
		if (visibleTileRects.length === 0 && !deferUpdates) {
			revokeVisibleTiles();
		}
	});

	$effect(() => {
		deferUpdates;
		flushDeferredUpdates();
	});

	onDestroy(() => {
		clearPostPanRenderTimer();
		revokeDisplayedUrl();
		revokeVisibleTiles();
		revokePendingVisibleTiles();
	});
</script>

<div bind:this={pageElement} class="pointer-events-none absolute inset-0 overflow-hidden bg-white">
	{#if imageUrl}
		<img
			src={imageUrl}
			alt=""
			class="absolute inset-0 block"
			style="width: {width}px; height: {height}px;"
		/>
	{/if}
	{#each visibleTiles as tile (tile.key)}
		<img
			src={tile.url}
			alt=""
			class="absolute block"
			style="left: {tile.x}px; top: {tile.y}px; width: {tile.width}px; height: {tile.height}px;"
		/>
	{/each}
</div>
