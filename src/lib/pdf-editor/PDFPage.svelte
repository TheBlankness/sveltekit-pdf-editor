<script>
	import { onMount, onDestroy, createEventDispatcher, afterUpdate } from 'svelte';
	export let page;
	export let zoom;
	// Create a writable store for the coordinates
	const dispatch = createEventDispatcher();
	let canvas;
	let width;
	let height;
	let clientWidth;
	let mounted;
	let prevZoom = null;
	function measure() {
		dispatch('measure', {
			scale: canvas.clientWidth / width
		});
	}
	async function render() {
		const _page = await page;
		const context = canvas.getContext('2d');
		const viewport = _page.getViewport({ scale: zoom, rotation: 0 });
		width = viewport.width;
		height = viewport.height;
		await _page.render({
			canvasContext: context,
			viewport
		}).promise;
		measure();
		window.addEventListener('resize', measure);
	}
	// onMount(render);
	afterUpdate(() => {
		if (zoom !== prevZoom) {
			// Check if zoom value has changed
			render();
			prevZoom = zoom; // Update prevZoom to current zoom value
		}
	});
	onDestroy(() => {
		window.removeEventListener('resize', measure);
	});
</script>

<div class="">
	<canvas
		bind:this={canvas}
		class={zoom === 1 ? 'max-w-full' : ''}
		style="width: {width}px;"
		{width}
		{height}
	/>
</div>
