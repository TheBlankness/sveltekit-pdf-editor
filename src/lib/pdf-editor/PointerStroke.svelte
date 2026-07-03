<script>
	import { onMount } from 'svelte';

	let { originWidth, originHeight, width, x = 0, y = 0, path, strokeWidth, strokeColor, opacity = 1, stroke } = $props();

	let svg = $state();
	let dx = 0;
	let dy = 0;
	const ratio = originWidth / originHeight;

	onMount(() => {
		svg.setAttribute('viewBox', `0 0 ${originWidth} ${originHeight}`);
	});

	// Generate rainbow gradient ID unique to this stroke
	const gradientId = `rainbow-gradient-${stroke.id}`;
</script>

<div
	class="absolute top-0 left-0 select-none"
	style="width: {width}px; height: {width / ratio}px; transform:
  translate({x + dx}px, {y + dy}px);"
>
	<svg bind:this={svg} width="100%" height="100%">
		<defs>
			<linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
				<stop offset="0%" style="stop-color:#ff0000;stop-opacity:1" />
				<stop offset="16.66%" style="stop-color:#ff8000;stop-opacity:1" />
				<stop offset="33.33%" style="stop-color:#ffff00;stop-opacity:1" />
				<stop offset="50%" style="stop-color:#00ff00;stop-opacity:1" />
				<stop offset="66.66%" style="stop-color:#0080ff;stop-opacity:1" />
				<stop offset="83.33%" style="stop-color:#8000ff;stop-opacity:1" />
				<stop offset="100%" style="stop-color:#ff0080;stop-opacity:1" />
			</linearGradient>
		</defs>
		<path
			stroke-width={strokeWidth}
			stroke-linejoin="round"
			stroke-linecap="round"
			stroke={`url(#${gradientId})`}
			fill="none"
			d={path}
			opacity={opacity}
		/>
	</svg>
</div>
