import {
	getPathGeometry,
	getTransformedDrawingBBox,
	type BBox,
	type DrawingObject
} from './hitTest';

export type SpatialIndexObject = {
	id?: string | number;
	type?: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	originWidth?: number;
	originHeight?: number;
	scale?: number;
	rotation?: number;
	path?: string;
	brushSize?: number;
	strokeWidth?: number;
	size?: number;
	lineHeight?: number;
	lines?: unknown[];
};

type SpatialIndexEntry<T extends SpatialIndexObject> = {
	object: T;
	index: number;
	box: BBox;
};

type SpatialIndexOptions = {
	cellSize?: number;
};

const DEFAULT_CELL_SIZE = 256;

function normalizeNumber(value: unknown, fallback = 0) {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeBox(box: BBox): BBox {
	const x = normalizeNumber(box.x);
	const y = normalizeNumber(box.y);
	const width = normalizeNumber(box.width);
	const height = normalizeNumber(box.height);

	return {
		x: width >= 0 ? x : x + width,
		y: height >= 0 ? y : y + height,
		width: Math.abs(width),
		height: Math.abs(height)
	};
}

function expandBox(box: BBox, padding = 0): BBox {
	const safePadding = Math.max(0, normalizeNumber(padding));
	const normalized = normalizeBox(box);

	return {
		x: normalized.x - safePadding,
		y: normalized.y - safePadding,
		width: normalized.width + safePadding * 2,
		height: normalized.height + safePadding * 2
	};
}

function getDrawingScale(object: SpatialIndexObject) {
	const scale =
		object.scale ??
		(object.originWidth ? (object.width || object.originWidth) / object.originWidth : 1);

	return Number.isFinite(scale) && scale !== 0 ? scale : 1;
}

function getPathAnnotationBox(object: SpatialIndexObject): BBox | null {
	if (!object.path) return null;

	const pathBox = getPathGeometry(object.path).bbox;
	if (!pathBox) return null;

	const scale = getDrawingScale(object);
	const drawing = {
		...object,
		x: normalizeNumber(object.x),
		y: normalizeNumber(object.y),
		width: normalizeNumber(object.width, object.originWidth || 1),
		originWidth: normalizeNumber(object.originWidth, object.width || 1),
		originHeight: normalizeNumber(object.originHeight, object.height || 1),
		path: object.path
	} as DrawingObject;
	const transformedBox = getTransformedDrawingBBox(
		drawing,
		pathBox,
		scale,
		normalizeNumber(object.rotation)
	);
	const strokePadding = Math.max((object.brushSize || 1) * Math.abs(scale), 1) / 2;

	return expandBox(transformedBox, strokePadding);
}

export function getObjectSpatialBox(object: SpatialIndexObject): BBox | null {
	if (!object) return null;

	if (object.type === 'drawing' || object.type === 'highlight') {
		return getPathAnnotationBox(object);
	}

	if (object.type === 'line') {
		const x = normalizeNumber(object.x);
		const y = normalizeNumber(object.y);
		const width = normalizeNumber(object.width);
		const height = normalizeNumber(object.height);
		const strokePadding = Math.max((object.strokeWidth || 2) / 2, 1);

		return expandBox(
			{
				x: Math.min(x, x + width),
				y: Math.min(y, y + height),
				width: Math.abs(width),
				height: Math.abs(height)
			},
			strokePadding
		);
	}

	if (object.type === 'text') {
		return {
			x: normalizeNumber(object.x) - 4,
			y: normalizeNumber(object.y) - 4,
			width: (object.width || 100) + 8,
			height: (object.lines?.length || 1) * (object.size || 16) * (object.lineHeight || 1.2) + 8
		};
	}

	if (object.type === 'teacher-mark') {
		return {
			x: normalizeNumber(object.x) - 4,
			y: normalizeNumber(object.y) - 4,
			width: (object.width || 60) + 8,
			height: (object.height || 40) + 8
		};
	}

	if (object.x !== undefined || object.y !== undefined || object.width !== undefined) {
		return normalizeBox({
			x: normalizeNumber(object.x),
			y: normalizeNumber(object.y),
			width: normalizeNumber(object.width, 1),
			height: normalizeNumber(object.height ?? object.originHeight ?? object.size, 1)
		});
	}

	return null;
}

export class ObjectSpatialIndex<T extends SpatialIndexObject> {
	private readonly buckets = new Map<string, SpatialIndexEntry<T>[]>();
	private readonly unbounded: SpatialIndexEntry<T>[] = [];
	private readonly cellSize: number;

	constructor(objects: readonly T[] = [], options: SpatialIndexOptions = {}) {
		this.cellSize = Math.max(32, options.cellSize || DEFAULT_CELL_SIZE);

		objects.forEach((object, index) => {
			const box = getObjectSpatialBox(object);
			if (!box) {
				this.unbounded.push({
					object,
					index,
					box: { x: 0, y: 0, width: 0, height: 0 }
				});
				return;
			}

			this.addEntry({ object, index, box: normalizeBox(box) });
		});
	}

	queryBox(box: BBox, padding = 0): T[] {
		const query = expandBox(box, padding);
		const entries = new Map<number, SpatialIndexEntry<T>>();

		for (const entry of this.unbounded) {
			entries.set(entry.index, entry);
		}

		const minCellX = Math.floor(query.x / this.cellSize);
		const maxCellX = Math.floor((query.x + query.width) / this.cellSize);
		const minCellY = Math.floor(query.y / this.cellSize);
		const maxCellY = Math.floor((query.y + query.height) / this.cellSize);

		for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
			for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
				const bucket = this.buckets.get(this.getBucketKey(cellX, cellY));
				if (!bucket) continue;

				for (const entry of bucket) {
					if (boxesIntersect(entry.box, query)) {
						entries.set(entry.index, entry);
					}
				}
			}
		}

		return Array.from(entries.values())
			.sort((a, b) => a.index - b.index)
			.map((entry) => entry.object);
	}

	queryPoint(x: number, y: number, padding = 0): T[] {
		return this.queryBox({ x, y, width: 0, height: 0 }, padding);
	}

	private addEntry(entry: SpatialIndexEntry<T>) {
		const minCellX = Math.floor(entry.box.x / this.cellSize);
		const maxCellX = Math.floor((entry.box.x + entry.box.width) / this.cellSize);
		const minCellY = Math.floor(entry.box.y / this.cellSize);
		const maxCellY = Math.floor((entry.box.y + entry.box.height) / this.cellSize);

		for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
			for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
				const key = this.getBucketKey(cellX, cellY);
				const bucket = this.buckets.get(key);

				if (bucket) {
					bucket.push(entry);
				} else {
					this.buckets.set(key, [entry]);
				}
			}
		}
	}

	private getBucketKey(cellX: number, cellY: number) {
		return `${cellX}:${cellY}`;
	}
}

export function createObjectSpatialIndex<T extends SpatialIndexObject>(
	objects: readonly T[] = [],
	options?: SpatialIndexOptions
) {
	return new ObjectSpatialIndex(objects, options);
}

function boxesIntersect(a: BBox, b: BBox) {
	return (
		a.x <= b.x + b.width &&
		a.x + a.width >= b.x &&
		a.y <= b.y + b.height &&
		a.y + a.height >= b.y
	);
}
