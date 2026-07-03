/**
 * useAutoSave Composable
 *
 * Manages auto-save functionality with debouncing.
 * Triggers save after a specified delay when annotations change.
 */

import { getPDFEditorContext } from '../context/pdfEditorContext.svelte';
import { DeferredSaveQueue } from '../utils/deferredSaveQueue';
import { toast, TOAST_ERROR } from '../utils/toast';


export function useAutoSave(saveFunction: () => Promise<void>, debounceMs: number = 5000) {
	const ctx = getPDFEditorContext();
	let lastChangeTime = $state(0);
	const queue = new DeferredSaveQueue(saveFunction, {
		delayMs: debounceMs,
		shouldDefer: () =>
			ctx.state.isDrawingStroke || ctx.state.activeInteraction === 'drawing',
		onError: (error) => {
			toast.push(
				`Auto save failed: ${error instanceof Error ? error.message : String(error)}`,
				{ theme: TOAST_ERROR }
			);
		}
	});

	/**
	 * Trigger auto-save with debouncing
	 * Only saves if auto-save is enabled
	 */
	function triggerAutoSave() {
		// Only auto-save if enabled
		if (!ctx.state.autoSaveEnabled) {
			return;
		}

		queue.markChange();
	}

	/**
	 * Mark that an annotation change occurred
	 * Updates the lastChangeTime to trigger the effect
	 */
	function markChange() {
		lastChangeTime = Date.now();
		triggerAutoSave();
	}

	/**
	 * Cancel any pending auto-save
	 */
	function cancelAutoSave() {
		queue.cancelPending();
	}

	function pause() {
		queue.pause();
	}

	function resume() {
		queue.resume();
	}

	/**
	 * Cleanup function to be called on component destroy
	 */
	function cleanup() {
		cancelAutoSave();
	}

	return {
		markChange,
		cancelAutoSave,
		pause,
		resume,
		cleanup,
		get lastChangeTime() {
			return lastChangeTime;
		},
		get isSaving() {
			return queue.isRunning;
		},
		get hasPendingChange() {
			return queue.hasPendingChange;
		}
	};
}


