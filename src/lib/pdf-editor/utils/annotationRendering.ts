import { isIOSLikeDevice } from './liveStroke';

export const ANNOTATION_CANVAS_MAX_BACKING_SCALE = 4;
export const ANNOTATION_CANVAS_MAX_PIXELS = 12000000;
export const ANNOTATION_CANVAS_MAX_DIMENSION = 4096;
export const DEFAULT_ANNOTATION_CANVAS_MAX_BACKING_SCALE = 3;
export const DEFAULT_ANNOTATION_CANVAS_MAX_PIXELS = 8000000;
export const DEFAULT_ANNOTATION_CANVAS_MAX_DIMENSION = 4096;
export const ANNOTATION_VECTOR_ZOOM_THRESHOLD = 4;
export const LIVE_STROKE_PREVIEW_MAX_PIXELS = 3000000;
export const LIVE_STROKE_PREVIEW_MAX_DIMENSION = 2048;
export const PDF_EDITOR_MAX_DEVICE_PIXEL_RATIO = 1;

export function getCappedDevicePixelRatio(maxDpr = PDF_EDITOR_MAX_DEVICE_PIXEL_RATIO) {
	const devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
	return Math.max(1, Math.min(devicePixelRatio, maxDpr));
}

export function getAnnotationCanvasLimits() {
	if (isIOSLikeDevice()) {
		return {
			maxBackingScale: ANNOTATION_CANVAS_MAX_BACKING_SCALE,
			maxPixels: ANNOTATION_CANVAS_MAX_PIXELS,
			maxDimension: ANNOTATION_CANVAS_MAX_DIMENSION
		};
	}

	return {
		maxBackingScale: DEFAULT_ANNOTATION_CANVAS_MAX_BACKING_SCALE,
		maxPixels: DEFAULT_ANNOTATION_CANVAS_MAX_PIXELS,
		maxDimension: DEFAULT_ANNOTATION_CANVAS_MAX_DIMENSION
	};
}

export function getAnnotationCanvasMaxBackingScale() {
	return getAnnotationCanvasLimits().maxBackingScale;
}

export function shouldUseAnnotationVectorRendering(pageScale: number) {
	return pageScale >= ANNOTATION_VECTOR_ZOOM_THRESHOLD;
}

export function getBoundedCanvasBackingScale(
	cssWidth: number,
	cssHeight: number,
	preferredScale: number,
	options: { maxPixels?: number; maxDimension?: number; minScale?: number } = {}
) {
	const width = Math.max(1, cssWidth);
	const height = Math.max(1, cssHeight);
	const maxPixels = Math.max(1, options.maxPixels ?? LIVE_STROKE_PREVIEW_MAX_PIXELS);
	const maxDimension = Math.max(1, options.maxDimension ?? LIVE_STROKE_PREVIEW_MAX_DIMENSION);
	const minScale = Math.max(0.05, options.minScale ?? 0.1);
	const pixelScaleLimit = Math.sqrt(maxPixels / (width * height));
	const dimensionScaleLimit = Math.min(maxDimension / width, maxDimension / height);

	return Math.max(
		0.01,
		Math.min(Math.max(preferredScale || 1, minScale), pixelScaleLimit, dimensionScaleLimit)
	);
}

export function getAnnotationCanvasBackingScale(
	pageWidth: number,
	pageHeight: number,
	pageScale: number,
	devicePixelRatio = getCappedDevicePixelRatio()
) {
	const limits = getAnnotationCanvasLimits();
	const preferredScale = Math.min(
		devicePixelRatio * Math.max(pageScale || 1, 0.1),
		limits.maxBackingScale
	);

	return getBoundedCanvasBackingScale(pageWidth, pageHeight, preferredScale, {
		maxPixels: limits.maxPixels,
		maxDimension: limits.maxDimension,
		minScale: 1
	});
}
