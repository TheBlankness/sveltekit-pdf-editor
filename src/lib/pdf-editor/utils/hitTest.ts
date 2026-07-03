/**
 * Hit-test utilities for precise annotation selection
 * Inspired by TLDraw's collision detection system
 */

export interface Point {
	x: number;
	y: number;
}

export interface BBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface DrawingObject {
	id: string;
	type: string;
	x: number;
	y: number;
	width: number;
	originWidth: number;
	originHeight: number;
	scale?: number;
	rotation?: number;
	path: string;
	brushSize?: number;
}

export type PathGeometry = {
	points: Point[];
	bbox: BBox | null;
};

const PATH_GEOMETRY_CACHE_LIMIT = 2000;
const pathGeometryCache = new Map<string, PathGeometry>();

function isPathAnnotation(obj: { type?: string } | null | undefined) {
	return obj?.type === 'drawing' || obj?.type === 'highlight';
}

/**
 * Sample points along a quadratic Bezier curve
 * Q command: Q x1,y1 x,y (control point, end point)
 */
function sampleQuadraticBezier(
	start: Point,
	control: Point,
	end: Point,
	segments: number = 10
): Point[] {
	const points: Point[] = [];

	for (let i = 0; i <= segments; i++) {
		const t = i / segments;
		const t1 = 1 - t;

		// Quadratic Bezier formula: B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
		const x = t1 * t1 * start.x + 2 * t1 * t * control.x + t * t * end.x;
		const y = t1 * t1 * start.y + 2 * t1 * t * control.y + t * t * end.y;

		points.push({ x, y });
	}

	return points;
}

/**
 * Sample points along a cubic Bezier curve
 * C command: C x1,y1 x2,y2 x,y (first control point, second control point, end point)
 */
function sampleCubicBezier(
	start: Point,
	control1: Point,
	control2: Point,
	end: Point,
	segments: number = 15
): Point[] {
	const points: Point[] = [];

	for (let i = 0; i <= segments; i++) {
		const t = i / segments;
		const t1 = 1 - t;

		// Cubic Bezier formula: B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
		const x =
			t1 * t1 * t1 * start.x +
			3 * t1 * t1 * t * control1.x +
			3 * t1 * t * t * control2.x +
			t * t * t * end.x;
		const y =
			t1 * t1 * t1 * start.y +
			3 * t1 * t1 * t * control1.y +
			3 * t1 * t * t * control2.y +
			t * t * t * end.y;

		points.push({ x, y });
	}

	return points;
}

/**
 * Parse SVG path string into array of points
 * Supports M (moveto), L (lineto), Q (quadratic bezier), C (cubic bezier), and Z (closepath) commands
 * Curves are sampled into line segments for hit testing
 */
export function parsePath(pathString: string): Point[] {
	const points: Point[] = [];

	// Tokenize: commands OR numbers
	const tokens = pathString.match(/[MLQCZ]|-?\d*\.?\d+/gi);
	if (!tokens) return points;

	let i = 0;
	let currentCommand = '';
	let currentPoint: Point = { x: 0, y: 0 };
	let startPoint: Point = { x: 0, y: 0 };

	while (i < tokens.length) {
		let token = tokens[i];

		// If command
		if (/[MLQCZ]/i.test(token)) {
			currentCommand = token.toUpperCase();
			i++;
			continue;
		}

		// --- HANDLE COMMANDS ---

		if (currentCommand === 'M' || currentCommand === 'L') {
			const x = parseFloat(tokens[i]);
			const y = parseFloat(tokens[i + 1]);

			currentPoint = { x, y };
			points.push(currentPoint);

			// After M → implicit L
			if (currentCommand === 'M') {
				startPoint = { ...currentPoint };
				currentCommand = 'L';
			}

			i += 2;
		} else if (currentCommand === 'Q') {
			const control = {
				x: parseFloat(tokens[i]),
				y: parseFloat(tokens[i + 1])
			};
			const end = {
				x: parseFloat(tokens[i + 2]),
				y: parseFloat(tokens[i + 3])
			};

			const curvePoints = sampleQuadraticBezier(currentPoint, control, end);
			points.push(...curvePoints.slice(1));

			currentPoint = end;
			i += 4;
		} else if (currentCommand === 'C') {
			const control1 = {
				x: parseFloat(tokens[i]),
				y: parseFloat(tokens[i + 1])
			};
			const control2 = {
				x: parseFloat(tokens[i + 2]),
				y: parseFloat(tokens[i + 3])
			};
			const end = {
				x: parseFloat(tokens[i + 4]),
				y: parseFloat(tokens[i + 5])
			};

			const curvePoints = sampleCubicBezier(currentPoint, control1, control2, end);
			points.push(...curvePoints.slice(1));

			currentPoint = end;
			i += 6;
		} else if (currentCommand === 'Z') {
			points.push(startPoint);
			currentPoint = startPoint;
			i++;
		} else {
			// Unknown or malformed → skip
			i++;
		}
	}

	return points;
}

/**
 * Compute bounding box from path points
 */
export function computePathBBox(points: Point[]): BBox | null {
	if (points.length === 0) return null;

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const point of points) {
		minX = Math.min(minX, point.x);
		minY = Math.min(minY, point.y);
		maxX = Math.max(maxX, point.x);
		maxY = Math.max(maxY, point.y);
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY
	};
}

export function getPathGeometry(pathString: string = ''): PathGeometry {
	const cached = pathGeometryCache.get(pathString);
	if (cached) return cached;

	const points = parsePath(pathString);
	const geometry = {
		points,
		bbox: computePathBBox(points)
	};

	pathGeometryCache.set(pathString, geometry);
	if (pathGeometryCache.size > PATH_GEOMETRY_CACHE_LIMIT) {
		const oldestKey = pathGeometryCache.keys().next().value;
		if (oldestKey !== undefined) pathGeometryCache.delete(oldestKey);
	}

	return geometry;
}

export function clearPathGeometryCache() {
	pathGeometryCache.clear();
}

/**
 * Normalize a bounding box to ensure positive width and height
 * Adjusts x,y if width/height are negative
 */
export function normalizeBBox(bbox: BBox): BBox {
	const normalized = { ...bbox };

	if (normalized.width < 0) {
		normalized.x = normalized.x + normalized.width;
		normalized.width = Math.abs(normalized.width);
	}

	if (normalized.height < 0) {
		normalized.y = normalized.y + normalized.height;
		normalized.height = Math.abs(normalized.height);
	}

	return normalized;
}

/**
 * Check if a point is inside a bounding box with optional padding
 */
export function pointInBBox(point: Point, bbox: BBox, padding: number = 0): boolean {
	return (
		point.x >= bbox.x - padding &&
		point.x <= bbox.x + bbox.width + padding &&
		point.y >= bbox.y - padding &&
		point.y <= bbox.y + bbox.height + padding
	);
}

function degreesToRadians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

function getDrawingScale(drawing: DrawingObject): number {
	const scale = drawing.scale ?? (drawing.originWidth ? drawing.width / drawing.originWidth : 1);
	return Number.isFinite(scale) && scale !== 0 ? scale : 1;
}

function getDrawingRotation(drawing: DrawingObject): number {
	return Number(drawing.rotation || 0);
}

function getSafePageScale(pageScale: number): number {
	return Math.max(Math.abs(pageScale || 1), 0.1);
}

function getVisualStrokePadding(
	drawing: DrawingObject,
	scale: number = getDrawingScale(drawing),
	pageScale: number = 1
): number {
	const brushSize = drawing.brushSize || 2;
	const scaledStrokePadding = (brushSize * Math.abs(scale)) / 2;
	const pointerPadding = 3 / getSafePageScale(pageScale);

	return Math.max(scaledStrokePadding, 1) + pointerPadding;
}

function transformLocalDrawingPoint(
	point: Point,
	anchor: Point,
	scale: number,
	rotation: number
): Point {
	const angle = degreesToRadians(rotation);
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const scaledX = (point.x - anchor.x) * scale;
	const scaledY = (point.y - anchor.y) * scale;

	return {
		x: anchor.x + scaledX * cos - scaledY * sin,
		y: anchor.y + scaledX * sin + scaledY * cos
	};
}

function transformDrawingPointToPage(
	point: Point,
	drawing: DrawingObject,
	pathBBox: BBox,
	scale: number = getDrawingScale(drawing),
	rotation: number = getDrawingRotation(drawing)
): Point {
	const anchor = {
		x: pathBBox.x + pathBBox.width / 2,
		y: pathBBox.y + pathBBox.height / 2
	};
	const transformed = transformLocalDrawingPoint(point, anchor, scale, rotation);

	return {
		x: drawing.x + transformed.x,
		y: drawing.y + transformed.y
	};
}

function inverseTransformLocalDrawingPoint(
	point: Point,
	anchor: Point,
	scale: number,
	rotation: number
): Point {
	const angle = degreesToRadians(-rotation);
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const dx = point.x - anchor.x;
	const dy = point.y - anchor.y;

	return {
		x: anchor.x + (dx * cos - dy * sin) / scale,
		y: anchor.y + (dx * sin + dy * cos) / scale
	};
}

export function getTransformedDrawingBBox(
	drawing: DrawingObject,
	pathBBox: BBox,
	scale: number = getDrawingScale(drawing),
	rotation: number = getDrawingRotation(drawing)
): BBox {
	const anchor = {
		x: pathBBox.x + pathBBox.width / 2,
		y: pathBBox.y + pathBBox.height / 2
	};
	const corners = [
		{ x: pathBBox.x, y: pathBBox.y },
		{ x: pathBBox.x + pathBBox.width, y: pathBBox.y },
		{ x: pathBBox.x + pathBBox.width, y: pathBBox.y + pathBBox.height },
		{ x: pathBBox.x, y: pathBBox.y + pathBBox.height }
	].map((corner) => transformLocalDrawingPoint(corner, anchor, scale, rotation));

	const minX = Math.min(...corners.map((corner) => corner.x));
	const minY = Math.min(...corners.map((corner) => corner.y));
	const maxX = Math.max(...corners.map((corner) => corner.x));
	const maxY = Math.max(...corners.map((corner) => corner.y));

	return {
		x: drawing.x + minX,
		y: drawing.y + minY,
		width: maxX - minX,
		height: maxY - minY
	};
}

/**
 * Calculate distance from point to line segment
 */
export function pointToLineSegmentDistance(point: Point, lineStart: Point, lineEnd: Point): number {
	const A = point.x - lineStart.x;
	const B = point.y - lineStart.y;
	const C = lineEnd.x - lineStart.x;
	const D = lineEnd.y - lineStart.y;

	const dot = A * C + B * D;
	const lenSq = C * C + D * D;

	let param = -1;
	if (lenSq !== 0) {
		param = dot / lenSq;
	}

	let xx: number, yy: number;

	if (param < 0) {
		xx = lineStart.x;
		yy = lineStart.y;
	} else if (param > 1) {
		xx = lineEnd.x;
		yy = lineEnd.y;
	} else {
		xx = lineStart.x + param * C;
		yy = lineStart.y + param * D;
	}

	const dx = point.x - xx;
	const dy = point.y - yy;

	return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if point is near any segment of the path
 */
export function pointNearPath(point: Point, pathPoints: Point[], threshold: number): boolean {
	if (pathPoints.length < 2) return false;

	for (let i = 0; i < pathPoints.length - 1; i++) {
		const distance = pointToLineSegmentDistance(point, pathPoints[i], pathPoints[i + 1]);

		if (distance <= threshold) {
			return true;
		}
	}

	return false;
}

/**
 * Transform point from screen coordinates to drawing local coordinates
 * Accounts for the drawing's position, scale, and viewBox
 */
export function screenToDrawingCoords(
	screenPoint: Point,
	drawing: DrawingObject,
	_pageScale: number
): Point {
	// Remove the drawing's position offset
	const relativeX = screenPoint.x - drawing.x;
	const relativeY = screenPoint.y - drawing.y;

	const pathBBox = getPathGeometry(drawing.path).bbox;
	if (!pathBBox) {
		const fallbackScale = 1 / getDrawingScale(drawing);
		return {
			x: relativeX * fallbackScale,
			y: relativeY * fallbackScale
		};
	}

	const scale = getDrawingScale(drawing);
	const anchor = {
		x: pathBBox.x + pathBBox.width / 2,
		y: pathBBox.y + pathBBox.height / 2
	};

	// Transform to path coordinate space
	return inverseTransformLocalDrawingPoint(
		{ x: relativeX, y: relativeY },
		anchor,
		scale,
		getDrawingRotation(drawing)
	);
}

/**
 * Main hit-test function for drawings
 * Returns true if the point hits the drawing
 */
export function hitTestDrawing(
	screenPoint: Point,
	drawing: DrawingObject,
	pageScale: number = 1
): boolean {
	const { points: pathPoints, bbox: pathBBox } = getPathGeometry(drawing.path);

	if (pathPoints.length === 0) return false;
	if (!pathBBox) return false;

	const scale = getDrawingScale(drawing);
	const drawingBBox = getTransformedDrawingBBox(drawing, pathBBox, scale);

	// Include transformed stroke width so rotated/thick strokes are not rejected by the bbox gate.
	const hitPadding = getVisualStrokePadding(drawing, scale, pageScale);

	if (!pointInBBox(screenPoint, drawingBBox, hitPadding)) {
		return false;
	}

	// Transform click point to drawing's local coordinate system
	const localPoint = screenToDrawingCoords(screenPoint, drawing, pageScale);

	// Calculate hit threshold based on brush size and scale
	const brushSize = drawing.brushSize || 2;
	const threshold = Math.max(brushSize * 1.5, 3) + 2 / Math.max(Math.abs(scale), 0.1); // Brush size + small padding

	// Check if point is near any path segment
	return pointNearPath(localPoint, pathPoints, threshold);
}

/**
 * Hit-test for a selection box (lasso selection)
 * Checks if the actual path (not just container) intersects with the selection box
 */
export function hitTestDrawingWithBox(selectionBox: BBox, drawing: DrawingObject): boolean {
	const { points: pathPoints, bbox: pathBBox } = getPathGeometry(drawing.path);
	if (pathPoints.length === 0) return false;
	if (!pathBBox) return false;

	// Transform path bounding box to screen coordinates
	// Account for drawing's x,y offset
	const scale = getDrawingScale(drawing);
	const screenPathBBox = getTransformedDrawingBBox(drawing, pathBBox, scale);

	// Add minimal padding based on brush size for visual accuracy
	// Keep it small so the visual selection box matches what gets selected
	const padding = getVisualStrokePadding(drawing, scale);

	// Check if the actual path bounding box intersects with selection box
	const paddedPathBBox: BBox = {
		x: screenPathBBox.x - padding,
		y: screenPathBBox.y - padding,
		width: screenPathBBox.width + padding * 2,
		height: screenPathBBox.height + padding * 2
	};

	if (!boxesIntersect(selectionBox, paddedPathBBox)) return false;

	const paddedSelectionBox: BBox = {
		x: selectionBox.x - padding,
		y: selectionBox.y - padding,
		width: selectionBox.width + padding * 2,
		height: selectionBox.height + padding * 2
	};
	const transformedPoints = pathPoints.map((point) =>
		transformDrawingPointToPage(point, drawing, pathBBox, scale)
	);

	if (transformedPoints.length === 1) {
		return pointInBBox(transformedPoints[0], paddedSelectionBox);
	}

	for (let i = 0; i < transformedPoints.length - 1; i++) {
		const start = transformedPoints[i];
		const end = transformedPoints[i + 1];

		if (
			pointInBBox(start, paddedSelectionBox) ||
			pointInBBox(end, paddedSelectionBox) ||
			lineIntersectsBox(
				start.x,
				start.y,
				end.x - start.x,
				end.y - start.y,
				paddedSelectionBox,
				0
			)
		) {
			return true;
		}
	}

	return false;
}

/**
 * Check if two bounding boxes intersect
 */
export function boxesIntersect(box1: BBox, box2: BBox): boolean {
	return !(
		box1.x + box1.width < box2.x ||
		box2.x + box2.width < box1.x ||
		box1.y + box1.height < box2.y ||
		box2.y + box2.height < box1.y
	);
}

/**
 * Check if a line segment intersects with a bounding box
 * Line is defined by start point (x, y) and offset (width, height)
 */
export function lineIntersectsBox(
	lineX: number,
	lineY: number,
	lineWidth: number,
	lineHeight: number,
	box: BBox,
	strokeWidth: number = 2
): boolean {
	const lineStart: Point = { x: lineX, y: lineY };
	const lineEnd: Point = { x: lineX + lineWidth, y: lineY + lineHeight };

	// Expand box slightly by half stroke width for better selection
	const padding = strokeWidth / 2;
	const paddedBox: BBox = {
		x: box.x - padding,
		y: box.y - padding,
		width: box.width + padding * 2,
		height: box.height + padding * 2
	};

	// Check if either endpoint is inside the box
	if (pointInBBox(lineStart, paddedBox) || pointInBBox(lineEnd, paddedBox)) {
		return true;
	}

	// Check if line segment intersects with any edge of the box
	const boxCorners: Point[] = [
		{ x: paddedBox.x, y: paddedBox.y }, // top-left
		{ x: paddedBox.x + paddedBox.width, y: paddedBox.y }, // top-right
		{ x: paddedBox.x + paddedBox.width, y: paddedBox.y + paddedBox.height }, // bottom-right
		{ x: paddedBox.x, y: paddedBox.y + paddedBox.height } // bottom-left
	];

	// Check intersection with each edge of the box
	for (let i = 0; i < 4; i++) {
		const edgeStart = boxCorners[i];
		const edgeEnd = boxCorners[(i + 1) % 4];

		if (lineSegmentsIntersect(lineStart, lineEnd, edgeStart, edgeEnd)) {
			return true;
		}
	}

	return false;
}

/**
 * Check if two line segments intersect
 */
function lineSegmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
	const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);

	// Lines are parallel
	if (denom === 0) return false;

	const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
	const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

	// Check if intersection point is on both line segments
	return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

/**
 * Find all objects that are hit by a point
 * Returns array of object IDs sorted by z-index (last drawn on top)
 * Handles drawings, text, line, and teacher mark objects
 */
export function findDrawingsAtPoint(
	screenPoint: Point,
	objects: any[],
	pageScale: number = 1,
	candidateObjects?: any[]
): string[] {
	const hits: string[] = [];

	for (const obj of candidateObjects || objects) {
		if (isPathAnnotation(obj)) {
			if (hitTestDrawing(screenPoint, obj, pageScale)) {
				hits.push(obj.id);
			}
		} else if (obj.type === 'text') {
			// Hit test for text objects
			const textBox: BBox = {
				x: obj.x,
				y: obj.y,
				width: obj.width || 100,
				height: (obj.lines?.length || 1) * (obj.size || 16) * (obj.lineHeight || 1.2)
			};
			// Add small padding for easier selection
			const padding = 5 / pageScale;
			if (pointInBBox(screenPoint, textBox, padding)) {
				hits.push(obj.id);
			}
		} else if (obj.type === 'line') {
			// Hit test for line objects using actual line geometry
			// Line is defined by start point (x, y) and end point (x + width, y + height)
			const lineStart: Point = { x: obj.x, y: obj.y };
			const lineEnd: Point = { x: obj.x + obj.width, y: obj.y + obj.height };

			// Calculate distance from point to line segment
			const distance = pointToLineSegmentDistance(screenPoint, lineStart, lineEnd);

			// Add padding based on stroke width for easier selection
			const hitThreshold = Math.max((obj.strokeWidth || 2) / 2, 5) / pageScale;

			if (distance <= hitThreshold) {
				hits.push(obj.id);
			}
		} else if (obj.type === 'teacher-mark') {
			const markBox: BBox = {
				x: obj.x,
				y: obj.y,
				width: obj.width || 60,
				height: obj.height || 40
			};
			const padding = 5 / pageScale;
			if (pointInBBox(screenPoint, markBox, padding)) {
				hits.push(obj.id);
			}
		}
	}

	return hits;
}

/**
 * Find all drawings within a selection box
 */
export function findDrawingsInBox(selectionBox: BBox, drawings: DrawingObject[]): string[] {
	const hits: string[] = [];

	for (const drawing of drawings) {
		if (!isPathAnnotation(drawing)) continue;

		if (hitTestDrawingWithBox(selectionBox, drawing)) {
			hits.push(drawing.id);
		}
	}

	return hits;
}
