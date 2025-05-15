<svelte:options immutable={true} />

<script lang="ts">
	import { onMount } from 'svelte';

	// Component props with TypeScript types
	export let originWidth: number;
	export let originHeight: number;
	export let width: number;
	export let x: number;
	export let y: number;
	export let path: string;
	export let brushSize: number;
	export let brushColor: string;

	// Local component state
	let svg: SVGSVGElement;
	let dx = 0;
	let dy = 0;
	let dw = 0;
	const ratio = originWidth / originHeight;

	async function render(): Promise<void> {
		if (svg) {
			svg.setAttribute('viewBox', `0 0 ${originWidth} ${originHeight}`);
		}
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
