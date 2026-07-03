type DraftRegistration = {
	pending: boolean;
	flush: () => Promise<unknown>;
};

const activeDrafts = new Map<string, DraftRegistration>();

export function registerEditorDraft(scopeKey: string, flush: () => Promise<unknown>) {
	activeDrafts.set(scopeKey, { pending: false, flush });
	return () => activeDrafts.delete(scopeKey);
}

export function setEditorDraftPending(scopeKey: string, pending: boolean) {
	const registration = activeDrafts.get(scopeKey);
	if (registration) registration.pending = pending;
}

export function hasActiveEditorDrafts() {
	return Array.from(activeDrafts.values()).some((draft) => draft.pending);
}

export async function flushActiveEditorDrafts() {
	const drafts = Array.from(activeDrafts.values()).filter((draft) => draft.pending);
	const results = await Promise.allSettled(drafts.map((draft) => draft.flush()));
	return {
		total: results.length,
		failed: results.filter((result) => result.status === 'rejected').length
	};
}
