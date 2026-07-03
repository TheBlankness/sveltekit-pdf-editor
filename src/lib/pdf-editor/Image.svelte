<script>
	import { onMount, createEventDispatcher } from 'svelte';
	import { pannable } from './utils/pannable';
	import { readAsArrayBuffer } from './utils/asyncReader.js';
	/** @type {{payload: any, file: any, width: any, height: any, x: any, y: any, pageScale?: number}} */
	let { payload, file, width, height, x, y, pageScale = 1 } = $props();
	const dispatch = createEventDispatcher();
	let startX;
	let startY;
	let canvas = $state();
	let operation = $state('');
	let directions = [];
	let dx = $state(0);
	let dy = $state(0);
	let dw = $state(0);
	let dh = $state(0);
	async function render() {
		// use canvas to prevent img tag's auto resize
		canvas.width = width;
		canvas.height = height;
		canvas.getContext('2d').drawImage(payload, 0, 0);
		let scale = 1;
		const limit = 500;
		if (width > limit) {
			scale = limit / width;
		}
		if (height > limit) {
			scale = Math.min(scale, limit / height);
		}
		dispatch('update', {
			width: width * scale,
			height: height * scale
		});
		if (!['image/jpeg', 'image/png'].includes(file.type)) {
			canvas.toBlob((blob) => {
				dispatch('update', {
					file: blob
				});
			});
		}
	}
	function handlePanMove(event) {
		const _dx = (event.detail.x - startX) / pageScale;
		const _dy = (event.detail.y - startY) / pageScale;
		if (operation === 'move') {
			dx = _dx;
			dy = _dy;
		} else if (operation === 'scale') {
			if (directions.includes('left')) {
				dx = _dx;
				dw = -_dx;
			}
			if (directions.includes('top')) {
				dy = _dy;
				dh = -_dy;
			}
			if (directions.includes('right')) {
				dw = _dx;
			}
			if (directions.includes('bottom')) {
				dh = _dy;
			}
		}
	}

	function handlePanEnd(event) {
		if (operation === 'move') {
			dispatch('update', {
				x: x + dx,
				y: y + dy
			});
			dx = 0;
			dy = 0;
		} else if (operation === 'scale') {
			dispatch('update', {
				x: x + dx,
				y: y + dy,
				width: width + dw,
				height: height + dh
			});
			dx = 0;
			dy = 0;
			dw = 0;
			dh = 0;
			directions = [];
		}
		operation = '';
	}
	function handlePanStart(event) {
		startX = event.detail.x;
		startY = event.detail.y;
		if (event.detail.target === event.currentTarget) {
			return (operation = 'move');
		}
		operation = 'scale';
		directions = event.detail.target.dataset.direction.split('-');
	}
	function onDelete() {
		dispatch('delete');
	}
	onMount(render);
</script>

<div
	class="absolute top-0 left-0 select-none"
	style="width: {width + dw}px; height: {height + dh}px; transform: translate({x + dx}px,
  {y + dy}px);"
>
	<div
		use:pannable
		onpanstart={handlePanStart}
		onpanmove={handlePanMove}
		onpanend={handlePanEnd}
		class="absolute h-full w-full cursor-grab"
		class:cursor-grabbing={operation === 'move'}
		class:operation
	>
		<div
			data-direction="left"
			class="absolute top-0 left-0 h-full w-1 cursor-ew-resize border-l border-dashed border-gray-600"
		></div>
		<div
			data-direction="top"
			class="absolute top-0 left-0 h-1 w-full cursor-ns-resize border-t border-dashed border-gray-600"
		></div>
		<div
			data-direction="bottom"
			class="absolute bottom-0 left-0 h-1 w-full cursor-ns-resize border-b border-dashed border-gray-600"
		></div>
		<div
			data-direction="right"
			class="absolute top-0 right-0 h-full w-1 cursor-ew-resize border-r border-dashed border-gray-600"
		></div>
		<div
			data-direction="left-top"
			class="absolute top-0 left-0 h-10 w-10 -translate-x-1/2 -translate-y-1/2 transform cursor-nwse-resize
      rounded-full bg-blue-300 md:scale-25"
		></div>
		<div
			data-direction="right-top"
			class="absolute top-0 right-0 h-10 w-10 translate-x-1/2 -translate-y-1/2 transform cursor-nesw-resize
      rounded-full bg-blue-300 md:scale-25"
		></div>
		<div
			data-direction="left-bottom"
			class="absolute bottom-0 left-0 h-10 w-10 -translate-x-1/2 translate-y-1/2 transform cursor-nesw-resize
      rounded-full bg-blue-300 md:scale-25"
		></div>
		<div
			data-direction="right-bottom"
			class="absolute right-0 bottom-0 h-10 w-10 translate-x-1/2 translate-y-1/2 transform cursor-nwse-resize
      rounded-full bg-blue-300 md:scale-25"
		></div>
	</div>
	<button
		aria-label="delete object"
		onclick={onDelete}
		class="absolute top-0 right-0 left-0 m-auto h-12 w-12 -translate-y-1/2 transform
    cursor-pointer rounded-full bg-white md:scale-25"
	>
		<img class="h-full w-full" src="/icons/delete.svg" alt="delete object" />
	</button>
	<canvas class="h-full w-full" bind:this={canvas}></canvas>
</div>
