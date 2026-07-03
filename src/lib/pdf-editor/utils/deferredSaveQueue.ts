type TimerId = ReturnType<typeof setTimeout>;
type SetTimer = (callback: () => void, delayMs: number) => TimerId;
type ClearTimer = (timer: TimerId) => void;

const defaultSetTimer: SetTimer = (callback, delayMs) => globalThis.setTimeout(callback, delayMs);
const defaultClearTimer: ClearTimer = (timer) => globalThis.clearTimeout(timer);

type DeferredSaveQueueOptions = {
	delayMs?: number;
	retryDelayMs?: number;
	shouldDefer?: () => boolean;
	onError?: (error: unknown) => void;
	setTimer?: SetTimer;
	clearTimer?: ClearTimer;
};

export class DeferredSaveQueue {
	private delayMs: number;
	private retryDelayMs: number;
	private shouldDefer: () => boolean;
	private onError?: (error: unknown) => void;
	private setTimer: SetTimer;
	private clearTimer: ClearTimer;
	private timer: TimerId | null = null;
	private paused = false;
	private pending = false;
	private running = false;

	constructor(
		private saveFunction: () => Promise<void>,
		options: DeferredSaveQueueOptions = {}
	) {
		this.delayMs = options.delayMs ?? 5000;
		this.retryDelayMs = options.retryDelayMs ?? 250;
		this.shouldDefer = options.shouldDefer ?? (() => false);
		this.onError = options.onError;
		this.setTimer = options.setTimer ?? defaultSetTimer;
		this.clearTimer = options.clearTimer ?? defaultClearTimer;
	}

	markChange() {
		this.pending = true;
		this.schedule(this.delayMs);
	}

	pause() {
		this.paused = true;
		this.clearPendingTimer();
	}

	resume() {
		this.paused = false;
		this.schedule(this.delayMs);
	}

	cancelPending() {
		this.pending = false;
		this.clearPendingTimer();
	}

	cleanup() {
		this.cancelPending();
	}

	get isRunning() {
		return this.running;
	}

	get hasPendingChange() {
		return this.pending;
	}

	private clearPendingTimer() {
		if (this.timer) {
			this.clearTimer(this.timer);
			this.timer = null;
		}
	}

	private schedule(delayMs: number) {
		this.clearPendingTimer();
		if (!this.pending || this.paused || this.running) return;

		if (this.shouldDefer()) {
			this.timer = this.setTimer(() => {
				this.timer = null;
				this.schedule(this.retryDelayMs);
			}, this.retryDelayMs);
			return;
		}

		this.timer = this.setTimer(() => {
			this.timer = null;
			void this.run();
		}, delayMs);
	}

	private async run() {
		if (this.running) {
			this.pending = true;
			return;
		}

		if (this.paused || this.shouldDefer()) {
			this.schedule(this.retryDelayMs);
			return;
		}

		this.pending = false;
		this.running = true;

		try {
			await this.saveFunction();
		} catch (error) {
			this.onError?.(error);
		} finally {
			this.running = false;
			if (this.pending) {
				this.schedule(this.delayMs);
			}
		}
	}
}
