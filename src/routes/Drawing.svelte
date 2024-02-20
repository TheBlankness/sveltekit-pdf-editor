<svelte:options immutable={true} />

<script>
	import { onMount } from 'svelte';

	export let originWidth;
	export let originHeight;
	export let width;
	export let x;
	export let y;
	export let pageScale = 1;
	export let path;
	export let brushSize;
	export let brushColor;

	let svg;
	let dx = 0;
	let dy = 0;
	let dw = 0;
	const ratio = originWidth / originHeight;
	async function render() {
		svg.setAttribute('viewBox', `0 0 ${originWidth} ${originHeight}`);
	}

	onMount(render);
</script>

<div
	class="absolute left-0 top-0 select-none"
	style="width: {width + dw}px; height: {(width + dw) / ratio}px; transform:
  translate({x + dx}px, {y + dy}px);"
>
	<div class="absolute w-full h-full"></div>

	<svg bind:this={svg} width="100%" height="100%">
		<path
			stroke-width={brushSize}
			stroke-linejoin="round"
			stroke-linecap="round"
			stroke={brushColor}
			fill="none"
			d={path}
		/>
	</svg>
</div>
