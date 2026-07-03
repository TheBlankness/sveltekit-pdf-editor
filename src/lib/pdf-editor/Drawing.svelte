<script>
	import { getPathGeometry } from './utils/hitTest';
	import { isIOSLikeDevice } from './utils/liveStroke';

	let {
		originWidth,
		originHeight,
		width,
		x,
		y,
		path,
		scale: objectScale,
		rotation: objectRotation,
		brushSize,
		brushColor,
		object,
		user,
		pageScale = 1,
		screenScale = 1,
		stroke_visibility = $bindable('all'), // 'all', 'self', or 'others'
		isSelected = false,
		isPreviewed = false
	} = $props();

	let boundingBox = $derived.by(() => getPathGeometry(path || '').bbox);
	let scale = $derived(objectScale ?? object?.scale ?? (originWidth ? width / originWidth : 1));
	let rotation = $derived(objectRotation ?? object?.rotation ?? 0);
	let strokeOpacity = $derived.by(() => {
		const opacity = Number(object?.opacity);
		if (Number.isFinite(opacity)) return Math.max(0, Math.min(opacity, 1));
		return object?.type === 'highlight' ? 0.5 : 1;
	});
	let renderedStrokeOpacity = $derived(isHighlighted ? strokeOpacity * 0.3 : strokeOpacity);
	let anchorX = $derived(boundingBox ? boundingBox.x + boundingBox.width / 2 : 0);

	let anchorY = $derived(boundingBox ? boundingBox.y + boundingBox.height / 2 : 0);
	let safePageScale = $derived(Math.max(Math.abs(Number(pageScale) || 1), 0.1));
	let safeScreenScale = $derived(Math.max(Math.abs(Number(screenScale) || 1), 0.1));
	let useIOSSharpSvg = $derived(
		isIOSLikeDevice() && safeScreenScale === 1 && safePageScale > 1.01
	);
	let svgPreScale = $derived(useIOSSharpSvg ? Math.max(1, safePageScale) : safeScreenScale);
	let inverseSvgPreScale = $derived(1 / svgPreScale);
	let baseSvgWidth = $derived(Math.max(1, Number(originWidth) || 1));
	let baseSvgHeight = $derived(Math.max(1, Number(originHeight) || 1));
	let svgWidth = $derived(baseSvgWidth * svgPreScale);
	let svgHeight = $derived(baseSvgHeight * svgPreScale);
	let drawingX = $derived(Number.isFinite(Number(x)) ? Number(x) : 0);
	let drawingY = $derived(Number.isFinite(Number(y)) ? Number(y) : 0);
	let drawingContainerStyle = $derived(
		safeScreenScale !== 1
			? `transform: translate(${drawingX * safeScreenScale}px, ${drawingY * safeScreenScale}px);`
			: useIOSSharpSvg
			? `left: ${drawingX}px; top: ${drawingY}px; width: ${svgWidth}px; height: ${svgHeight}px; transform: scale(${inverseSvgPreScale});`
			: `transform: translate(${drawingX}px, ${drawingY}px);`
	);
	let drawingTransform = $derived(`
		translate(${anchorX} ${anchorY})
		rotate(${rotation})
		scale(${scale})
		translate(${-anchorX} ${-anchorY})
	`);
	function transformPoint(pointX, pointY) {
		const angle = (rotation * Math.PI) / 180;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const scaledX = (pointX - anchorX) * scale;
		const scaledY = (pointY - anchorY) * scale;

		return {
			x: anchorX + scaledX * cos - scaledY * sin,
			y: anchorY + scaledX * sin + scaledY * cos
		};
	}

	let scaledBoundingBox = $derived.by(() => {
		if (!boundingBox) return null;

		const corners = [
			transformPoint(boundingBox.x, boundingBox.y),
			transformPoint(boundingBox.x + boundingBox.width, boundingBox.y),
			transformPoint(boundingBox.x + boundingBox.width, boundingBox.y + boundingBox.height),
			transformPoint(boundingBox.x, boundingBox.y + boundingBox.height)
		];
		const left = Math.min(...corners.map((corner) => corner.x));
		const top = Math.min(...corners.map((corner) => corner.y));
		const right = Math.max(...corners.map((corner) => corner.x));
		const bottom = Math.max(...corners.map((corner) => corner.y));

		return {
			x: left,
			y: top,
			width: right - left,
			height: bottom - top
		};
	});
	// Check if this drawing is highlighted for erasure
	let isHighlighted = $derived(object?._eraserHighlight === true);
	let shouldRenderStroke = $derived(
		stroke_visibility === 'all' ||
			(stroke_visibility === 'self' &&
				(object?.owner === user || object?.owner === `global-${user}`)) ||
			(stroke_visibility === 'others' &&
				object?.owner !== user &&
				object?.owner !== `global-${user}`)
	);

</script>

<!-- All pointer events disabled - selection handled by PDFEditor hit-testing -->
<div
	class="drawing-container pointer-events-none absolute top-0 left-0"
	style={drawingContainerStyle}
>
	<!-- SVG container sized to the actual drawing bounds -->
	<svg
		class="pointer-events-none overflow-visible"
		width={svgWidth}
		height={svgHeight}
		viewBox={`0 0 ${baseSvgWidth} ${baseSvgHeight}`}
	>
		<!-- Selection bounding box (shown when selected) -->
		{#if isSelected && scaledBoundingBox}
			<rect
				x={scaledBoundingBox.x}
				y={scaledBoundingBox.y}
				width={scaledBoundingBox.width}
				height={scaledBoundingBox.height}
				fill="none"
				stroke="rgba(59, 130, 246, 0.3)"
				stroke-width={1 / safePageScale}
				class="selection-box"
			/>
		{/if}

		{#if isPreviewed && scaledBoundingBox}
			<rect
				x={scaledBoundingBox.x}
				y={scaledBoundingBox.y}
				width={scaledBoundingBox.width}
				height={scaledBoundingBox.height}
				fill="rgba(245, 158, 11, 0.08)"
				stroke="rgba(217, 119, 6, 0.8)"
				stroke-width={2 / safePageScale}
				class="preview-box"
			/>
		{/if}

		<!-- Eraser highlight overlay -->
		{#if isHighlighted && scaledBoundingBox}
			<rect
				x={scaledBoundingBox.x}
				y={scaledBoundingBox.y}
				width={scaledBoundingBox.width}
				height={scaledBoundingBox.height}
				fill="rgba(239, 68, 68, 0.1)"
				stroke="rgba(239, 68, 68, 0.5)"
				stroke-width={2 / safePageScale}
				class="eraser-highlight-box"
			/>
		{/if}

		<!-- The actual path rendering -->
		{#if shouldRenderStroke}
			<path
				stroke-width={brushSize}
				stroke-linejoin="round"
				stroke-linecap="round"
				stroke={brushColor}
				fill="none"
				d={path}
				transform={drawingTransform}
				opacity={renderedStrokeOpacity}
			/>
		{/if}
	</svg>
</div>

<style>
	.selection-box {
		transition: stroke-width 0.15s ease;
		/* Optimize selection box rendering */
		shape-rendering: geometricPrecision;
	}

	.eraser-highlight-box {
		animation: pulse-highlight 0.5s ease-in-out infinite alternate;
	}

	.preview-box {
		animation: preview-pulse 0.75s ease-in-out infinite alternate;
		shape-rendering: geometricPrecision;
	}

	@keyframes pulse-highlight {
		from {
			opacity: 0.3;
		}
		to {
			opacity: 0.7;
		}
	}

	@keyframes preview-pulse {
		from {
			opacity: 0.65;
		}
		to {
			opacity: 1;
		}
	}

	.overflow-visible {
		overflow: visible;
	}

	.pointer-events-none {
		pointer-events: none;
	}

	.drawing-container {
		transform-origin: top left;
	}
</style>
