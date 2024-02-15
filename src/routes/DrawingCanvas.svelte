<script>
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { pannable } from './utils/pannable.js';
	import Toolbar from './Toolbar.svelte';

	export let page;
	export let pageScale;
	// Variables for canvas offset
	let canvasRect;

	const dispatch = createEventDispatcher();
	let canvas;
	let x = 0;
	let y = 0;
	let path = '';
	$: paths = [];
	let drawing = false;
	let pageNumber;
	let showToolbar = false;

	onMount(async() => {
		const _page = await page;
		pageNumber = _page._pageIndex
		showToolbar = true;
		canvasRect = canvas?.getBoundingClientRect();
		window.addEventListener('resize', handleResize);
		window.addEventListener('scroll', handleResize);
	});

	function handleResize() {
		canvasRect = canvas?.getBoundingClientRect();
	}

	onDestroy(() => {
		window.removeEventListener('scroll', handleResize);
		window.removeEventListener('resize', handleResize);
	});

	async function handlePanStart(event) {
		if (event.detail.target !== canvas) {
			return (drawing = false);
		}
		drawing = true;
		
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

		// Adjust x and y based on canvas offset
		const currentX = event.detail.x - canvasRect.left;
		const currentY = event.detail.y - canvasRect.top;

		paths.push(['L', currentX, currentY]);
		path += `L${currentX},${currentY}`;
	}

	function handlePanEnd() {
		
		// drawing = false;
		finish()
	}

	function finish() {
		// if (!paths.length) return;
		// Adjust the coordinates based on the page scale
		const scaledPaths = paths.map(([command, x, y]) => [command, x / pageScale, y / pageScale]);
		showToolbar = false;

		dispatch('finish', {
			originWidth: canvasRect.width / pageScale,
			originHeight: canvasRect.height / pageScale,
			path: scaledPaths.reduce((acc, cur) => {
				return acc + cur[0] + cur[1] + ',' + cur[2];
			}, '')
		});
	}

	function cancel() {
		showToolbar = false;
		dispatch('cancel');
	}
</script>
<!-- {#if pageNumber === 0}
<Toolbar>
	<div class="absolute right-0 bottom-0 mr-4 mb-4 flex">
		<button
			on:click={cancel}
			class=" w-24 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-4
      rounded mr-4"
		>
			Cancel
		</button>
		<button
			on:click={finish}
			class="w-24 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-4
      rounded"
		>
			Done
		</button>
	</div>
</Toolbar>
{/if} -->
<div
	bind:this={canvas}
	use:pannable
	on:panstart={handlePanStart}
	on:panmove={handlePanMove}
	on:panend={handlePanEnd}
	class="absolute top-0 left-0 w-full h-full select-none"
>
	<svg class="w-full h-full pointer-events-none">
		<path
			stroke-width="5"
			stroke-linejoin="round"
			stroke-linecap="round"
			d={path}
			stroke="black"
			fill="none"
		/>
	</svg>
</div>
