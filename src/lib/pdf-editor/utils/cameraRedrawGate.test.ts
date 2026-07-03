import { describe, expect, it } from 'vitest';
import { canReleaseCameraRedraw } from './cameraRedrawGate';

describe('canReleaseCameraRedraw', () => {
	it('keeps high-quality redraw deferred during drawing, panning, momentum, or gestures', () => {
		expect(
			canReleaseCameraRedraw({
				isDrawingStroke: true,
				isPanning: false,
				isMomentumScrolling: false,
				hasGesture: false
			})
		).toBe(false);
		expect(
			canReleaseCameraRedraw({
				isDrawingStroke: false,
				isPanning: true,
				isMomentumScrolling: false,
				hasGesture: false
			})
		).toBe(false);
		expect(
			canReleaseCameraRedraw({
				isDrawingStroke: false,
				isPanning: false,
				isMomentumScrolling: true,
				hasGesture: false
			})
		).toBe(false);
		expect(
			canReleaseCameraRedraw({
				isDrawingStroke: false,
				isPanning: false,
				isMomentumScrolling: false,
				hasGesture: true
			})
		).toBe(false);
	});

	it('releases redraw when camera interaction is idle', () => {
		expect(
			canReleaseCameraRedraw({
				isDrawingStroke: false,
				isPanning: false,
				isMomentumScrolling: false,
				hasGesture: false
			})
		).toBe(true);
	});
});
