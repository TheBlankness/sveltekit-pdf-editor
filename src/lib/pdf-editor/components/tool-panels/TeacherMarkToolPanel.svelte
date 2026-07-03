<script lang="ts">
	import {
		LucideAward,
		LucideCheckCircle2,
		LucideCircleOff,
		LucideClock,
		LucideMinus,
		LucidePlus,
		LucideStar,
		LucideThumbsUp,
		LucideTrash2,
		LucideX
	} from 'lucide-svelte';
	import {
		getTeacherMarkColorPreset,
		getTeacherMarkIcon,
		teacherMarkColorPresets,
		teacherMarkIconPresets,
		teacherMarkLabelPresets,
		type TeacherMarkColor,
		type TeacherMarkIcon
	} from '../../utils/teacherMarkPresets';

	interface Props {
		object: any;
		onClose: () => void;
		onUpdate: (payload: Record<string, any>) => void;
		onDelete: () => void;
	}

	let { object, onClose, onUpdate, onDelete }: Props = $props();
	let markedByDraft = $state('');
	let markedAtDraft = $state('');
	let labelDraft = $state('');
	let fontSizeDraft = $state(8);
	let selectedColor = $derived(getTeacherMarkColorPreset(object?.stampColor).value);
	let selectedIcon = $derived(getTeacherMarkIcon(object?.stampIcon));
	const iconComponents = {
		none: LucideCircleOff,
		'check-circle': LucideCheckCircle2,
		'thumbs-up': LucideThumbsUp,
		star: LucideStar,
		award: LucideAward
	};

	function pad(value: number) {
		return String(value).padStart(2, '0');
	}

	function toDateTimeInputValue(value: string) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';

		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
			date.getHours()
		)}:${pad(date.getMinutes())}`;
	}

	function updateDrafts() {
		markedByDraft = capitalizeFirstLetter(object?.markedBy || 'Teacher');
		markedAtDraft = toDateTimeInputValue(object?.markedAt || new Date().toISOString());
		labelDraft = object?.label || 'Marked correct';
		fontSizeDraft = Math.max(4, Math.min(Number(object?.fontSize || 8), 24));
	}

	function capitalizeFirstLetter(value: string) {
		const trimmed = String(value || '').trim();
		if (!trimmed) return 'Teacher';
		return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
	}

	function commitMarkedBy() {
		markedByDraft = capitalizeFirstLetter(markedByDraft);
		onUpdate({ markedBy: markedByDraft });
	}

	function commitMarkedAt() {
		if (!markedAtDraft) return;
		const date = new Date(markedAtDraft);
		if (Number.isNaN(date.getTime())) return;
		onUpdate({ markedAt: date.toISOString() });
	}

	function commitLabel() {
		onUpdate({ label: labelDraft.trim() || 'Marked correct' });
	}

	function setLabelPreset(label: string) {
		labelDraft = label;
		onUpdate({ label });
	}

	function setStampColor(stampColor: TeacherMarkColor) {
		onUpdate({ stampColor });
	}

	function setStampIcon(stampIcon: TeacherMarkIcon) {
		onUpdate({ stampIcon });
	}

	function updateFontSize(size: number) {
		fontSizeDraft = Math.max(4, Math.min(Math.round(size), 24));
		onUpdate({ fontSize: fontSizeDraft });
	}

	function setNow() {
		const now = new Date();
		markedAtDraft = toDateTimeInputValue(now.toISOString());
		onUpdate({ markedAt: now.toISOString() });
	}

	$effect(() => {
		object?.id;
		updateDrafts();
	});
</script>

<div
	class="teacher-mark-tool-panel pdf-editor-touch-controls fixed top-20 right-3 z-[115] max-h-[calc(100vh-6rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-green-200 bg-white shadow-2xl"
>
	<div class="flex items-center justify-between border-b border-green-100 px-4 py-3">
		<div>
			<h3 class="text-sm font-semibold text-gray-900">Teacher Stamp</h3>
			<p class="text-xs text-gray-500">Visible to students on the marked page.</p>
		</div>
		<button
			type="button"
			onclick={onClose}
			class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
			title="Close"
		>
			<LucideX size={16} />
		</button>
	</div>

	<div class="space-y-3 p-4">
		<label class="block">
			<span class="mb-1 block text-xs font-semibold text-gray-600">Stamp label</span>
			<input
				type="text"
				bind:value={labelDraft}
				onchange={commitLabel}
				class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 focus:outline-none"
			/>
		</label>

		<div>
			<span class="mb-1.5 block text-xs font-semibold text-gray-600">Text presets</span>
			<div class="flex flex-wrap gap-2">
				{#each teacherMarkLabelPresets as preset}
					<button
						type="button"
						onclick={() => setLabelPreset(preset)}
						aria-pressed={labelDraft.trim().toLowerCase() === preset.toLowerCase()}
						class="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
						class:border-green-600={labelDraft.trim().toLowerCase() === preset.toLowerCase()}
						class:bg-green-50={labelDraft.trim().toLowerCase() === preset.toLowerCase()}
						class:text-green-700={labelDraft.trim().toLowerCase() === preset.toLowerCase()}
						class:border-gray-200={labelDraft.trim().toLowerCase() !== preset.toLowerCase()}
						class:text-gray-600={labelDraft.trim().toLowerCase() !== preset.toLowerCase()}
						class:hover:bg-gray-50={labelDraft.trim().toLowerCase() !== preset.toLowerCase()}
					>
						{preset}
					</button>
				{/each}
			</div>
		</div>

		<div>
			<span class="mb-1.5 block text-xs font-semibold text-gray-600">Stamp color</span>
			<div class="flex gap-3">
				{#each teacherMarkColorPresets as preset}
					<button
						type="button"
						onclick={() => setStampColor(preset.value)}
						aria-label={preset.label}
						aria-pressed={selectedColor === preset.value}
						title={preset.label}
						class="flex h-9 w-9 items-center justify-center rounded-full border bg-white transition-transform hover:scale-105"
						style:border-color={selectedColor === preset.value ? preset.border : '#d1d5db'}
						style:box-shadow={selectedColor === preset.value
							? `0 0 0 2px white, 0 0 0 4px ${preset.border}`
							: 'none'}
					>
						<span class="h-5 w-5 rounded-full" style:background={preset.border} aria-hidden="true"
						></span>
					</button>
				{/each}
			</div>
		</div>

		<div>
			<span class="mb-1.5 block text-xs font-semibold text-gray-600">Stamp icon</span>
			<div class="flex flex-wrap gap-2">
				{#each teacherMarkIconPresets as option}
					{@const IconComponent = iconComponents[option.value]}
					<button
						type="button"
						onclick={() => setStampIcon(option.value)}
						aria-label={option.label}
						aria-pressed={selectedIcon === option.value}
						title={option.label}
						class="flex h-10 w-10 items-center justify-center rounded-lg border transition-colors"
						class:border-green-600={selectedIcon === option.value}
						class:bg-green-50={selectedIcon === option.value}
						class:text-green-700={selectedIcon === option.value}
						class:border-gray-200={selectedIcon !== option.value}
						class:text-gray-500={selectedIcon !== option.value}
						class:hover:bg-gray-50={selectedIcon !== option.value}
					>
						<IconComponent size={18} />
					</button>
				{/each}
			</div>
		</div>

		<label class="block">
			<span class="mb-1 block text-xs font-semibold text-gray-600">Teacher name</span>
			<input
				type="text"
				bind:value={markedByDraft}
				onchange={commitMarkedBy}
				class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 focus:outline-none"
			/>
		</label>

		<label class="block">
			<span class="mb-1 block text-xs font-semibold text-gray-600">Date and time</span>
			<div class="flex gap-2">
				<input
					type="datetime-local"
					bind:value={markedAtDraft}
					onchange={commitMarkedAt}
					class="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 focus:outline-none"
				/>
				<button
					type="button"
					onclick={setNow}
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-green-200 text-green-700 hover:bg-green-50"
					title="Use current time"
				>
					<LucideClock size={16} />
				</button>
			</div>
		</label>

		<div>
			<div class="mb-1 flex items-center justify-between">
				<span class="block text-xs font-semibold text-gray-600">Font size</span>
				<span class="text-xs font-medium text-gray-500">{fontSizeDraft}px</span>
			</div>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => updateFontSize(fontSizeDraft - 1)}
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
					title="Smaller"
				>
					<LucideMinus size={14} />
				</button>
				<input
					type="range"
					min="4"
					max="24"
					step="1"
					bind:value={fontSizeDraft}
					oninput={(event) => updateFontSize(Number(event.currentTarget.value))}
					class="h-1.5 min-w-0 flex-1 appearance-none rounded-full bg-gray-200 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-600"
				/>
				<button
					type="button"
					onclick={() => updateFontSize(fontSizeDraft + 1)}
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
					title="Larger"
				>
					<LucidePlus size={14} />
				</button>
			</div>
		</div>
	</div>

	<div class="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
		<button
			type="button"
			onclick={onDelete}
			class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
		>
			<LucideTrash2 size={15} />
			Delete
		</button>
	</div>
</div>

<style>
	.teacher-mark-tool-panel {
		overscroll-behavior: contain;
		touch-action: pan-y;
		-webkit-overflow-scrolling: touch;
	}

	@supports (height: 100dvh) {
		.teacher-mark-tool-panel {
			max-height: calc(100dvh - 6rem);
		}
	}
</style>
