export function ggID() {
	return function genId() {
		return Date.now().toString();
	};
}
export function timeout(ms) {
	return new Promise((res) => setTimeout(res, ms));
}
export const noop = () => {};
