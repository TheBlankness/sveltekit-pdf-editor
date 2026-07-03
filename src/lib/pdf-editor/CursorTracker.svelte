<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let {
		pageScale = 1,
		onCursorMove = () => {},
		onCursorClicked = () => {},
		showDebugInfo = false
	} = $props();

	let container: HTMLDivElement | undefined = $state();
	let cursorX = $state(0);
	let cursorY = $state(0);
	let scaledX = $state(0);
	let scaledY = $state(0);
	let isTracking = $state(false);

	onMount(() => {
		setupTracking();
	});

	onDestroy(() => {
		cleanupTracking();
	});

	function setupTracking() {
		if (!container) return;

		// Movement event listeners
		container.addEventListener('mousemove', handleMouseMove);
		container.addEventListener('pointermove', handlePointerMove);
		container.addEventListener('touchmove', handleTouchMove, { passive: true });

		// Click/Touch event listeners
		container.addEventListener('click', handleClick);
		container.addEventListener('pointerdown', handlePointerDown);
		container.addEventListener('touchstart', handleTouchStart, { passive: true });

		// Enter/Leave event listeners
		container.addEventListener('mouseenter', handleMouseEnter);
		container.addEventListener('mouseleave', handleMouseLeave);
		container.addEventListener('pointerenter', handlePointerEnter);
		container.addEventListener('pointerleave', handlePointerLeave);
	}

	function cleanupTracking() {
		if (!container) return;

		// Remove movement listeners
		container.removeEventListener('mousemove', handleMouseMove);
		container.removeEventListener('pointermove', handlePointerMove);
		container.removeEventListener('touchmove', handleTouchMove);

		// Remove click/touch listeners
		container.removeEventListener('click', handleClick);
		container.removeEventListener('pointerdown', handlePointerDown);
		container.removeEventListener('touchstart', handleTouchStart);

		// Remove enter/leave listeners
		container.removeEventListener('mouseenter', handleMouseEnter);
		container.removeEventListener('mouseleave', handleMouseLeave);
		container.removeEventListener('pointerenter', handlePointerEnter);
		container.removeEventListener('pointerleave', handlePointerLeave);
	}

	function updateCursorPosition(clientX: number, clientY: number) {
		if (!container) return;

		const rect = container.getBoundingClientRect();

		// Get coordinates relative to the container
		const relativeX = clientX - rect.left;
		const relativeY = clientY - rect.top;

		// Update raw coordinates
		cursorX = relativeX;
		cursorY = relativeY;

		// Calculate scaled coordinates (same as your drawing logic)
		scaledX = relativeX / pageScale;
		scaledY = relativeY / pageScale;

		// Call the callback with coordinate data
		onCursorMove({
			raw: { x: relativeX, y: relativeY },
			scaled: { x: scaledX, y: scaledY },
			pageScale: pageScale,
			clientX,
			clientY
		});
	}

	function handleClickAtPosition(clientX: number, clientY: number) {
		if (!container) return;

		const rect = container.getBoundingClientRect();
		const relativeX = clientX - rect.left;
		const relativeY = clientY - rect.top;
		const scaledClickX = relativeX / pageScale;
		const scaledClickY = relativeY / pageScale;

		// Fire the click callback with scaled coordinates
		onCursorClicked({
			raw: { x: relativeX, y: relativeY },
			scaled: { x: scaledClickX, y: scaledClickY },
			pageScale: pageScale,
			clientX,
			clientY
		});
	}

	// Movement handlers
	function handleMouseMove(event: MouseEvent) {
		updateCursorPosition(event.clientX, event.clientY);
	}

	function handlePointerMove(event: PointerEvent) {
		// Only track if it's not a pen (to avoid conflicts with drawing)
		if (event.pointerType !== 'pen') {
			updateCursorPosition(event.clientX, event.clientY);
		}
	}

	function handleTouchMove(event: TouchEvent) {
		// Only track single touch to avoid conflicts with multi-touch gestures
		if (event.touches.length === 1) {
			const touch = event.touches[0];
			updateCursorPosition(touch.clientX, touch.clientY);
		}
	}

	// Click/Touch handlers
	function handleClick(event: MouseEvent) {
		event.preventDefault();
		handleClickAtPosition(event.clientX, event.clientY);
	}

	function handlePointerDown(event: PointerEvent) {
		// Only handle if it's not a pen (to avoid conflicts with drawing)
		if (event.pointerType !== 'pen') {
			event.preventDefault();
			handleClickAtPosition(event.clientX, event.clientY);
		}
	}

	function handleTouchStart(event: TouchEvent) {
		// Only handle single touch
		if (event.touches.length === 1) {
			const touch = event.touches[0];
			handleClickAtPosition(touch.clientX, touch.clientY);
		}
	}

	// Enter/Leave handlers
	function handleMouseEnter() {
		isTracking = true;
	}

	function handleMouseLeave() {
		isTracking = false;
	}

	function handlePointerEnter(event: PointerEvent) {
		if (event.pointerType !== 'pen') {
			isTracking = true;
		}
	}

	function handlePointerLeave(event: PointerEvent) {
		if (event.pointerType !== 'pen') {
			isTracking = false;
		}
	}
</script>

<!-- Invisible overlay that captures cursor events -->
<div
	bind:this={container}
	class="pointer-events-auto absolute top-0 left-0 h-full w-full"
	style="z-index: 1;"
>
	<!-- Optional debug info -->
	{#if showDebugInfo && isTracking}
		<div
			class="pointer-events-none absolute top-2 left-2 rounded bg-gray-900 p-2 text-xs text-white shadow-lg"
		>
			<div>Raw: ({cursorX.toFixed(1)}, {cursorY.toFixed(1)})</div>
			<div>Scaled: ({scaledX.toFixed(1)}, {scaledY.toFixed(1)})</div>
			<div>Scale: {pageScale.toFixed(2)}</div>
		</div>
	{/if}

	<!-- Optional cursor dot for visual feedback -->
	{#if isTracking && showDebugInfo}
		<div
			class="pointer-events-none absolute h-2 w-2 -translate-x-1 -translate-y-1 transform rounded-full bg-orange-400"
			style="left: {cursorX}px; top: {cursorY}px; z-index: 10;"
		></div>
	{/if}
</div>
