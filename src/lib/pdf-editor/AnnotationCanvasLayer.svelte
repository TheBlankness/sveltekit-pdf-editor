<script lang="ts">
	import { onDestroy } from 'svelte';
	import { getPathGeometry } from './utils/hitTest';
	import {
		getAnnotationCanvasBackingScale,
		getCappedDevicePixelRatio
	} from './utils/annotationRendering';
	import {
		createRenderSignature,
		mixRenderSignature
	} from './utils/renderSignature';
	import type { BBox, Point } from './utils/hitTest';

	type StrokeVisibility = 'all' | 'self' | 'others';

	type DrawableAnnotation = {
		id?: string;
		type?: string;
		owner?: string;
		path?: string;
		x?: number;
		y?: number;
		width?: number;
		originWidth?: number;
		originHeight?: number;
		scale?: number;
		rotation?: number;
		brushSize?: number;
		brushColor?: string;
		opacity?: number;
		_eraserHighlight?: boolean;
	};

	type CachedGeometry = {
		key: string;
		path2d: Path2D | null;
		points: Point[];
		boundingBox: BBox | null;
	};

	let {
		objects = [],
		pageWidth,
		pageHeight,
		pageScale = 1,
		user = '',
		stroke_visibility = 'all',
		deferRedraw = false
	}: {
		objects?: DrawableAnnotation[];
		pageWidth: number;
		pageHeight: number;
		pageScale?: number;
		user?: string;
		stroke_visibility?: StrokeVisibility;
		deferRedraw?: boolean;
	} = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let drawFrame: number | null = null;
	let lastBitmapWidth = 0;
	let lastBitmapHeight = 0;
	let redrawDeferred = false;
	let wasDeferred = false;

	const geometryCache = new Map<string, CachedGeometry>();
	const objectSignatureCache = new Map<string, { signature: number; snapshot: unknown[] }>();
	let objectSignatureCounter = 1;
	let redrawKey = $derived.by(() => getRedrawSignature(objects));

	function getObjectSignature(object: DrawableAnnotation, index: number) {
		const cacheId = object.id ? `id:${object.id}` : `index:${index}`;
		const snapshot = [
			object.id,
			object.type || '',
			object.path || '',
			object.x || 0,
			object.y || 0,
			object.width || 0,
			object.originWidth || 0,
			object.originHeight || 0,
			object.scale || 1,
			object.rotation || 0,
			object.brushSize || 1,
			object.brushColor || '',
			object.opacity ?? 1,
			object.owner || '',
			object._eraserHighlight === true
		];
		const cached = objectSignatureCache.get(cacheId);

		if (
			cached &&
			cached.snapshot.length === snapshot.length &&
			cached.snapshot.every((value, snapshotIndex) => value === snapshot[snapshotIndex])
		) {
			return cached.signature;
		}

		const signature = objectSignatureCounter++;
		objectSignatureCache.set(cacheId, { signature, snapshot });
		return signature;
	}

	function getRedrawSignature(objects: readonly DrawableAnnotation[] = []) {
		let signature = mixRenderSignature(createRenderSignature(), objects.length);

		for (let index = 0; index < objects.length; index += 1) {
			signature = mixRenderSignature(signature, getObjectSignature(objects[index], index));
		}

		return signature;
	}

	function getObjectCacheKey(object: DrawableAnnotation) {
		return object.path || '';
	}

	function getGeometry(object: DrawableAnnotation): CachedGeometry | null {
		if (!object.id || !object.path) return null;

		const key = getObjectCacheKey(object);
		const cached = geometryCache.get(object.id);
		if (cached?.key === key) return cached;

		let path2d: Path2D | null = null;
		try {
			path2d = new Path2D(object.path);
		} catch {
			path2d = null;
		}

		const { points, bbox: boundingBox } = getPathGeometry(object.path);
		const geometry = { key, path2d, points, boundingBox };
		geometryCache.set(object.id, geometry);

		return geometry;
	}

	function pruneGeometryCache() {
		const liveIds = new Set(objects.map((object) => object.id).filter(Boolean));

		for (const id of geometryCache.keys()) {
			if (!liveIds.has(id)) {
				geometryCache.delete(id);
			}
		}
	}

	function getDrawingScale(object: DrawableAnnotation) {
		const scale =
			object.scale ??
			(object.originWidth ? (object.width || object.originWidth) / object.originWidth : 1);

		return Number.isFinite(scale) && scale !== 0 ? scale : 1;
	}

	function getDrawingRotation(object: DrawableAnnotation) {
		return Number(object.rotation || 0);
	}

	function getOpacity(object: DrawableAnnotation) {
		const opacity = Number(object.opacity);
		if (Number.isFinite(opacity)) return Math.max(0, Math.min(opacity, 1));
		return object.type === 'highlight' ? 0.5 : 1;
	}

	function isVisibleForStrokeFilter(object: DrawableAnnotation) {
		if (stroke_visibility === 'all') return true;

		const isSelf = object.owner === user || object.owner === `global-${user}`;
		return stroke_visibility === 'self' ? isSelf : !isSelf;
	}

	function drawPointFallback(
		context: CanvasRenderingContext2D,
		points: Point[],
		brushSize: number
	) {
		if (points.length === 0) return;

		context.beginPath();
		context.moveTo(points[0].x, points[0].y);

		for (let index = 1; index < points.length; index += 1) {
			context.lineTo(points[index].x, points[index].y);
		}

		if (points.length === 1) {
			context.lineTo(points[0].x + Math.max(brushSize, 1) * 0.01, points[0].y);
		}

		context.stroke();
	}

	function drawAnnotation(
		context: CanvasRenderingContext2D,
		object: DrawableAnnotation,
		geometry: CachedGeometry
	) {
		if (!geometry.boundingBox || (!geometry.path2d && geometry.points.length === 0)) return;

		const brushSize = object.brushSize || 1;
		const scale = getDrawingScale(object);
		const rotation = getDrawingRotation(object);
		const anchorX = geometry.boundingBox.x + geometry.boundingBox.width / 2;
		const anchorY = geometry.boundingBox.y + geometry.boundingBox.height / 2;

		context.save();
		context.translate(object.x || 0, object.y || 0);
		context.translate(anchorX, anchorY);
		context.rotate((rotation * Math.PI) / 180);
		context.scale(scale, scale);
		context.translate(-anchorX, -anchorY);

		context.globalAlpha = getOpacity(object);
		context.strokeStyle = object.brushColor || '#232529';
		context.lineWidth = brushSize;
		context.lineJoin = 'round';
		context.lineCap = 'round';

		if (geometry.path2d) {
			context.stroke(geometry.path2d);
		} else {
			drawPointFallback(context, geometry.points, brushSize);
		}

		context.restore();
	}

	function ensureCanvasSize(context: CanvasRenderingContext2D) {
		if (!canvas) return 1;

		const dpr = getCappedDevicePixelRatio();
		const backingScale = getAnnotationCanvasBackingScale(pageWidth, pageHeight, pageScale, dpr);
		const bitmapWidth = Math.max(1, Math.round(pageWidth * backingScale));
		const bitmapHeight = Math.max(1, Math.round(pageHeight * backingScale));

		if (lastBitmapWidth !== bitmapWidth || lastBitmapHeight !== bitmapHeight) {
			canvas.width = bitmapWidth;
			canvas.height = bitmapHeight;
			lastBitmapWidth = bitmapWidth;
			lastBitmapHeight = bitmapHeight;
		}

		context.setTransform(backingScale, 0, 0, backingScale, 0, 0);
		return backingScale;
	}

	function draw() {
		if (!canvas) return;

		const context = canvas.getContext('2d');
		if (!context) return;

		ensureCanvasSize(context);
		context.clearRect(0, 0, pageWidth, pageHeight);
		pruneGeometryCache();

		for (const object of objects) {
			if (
				(object.type !== 'drawing' && object.type !== 'highlight') ||
				object._eraserHighlight ||
				!isVisibleForStrokeFilter(object)
			) {
				continue;
			}

			const geometry = getGeometry(object);
			if (!geometry) continue;

			drawAnnotation(context, object, geometry);
		}
	}

	function scheduleDraw(immediate = false) {
		if (deferRedraw) {
			redrawDeferred = true;
			return;
		}

		if (immediate) {
			if (drawFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
				cancelAnimationFrame(drawFrame);
				drawFrame = null;
			}
			draw();
			return;
		}

		if (drawFrame !== null) return;

		if (typeof requestAnimationFrame === 'undefined') {
			draw();
			return;
		}

		drawFrame = requestAnimationFrame(() => {
			drawFrame = null;
			draw();
		});
	}

	$effect(() => {
		canvas;
		pageWidth;
		pageHeight;
		pageScale;
		user;
		stroke_visibility;
		deferRedraw;
		redrawKey;

		const shouldDrawImmediately = wasDeferred && !deferRedraw;
		wasDeferred = deferRedraw;

		if (!deferRedraw || redrawDeferred) {
			redrawDeferred = false;
			scheduleDraw(shouldDrawImmediately);
		}
	});

	onDestroy(() => {
		if (drawFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
			cancelAnimationFrame(drawFrame);
		}
		geometryCache.clear();
		objectSignatureCache.clear();
	});
</script>

<canvas
	bind:this={canvas}
	class="pointer-events-none absolute top-0 left-0 block"
	style="width: {pageWidth}px; height: {pageHeight}px;"
	aria-hidden="true"
></canvas>
