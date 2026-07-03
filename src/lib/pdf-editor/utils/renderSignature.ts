const HASH_OFFSET = 2166136261;
const HASH_PRIME = 16777619;

export function createRenderSignature() {
	return HASH_OFFSET;
}

export function mixRenderSignature(hash: number, value: number) {
	return Math.imul(hash ^ (value >>> 0), HASH_PRIME) >>> 0;
}
