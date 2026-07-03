import { describe, expect, it, vi } from 'vitest';
import { PageSaveCoordinator } from './pageSaveCoordinator';

describe('PageSaveCoordinator', () => {
	it('persists a local draft after 250ms', async () => {
		vi.useFakeTimers();
		let pageNo = 1;
		let annotations = [{ id: 'a' }];
		const persistLocal = vi.fn(async () => {});
		const coordinator = new PageSaveCoordinator({
			capture: () => ({
				scopeKey: `page:${pageNo}`,
				documentId: 'doc',
				annotationId: 'annotation',
				pageNo,
				payload: annotations
			}),
			persistLocal,
			saveRemote: async () => 'saved'
		});

		coordinator.markChanged();
		await vi.advanceTimersByTimeAsync(249);
		expect(persistLocal).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(persistLocal).toHaveBeenCalledTimes(1);
		coordinator.destroy();
		vi.useRealTimers();
	});

	it('serializes page snapshots and never retargets an in-flight save', async () => {
		let pageNo = 1;
		let annotations = [{ id: 'page-1' }];
		let finishFirst: (() => void) | undefined;
		const saved: Array<{ pageNo: number; ids: string[] }> = [];
		const latestFlags: boolean[] = [];
		const coordinator = new PageSaveCoordinator({
			capture: () => ({
				scopeKey: `page:${pageNo}`,
				documentId: 'doc',
				annotationId: 'annotation',
				pageNo,
				payload: annotations
			}),
			persistLocal: async () => {},
			saveRemote: async (snapshot) => {
				saved.push({ pageNo: snapshot.pageNo, ids: snapshot.payload.map((item) => item.id) });
				if (snapshot.pageNo === 1) {
					await new Promise<void>((resolve) => {
						finishFirst = resolve;
					});
				}
				return 'saved';
			},
			onSaveFinished: (_snapshot, _result, isLatest) => latestFlags.push(isLatest)
		});

		coordinator.markChanged();
		const firstSave = coordinator.saveNow();
		await Promise.resolve();
		pageNo = 2;
		annotations = [{ id: 'page-2' }];
		coordinator.markChanged();
		const secondSave = coordinator.saveNow();
		await Promise.resolve();

		expect(saved).toEqual([{ pageNo: 1, ids: ['page-1'] }]);
		finishFirst?.();
		await firstSave;
		await secondSave;

		expect(saved).toEqual([
			{ pageNo: 1, ids: ['page-1'] },
			{ pageNo: 2, ids: ['page-2'] }
		]);
		expect(latestFlags).toEqual([false, true]);
	});
	it('serializes local draft writes so an older revision cannot finish last', async () => {
		let value = 'first';
		let finishFirst: (() => void) | undefined;
		const persisted: string[] = [];
		const coordinator = new PageSaveCoordinator({
			capture: () => ({
				scopeKey: 'page:1',
				documentId: 'doc',
				annotationId: 'annotation',
				pageNo: 1,
				payload: value
			}),
			persistLocal: async (snapshot) => {
				if (snapshot.payload === 'first') {
					await new Promise<void>((resolve) => {
						finishFirst = resolve;
					});
				}
				persisted.push(snapshot.payload);
			},
			saveRemote: async () => 'saved'
		});

		coordinator.markChanged();
		const firstFlush = coordinator.flushLocal();
		await Promise.resolve();
		value = 'second';
		coordinator.markChanged();
		const secondFlush = coordinator.flushLocal();
		await Promise.resolve();
		expect(persisted).toEqual([]);

		finishFirst?.();
		await firstFlush;
		await secondFlush;
		expect(persisted).toEqual(['first', 'second']);
	});
});
