import { describe, expect, it } from 'vitest';
import { createObjectSpatialIndex, getObjectSpatialBox } from './spatialIndex';

describe('ObjectSpatialIndex', () => {
	it('returns point candidates in original z-order', () => {
		const objects = [
			{ id: 'behind', type: 'text', x: 10, y: 10, width: 80, lines: ['A'], size: 16 },
			{ id: 'front', type: 'teacher-mark', x: 20, y: 20, width: 40, height: 30 },
			{ id: 'far', type: 'text', x: 400, y: 400, width: 80, lines: ['B'], size: 16 }
		];

		const index = createObjectSpatialIndex(objects, { cellSize: 64 });

		expect(index.queryPoint(30, 30).map((object) => object.id)).toEqual(['behind', 'front']);
	});

	it('limits box queries to overlapping candidates', () => {
		const objects = [
			{ id: 'inside', type: 'line', x: 20, y: 20, width: 40, height: 0, strokeWidth: 4 },
			{ id: 'outside', type: 'line', x: 300, y: 300, width: 40, height: 0, strokeWidth: 4 }
		];

		const index = createObjectSpatialIndex(objects, { cellSize: 64 });

		expect(index.queryBox({ x: 0, y: 0, width: 100, height: 100 }).map((object) => object.id)).toEqual([
			'inside'
		]);
	});

	it('indexes drawing annotations using their transformed path bounds', () => {
		const drawing = {
			id: 'stroke',
			type: 'drawing',
			x: 50,
			y: 60,
			width: 20,
			originWidth: 20,
			originHeight: 20,
			path: 'M0,0L20,20',
			brushSize: 4
		};

		const box = getObjectSpatialBox(drawing);
		const index = createObjectSpatialIndex([drawing], { cellSize: 64 });

		expect(box).toMatchObject({ x: 48, y: 58, width: 24, height: 24 });
		expect(index.queryPoint(60, 70).map((object) => object.id)).toEqual(['stroke']);
		expect(index.queryPoint(200, 200).map((object) => object.id)).toEqual([]);
	});
});
