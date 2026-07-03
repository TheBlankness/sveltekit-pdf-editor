export type RevisionedPageSnapshot<T> = {
	scopeKey: string;
	documentId: string | number | null;
	annotationId: string | number | null;
	pageNo: number;
	revision: number;
	payload: T;
};

type SnapshotInput<T> = Omit<RevisionedPageSnapshot<T>, 'revision'>;

type SaveCoordinatorOptions<T, TResult> = {
	capture: () => SnapshotInput<T>;
	persistLocal: (snapshot: RevisionedPageSnapshot<T>) => Promise<void>;
	saveRemote: (snapshot: RevisionedPageSnapshot<T>) => Promise<TResult>;
	localDelayMs?: number;
	onLocalPersisted?: (snapshot: RevisionedPageSnapshot<T>) => void;
	onLocalPersistFailed?: (snapshot: RevisionedPageSnapshot<T>, error: unknown) => void;
	onSaveStarted?: (snapshot: RevisionedPageSnapshot<T>) => void;
	onSaveFinished?: (
		snapshot: RevisionedPageSnapshot<T>,
		result: TResult,
		isLatestRevision: boolean
	) => void;
	onSaveFailed?: (
		snapshot: RevisionedPageSnapshot<T>,
		error: unknown,
		isLatestRevision: boolean
	) => void;
};

type QueuedSave<T, TResult> = {
	snapshot: RevisionedPageSnapshot<T>;
	resolve: (result: TResult) => void;
	reject: (error: unknown) => void;
};

function clonePayload<T>(payload: T): T {
	if (typeof structuredClone === 'function') {
		try {
			return structuredClone(payload);
		} catch {
			// Fall back to JSON for annotation objects containing reactive wrappers.
		}
	}
	return JSON.parse(JSON.stringify(payload));
}

export class PageSaveCoordinator<T, TResult> {
	private revision = 0;
	private latestSnapshot: RevisionedPageSnapshot<T> | null = null;
	private localTimer: ReturnType<typeof setTimeout> | null = null;
	private locallyPersistedRevision = 0;
	private localPersistenceChain: Promise<void> = Promise.resolve();
	private queue: Array<QueuedSave<T, TResult>> = [];
	private running = false;
	private pendingByRevision = new Map<number, Promise<TResult>>();
	private options: SaveCoordinatorOptions<T, TResult>;

	constructor(options: SaveCoordinatorOptions<T, TResult>) {
		this.options = options;
	}

	markChanged() {
		this.revision += 1;
		this.latestSnapshot = this.capture(this.revision);
		this.scheduleLocalPersistence();
		return this.latestSnapshot;
	}

	hasPendingChanges() {
		return Boolean(
			this.latestSnapshot &&
				(this.latestSnapshot.revision > this.locallyPersistedRevision ||
					this.pendingByRevision.has(this.latestSnapshot.revision))
		);
	}

	isLatestRevision(revision: number) {
		return revision === this.revision;
	}

	async flushLocal() {
		this.clearLocalTimer();
		const snapshot = this.latestSnapshot;
		if (!snapshot) return snapshot;

		const persist = this.localPersistenceChain.then(async () => {
			if (snapshot.revision <= this.locallyPersistedRevision) return;
			await this.options.persistLocal(snapshot);
			this.locallyPersistedRevision = Math.max(this.locallyPersistedRevision, snapshot.revision);
			this.options.onLocalPersisted?.(snapshot);
		});
		this.localPersistenceChain = persist.catch(() => {});
		await persist;
		return snapshot;
	}

	async saveNow() {
		const snapshot = this.latestSnapshot || this.capture(this.revision);
		this.latestSnapshot = snapshot;
		await this.flushLocal();

		const existing = this.pendingByRevision.get(snapshot.revision);
		if (existing) return existing;

		const promise = new Promise<TResult>((resolve, reject) => {
			this.queue.push({ snapshot, resolve, reject });
		});
		this.pendingByRevision.set(snapshot.revision, promise);
		void this.drain();
		return promise;
	}

	destroy() {
		this.clearLocalTimer();
	}

	private capture(revision: number): RevisionedPageSnapshot<T> {
		const snapshot = this.options.capture();
		return {
			...snapshot,
			revision,
			payload: clonePayload(snapshot.payload)
		};
	}

	private scheduleLocalPersistence() {
		this.clearLocalTimer();
		this.localTimer = setTimeout(() => {
			this.localTimer = null;
			const snapshot = this.latestSnapshot;
			void this.flushLocal().catch((error) => {
				if (snapshot) this.options.onLocalPersistFailed?.(snapshot, error);
			});
		}, this.options.localDelayMs ?? 250);
	}

	private clearLocalTimer() {
		if (!this.localTimer) return;
		clearTimeout(this.localTimer);
		this.localTimer = null;
	}

	private async drain() {
		if (this.running) return;
		this.running = true;

		try {
			while (this.queue.length > 0) {
				const request = this.queue.shift();
				if (!request) continue;

				this.options.onSaveStarted?.(request.snapshot);
				try {
					const result = await this.options.saveRemote(request.snapshot);
					this.options.onSaveFinished?.(
						request.snapshot,
						result,
						this.isLatestRevision(request.snapshot.revision)
					);
					request.resolve(result);
				} catch (error) {
					this.options.onSaveFailed?.(
						request.snapshot,
						error,
						this.isLatestRevision(request.snapshot.revision)
					);
					request.reject(error);
				} finally {
					this.pendingByRevision.delete(request.snapshot.revision);
				}
			}
		} finally {
			this.running = false;
			if (this.queue.length > 0) void this.drain();
		}
	}
}
