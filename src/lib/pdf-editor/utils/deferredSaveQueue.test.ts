import { describe, expect, it, vi } from 'vitest';
import { DeferredSaveQueue } from './deferredSaveQueue';

describe('DeferredSaveQueue', () => {
	it('defers saves while paused and runs after resume', async () => {
		vi.useFakeTimers();
		const save = vi.fn(async () => {});
		const queue = new DeferredSaveQueue(save, { delayMs: 10 });

		queue.pause();
		queue.markChange();
		await vi.advanceTimersByTimeAsync(100);

		expect(save).not.toHaveBeenCalled();

		queue.resume();
		await vi.advanceTimersByTimeAsync(10);

		expect(save).toHaveBeenCalledTimes(1);
		vi.useRealTimers();
	});

	it('runs one follow-up save when a change arrives during an in-flight save', async () => {
		vi.useFakeTimers();
		let finishFirstSave: (() => void) | undefined;
		const save = vi
			.fn()
			.mockImplementationOnce(
				() =>
					new Promise<void>((resolve) => {
						finishFirstSave = resolve;
					})
			)
			.mockImplementationOnce(async () => {});
		const queue = new DeferredSaveQueue(save, { delayMs: 10 });

		queue.markChange();
		await vi.advanceTimersByTimeAsync(10);
		expect(save).toHaveBeenCalledTimes(1);

		queue.markChange();
		expect(queue.hasPendingChange).toBe(true);

		finishFirstSave?.();
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(10);

		expect(save).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
	});
});
