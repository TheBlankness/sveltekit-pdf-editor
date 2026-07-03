const PDF_EDITOR_REFRESH_BYPASS_KEY = 'pdf-editor-refresh-bypass-leave-warning';

export function requestPdfEditorRefreshBypass() {
	if (typeof sessionStorage === 'undefined') return;

	try {
		sessionStorage.setItem(PDF_EDITOR_REFRESH_BYPASS_KEY, 'true');
	} catch {
		// If storage is blocked, fall back to the normal navigation guard.
	}
}

export function consumePdfEditorRefreshBypass() {
	if (typeof sessionStorage === 'undefined') return false;

	try {
		if (sessionStorage.getItem(PDF_EDITOR_REFRESH_BYPASS_KEY) !== 'true') return false;
		sessionStorage.removeItem(PDF_EDITOR_REFRESH_BYPASS_KEY);
		return true;
	} catch {
		return false;
	}
}
