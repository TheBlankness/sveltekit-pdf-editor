<script lang="ts">
	import { LucideAward, LucideCheckCircle2, LucideStar, LucideThumbsUp } from 'lucide-svelte';
	import { getTeacherMarkColorPreset, getTeacherMarkIcon } from './utils/teacherMarkPresets';

	let {
		object,
		x = 0,
		y = 0,
		width = 60,
		height = 40,
		isSelected = false,
		isPreviewed = false
	} = $props();

	let markedBy = $derived(capitalizeFirstLetter(object?.markedBy || 'Teacher'));
	let markedAt = $derived(object?.markedAt || object?.updatedAt || new Date().toISOString());
	let label = $derived(object?.label || 'Marked correct');
	let baseFontSize = $derived(Math.max(4, Math.min(Number(object?.fontSize || 8), 24)));
	let displayMarkedAt = $derived(formatMarkedAt(markedAt));
	let compactScale = $derived(Math.max(0.5, Math.min(width / 60, height / 40, 1.35)));
	let labelFontSize = $derived(baseFontSize);
	let metaFontSize = $derived(baseFontSize * 0.68);
	let colorPreset = $derived(getTeacherMarkColorPreset(object?.stampColor));
	let stampIcon = $derived(getTeacherMarkIcon(object?.stampIcon));
	let iconSize = $derived(Math.max(8, baseFontSize * 1.8));
	let IconComponent = $derived(
		stampIcon === 'check-circle'
			? LucideCheckCircle2
			: stampIcon === 'thumbs-up'
				? LucideThumbsUp
				: stampIcon === 'star'
					? LucideStar
					: stampIcon === 'award'
						? LucideAward
						: null
	);

	function capitalizeFirstLetter(value: string) {
		const trimmed = String(value || '').trim();
		if (!trimmed) return 'Teacher';
		return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
	}

	function formatMarkedAt(value: string) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value || '';

		return date.toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div
	class="teacher-mark pointer-events-none absolute top-0 left-0 select-none"
	class:selected={isSelected}
	class:previewed={isPreviewed}
	style="
		transform: translate({x}px, {y}px);
		width: {width}px;
		height: {height}px;
		--compact-scale: {compactScale};
		--label-font-size: {labelFontSize}px;
		--meta-font-size: {metaFontSize}px;
		--stamp-border: {colorPreset.border};
		--stamp-background: {colorPreset.background};
		--stamp-text: {colorPreset.text};
		--stamp-meta: {colorPreset.meta};
		--stamp-time: {colorPreset.time};
	"
>
	<div class="teacher-mark__inner">
		{#if IconComponent}
			<div class="teacher-mark__icon">
				<IconComponent size={iconSize} strokeWidth={2.5} />
			</div>
		{/if}
		<div class="teacher-mark__content">
			<div class="teacher-mark__label">{label}</div>
			<div class="teacher-mark__meta">Stamped by {markedBy}</div>
			<div class="teacher-mark__time">{displayMarkedAt}</div>
		</div>
	</div>
</div>

<style>
	.teacher-mark {
		z-index: 12;
	}

	.teacher-mark__inner {
		display: flex;
		height: 100%;
		width: 100%;
		align-items: stretch;
		overflow: hidden;
		border: 1px solid var(--stamp-border);
		border-radius: 4px;
		background: var(--stamp-background);
		color: var(--stamp-text);
		font-family: Inter, Roboto, Arial, sans-serif;
		padding: 0 calc(2px * var(--compact-scale));
		text-transform: none;
	}

	.teacher-mark__content {
		min-width: 0;
		flex: 1;
		align-self: center;
	}

	.teacher-mark__icon {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		align-self: center;
		justify-content: center;
		margin-right: calc(2px * var(--compact-scale));
		color: var(--stamp-text);
	}

	.teacher-mark__label {
		overflow: hidden;
		font-size: var(--label-font-size);
		font-weight: 800;
		letter-spacing: 0;
		line-height: 1;
		text-transform: uppercase;
		white-space: normal;
		overflow-wrap: anywhere;
	}

	.teacher-mark__meta,
	.teacher-mark__time {
		overflow: hidden;
		font-size: var(--meta-font-size);
		font-weight: 700;
		line-height: 1.05;
		white-space: normal;
		overflow-wrap: anywhere;
	}

	.teacher-mark__meta {
		margin-top: 0;
		color: var(--stamp-meta);
	}

	.teacher-mark__time {
		color: var(--stamp-time);
	}

	.selected .teacher-mark__inner,
	.previewed .teacher-mark__inner {
		outline: 2px solid #2563eb;
		outline-offset: 3px;
	}
</style>
