<script>
	import { createEventDispatcher, onMount } from 'svelte';
	import { pannable } from './utils/pannable.js';

	export let page;
	export let pageScale;
	export let brushSize;
	export let brushColor;
	// Variables for canvas offset

	const dispatch = createEventDispatcher();
	let canvas;
	let x = 0;
	let y = 0;
	let path = '';
	$: paths = [];
	let drawing = false;
	let pageNumber;
	let showToolbar = false;

	onMount(async () => {
		const _page = await page;
		pageNumber = _page._pageIndex;
		showToolbar = true;
	});

	async function handlePanStart(event) {
		if (event.detail.target !== canvas) {
			return (drawing = false);
		}
		drawing = true;

		let canvasRect = canvas?.getBoundingClientRect();

		// Adjust x and y based on canvas offset
		x = event.detail.x - canvasRect.left;
		y = event.detail.y - canvasRect.top;

		paths.push(['M', x, y]);
		path += `M${x},${y}`;

		const currentX = event.detail.x - canvasRect.left;
		const currentY = event.detail.y - canvasRect.top;
		paths.push(['L', currentX, currentY]);
		path += `L${currentX},${currentY}`;
	}

	function handlePanMove(event) {
		if (!drawing) return;
		let canvasRect = canvas?.getBoundingClientRect();

		// Adjust x and y based on canvas offset
		const currentX = event.detail.x - canvasRect.left;
		const currentY = event.detail.y - canvasRect.top;

		paths.push(['L', currentX, currentY]);
		path += `L${currentX},${currentY}`;
	}

	function handlePanEnd() {
		// drawing = false;
		finish();
	}

	function finish() {
		// if (!paths.length) return;
		// Adjust the coordinates based on the page scale
		const scaledPaths = paths.map(([command, x, y]) => [command, x / pageScale, y / pageScale]);
		showToolbar = false;
		let canvasRect = canvas?.getBoundingClientRect();

		dispatch('finish', {
			originWidth: canvasRect.width / pageScale,
			originHeight: canvasRect.height / pageScale,
			path: scaledPaths.reduce((acc, cur) => {
				return acc + cur[0] + cur[1] + ',' + cur[2];
			}, ''),
			brushSize: brushSize,
			brushColor: brushColor
		});
	}
</script>

<div
	bind:this={canvas}
	use:pannable
	on:panstart={handlePanStart}
	on:panmove={handlePanMove}
	on:panend={handlePanEnd}
	class="absolute top-0 left-0 w-full h-full select-none"
	style="cursor: crosshair;"
>
	<svg class="w-full h-full pointer-events-none">
		<path
			stroke-width={brushSize}
			stroke-linejoin="round"
			stroke-linecap="round"
			d={path}
			stroke={brushColor}
			fill="none"
		/>
	</svg>
</div>
