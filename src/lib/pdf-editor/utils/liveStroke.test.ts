import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	LiveStroke,
	commandsToPath,
	getCoalescedPointerEvents,
	isPenLikePointerEvent
} from './liveStroke';

function createCanvas(width = 200, height = 100) {
	return {
		getBoundingClientRect: () => ({
			left: 0,
			top: 0,
			width,
			height
		})
	} as HTMLElement;
}

describe('LiveStroke', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('splits very long strokes into capped subpaths', () => {
		const liveStroke = new LiveStroke(
			() => createCanvas(),
			() => {},
			{ minPointDistance: 0, maxPointsPerSegment: 4 }
		);

		expect(liveStroke.start(0, 0, null)).toBe(true);
		for (let index = 1; index <= 10; index += 1) {
			liveStroke.addClientPoint(index * 10, 10);
		}

		const result = liveStroke.finish(1, true);
		expect(result).not.toBeNull();
		expect((result?.path.match(/M/g) || []).length).toBeGreaterThan(1);
	});

	it('keeps SVG path output compatible with existing annotations', () => {
		expect(
			commandsToPath([
				['M', 1, 2],
				['L', 3, 4]
			])
		).toBe('M1,2L3,4');
	});

	it('ignores coalesced pointer events on iOS-like devices', () => {
		vi.stubGlobal('navigator', {
			userAgent: 'iPhone',
			platform: 'iPhone',
			maxTouchPoints: 1
		});
		const event = {
			getCoalescedEvents: () => [{ clientX: 1 }, { clientX: 2 }]
		} as unknown as PointerEvent;

		expect(getCoalescedPointerEvents(event)).toEqual([event]);
	});

	it('does not treat pressure-bearing touch pointers as pen-like', () => {
		expect(isPenLikePointerEvent({ pointerType: 'pen', pressure: 0 } as PointerEvent)).toBe(true);
		expect(isPenLikePointerEvent({ pointerType: 'mouse', pressure: 1 } as PointerEvent)).toBe(
			false
		);
		expect(isPenLikePointerEvent({ pointerType: 'touch', pressure: 0.2 } as PointerEvent)).toBe(
			false
		);
		expect(isPenLikePointerEvent({ pointerType: '', pressure: 0.2 } as PointerEvent)).toBe(true);
	});
});
