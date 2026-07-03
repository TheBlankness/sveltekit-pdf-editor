export const MIN_PDF_ZOOM = 0.1;
export const SOFT_MIN_PDF_ZOOM = 0.4;
export const MAX_PDF_ZOOM = 14;
export const PDF_ZOOM_STEP = 0.25;

export function clampPdfZoom(zoom: number, minZoom = MIN_PDF_ZOOM) {
	return Math.max(Math.max(MIN_PDF_ZOOM, minZoom), Math.min(zoom, MAX_PDF_ZOOM));
}

export function pdfZoomToPercent(zoom: number) {
	return Math.round((zoom / 2) * 100);
}

export function pdfZoomFromPercent(percent: number) {
	return (percent / 100) * 2;
}
