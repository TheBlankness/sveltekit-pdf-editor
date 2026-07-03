export const TOAST_ERROR = 'error';
export const TOAST_WARNING = 'warning';
export const TOAST_SUCCESS = 'success';

type ToastOptions = {
	theme?: string;
};

function log(message: unknown, options: ToastOptions = {}) {
	const text = String(message ?? '');
	if (!text) return;

	if (options.theme === TOAST_ERROR) {
		console.error(text);
		return;
	}

	if (options.theme === TOAST_WARNING) {
		console.warn(text);
		return;
	}

	console.info(text);
}

export const toast = {
	push: log
};
