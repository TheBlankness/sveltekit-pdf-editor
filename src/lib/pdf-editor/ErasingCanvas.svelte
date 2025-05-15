<script>
	import { createEventDispatcher, onMount } from 'svelte';
	import { pannable } from './utils/pannable.js';

	export let page;
	export let pageScale;
	export let brushSize;
	export let brushColor;
	export let pageAnnotations;

	const dispatch = createEventDispatcher();
	let canvas;
	let x = 0;
	let y = 0;
	let path = '';
	let drawing = false;
	let pageNumber;
	let showToolbar = false;
	let cursor; // Custom cursor element

	// Watch for changes in brushSize to update cursor
	$: if (cursor && brushSize) {
		updateCursor(brushSize);
	}

	onMount(async () => {
		const _page = await page;
		pageNumber = _page._pageIndex;
		showToolbar = true;

		// Create custom cursor element
		createCustomCursor();
	});

	// Function to create the custom cursor
	function createCustomCursor() {
		// Create cursor element if it doesn't exist
		if (!cursor) {
			cursor = document.createElement('div');
			cursor.id = 'custom-cursor';
			cursor.className =
				'pointer-events-none fixed rounded-full border border-black bg-white bg-opacity-30 z-50 hidden';
			document.body.appendChild(cursor);

			// Initial cursor update
			updateCursor(brushSize);

			// Add mousemove event to the canvas
			if (canvas) {
				canvas.addEventListener('mousemove', handleMouseMove);
				canvas.addEventListener('mouseenter', () => {
					cursor.classList.remove('hidden');
				});
				canvas.addEventListener('mouseleave', () => {
					cursor.classList.add('hidden');
				});
			}
		}
	}

	// Update cursor size based on brushSize
	function updateCursor(size) {
		if (cursor) {
			const cursorSize = size * pageScale; // Adjust size based on page scale
			cursor.style.width = `${cursorSize}px`;
			cursor.style.height = `${cursorSize}px`;
			cursor.style.marginLeft = `-${cursorSize / 2}px`;
			cursor.style.marginTop = `-${cursorSize / 2}px`;
			console.log('Cursor size updated:', cursorSize);
		}
	}

	// Handle mouse movement to position cursor
	function handleMouseMove(event) {
		if (cursor) {
			cursor.style.left = `${event.clientX}px`;
			cursor.style.top = `${event.clientY}px`;
		}
	}

	async function handlePanStart(event) {
		if (event.detail.target !== canvas) {
			return (drawing = false);
		}
		drawing = true;

		let canvasRect = canvas?.getBoundingClientRect();

		// Adjust x and y based on canvas offset and scale
		x = (event.detail.x - canvasRect.left) / pageScale;
		y = (event.detail.y - canvasRect.top) / pageScale;

		const currentX = (event.detail.x - canvasRect.left) / pageScale;
		const currentY = (event.detail.y - canvasRect.top) / pageScale;
		let objectstatus = detectIfPointerTouchesDrawing(currentX, currentY, pageAnnotations);
		if (objectstatus?.touched) {
			dispatch('finish', {
				objectId: objectstatus.id
			});
		}
	}

	function handlePanMove(event) {
		if (!drawing) return;
		let canvasRect = canvas?.getBoundingClientRect();

		// Adjust x and y based on canvas offset and scale
		const currentX = (event.detail.x - canvasRect.left) / pageScale;
		const currentY = (event.detail.y - canvasRect.top) / pageScale;

		let objectstatus = detectIfPointerTouchesDrawing(currentX, currentY, pageAnnotations);

		if (objectstatus?.touched) {
			dispatch('finish', {
				objectId: objectstatus.id
			});
		}
	}

	function handlePanEnd() {
		// drawing = false;
		finish();
	}

	function finish() {}

	function detectIfPointerTouchesDrawing(x, y, drawings) {
		function parsePath(path) {
			const commands = path.split('L').map((cmd) => cmd.replace('M', '').trim());
			return commands.map((cmd) => {
				const [x, y] = cmd.split(',').map(Number);
				return { x, y };
			});
		}

		function isPointNearLineSegment(px, py, x1, y1, x2, y2, threshold = 7) {
			const A = px - x1;
			const B = py - y1;
			const C = x2 - x1;
			const D = y2 - y1;

			const dot = A * C + B * D;
			const len_sq = C * C + D * D;
			const param = len_sq !== 0 ? dot / len_sq : -1;

			let xx, yy;

			if (param < 0) {
				xx = x1;
				yy = y1;
			} else if (param > 1) {
				xx = x2;
				yy = y2;
			} else {
				xx = x1 + param * C;
				yy = y1 + param * D;
			}

			const dx = px - xx;
			const dy = py - yy;
			return Math.sqrt(dx * dx + dy * dy) < threshold;
		}

		for (const drawing of drawings) {
			if (drawing.type === 'text') return { touched: false, id: null };
			const points = parsePath(drawing.path);
			for (let i = 0; i < points.length - 1; i++) {
				const { x: x1, y: y1 } = points[i];
				const { x: x2, y: y2 } = points[i + 1];
				if (isPointNearLineSegment(x, y, x1, y1, x2, y2, brushSize)) {
					return {
						touched: true,
						id: drawing.id
					};
				}
			}
		}

		return { touched: false, id: null };
	}
</script>

<div
	bind:this={canvas}
	use:pannable
	on:panstart={handlePanStart}
	on:panmove={handlePanMove}
	on:panend={handlePanEnd}
	class="absolute top-0 left-0 w-full h-full select-none cursor-none"
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
