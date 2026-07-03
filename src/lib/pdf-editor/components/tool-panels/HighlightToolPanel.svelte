<script lang="ts">
	import { fly } from 'svelte/transition';
	import {
		LucideX,
		LucideHighlighter,
		LucideMinus,
		LucidePlus,
		LucidePalette,
		LucideChevronDown,
		LucideChevronUp
	} from 'lucide-svelte';
	import { presetColors } from '../../utils/colorPresets';

	interface Props {
		highlightSize: number;
		highlightColor: string;
		isMinimized?: boolean;
		onClose: () => void;
		onSizeChange: (size: number) => void;
		onColorChange: (color: string) => void;
	}

	let {
		highlightSize,
		highlightColor,
		isMinimized = $bindable(false),
		onClose,
		onSizeChange,
		onColorChange
	}: Props = $props();
</script>

<!-- Fixed Top-Right Panel -->
<div transition:fly={{ x: 10, y: 0, duration: 200 }} class="pdf-editor-touch-controls fixed top-20 right-3 z-[110]">
	<div
		class="border border-gray-200 bg-white shadow-2xl transition-all duration-200"
		class:w-64={!isMinimized}
		class:rounded-xl={!isMinimized}
		class:p-4={!isMinimized}
		class:w-40={isMinimized}
		class:rounded-lg={isMinimized}
		class:p-2={isMinimized}
	>
		<!-- Header -->
		<div class="flex items-center justify-between" class:mb-3={!isMinimized}>
			<div class="flex min-w-0 items-center gap-2">
				<div
					class="flex items-center justify-center rounded-lg bg-yellow-100 text-yellow-600"
					class:h-8={!isMinimized}
					class:w-8={!isMinimized}
					class:h-7={isMinimized}
					class:w-7={isMinimized}
				>
					<LucideHighlighter size={isMinimized ? 14 : 16} />
				</div>
				{#if isMinimized}
					<div class="flex min-w-0 items-center gap-1.5">
						<span
							class="h-4 w-4 shrink-0 rounded-full border border-gray-200"
							style="background-color: {highlightColor}"
							title="Highlight color"
						></span>
						<span class="truncate text-xs font-semibold text-gray-700" title="Highlight size">
							{highlightSize}
						</span>
					</div>
				{:else}
					<span class="text-sm font-semibold text-gray-800">Highlight</span>
				{/if}
			</div>
			<div class="flex items-center gap-1">
				<button
					class="flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200"
					class:h-8={!isMinimized}
					class:w-8={!isMinimized}
					class:h-7={isMinimized}
					class:w-7={isMinimized}
					onclick={() => (isMinimized = !isMinimized)}
					title={isMinimized ? 'Expand' : 'Minimize'}
				>
					{#if isMinimized}
						<LucideChevronDown size={14} />
					{:else}
						<LucideChevronUp size={16} />
					{/if}
				</button>
				<button
					class="flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200"
					class:h-8={!isMinimized}
					class:w-8={!isMinimized}
					class:h-7={isMinimized}
					class:w-7={isMinimized}
					onclick={onClose}
					title="Close"
				>
					<LucideX size={isMinimized ? 14 : 16} />
				</button>
			</div>
		</div>

		{#if !isMinimized}
			<!-- Size Section -->
			<div class="mb-4">
				<div class="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
					Highlighter Size
				</div>
				<div class="flex items-center gap-2">
					<button
						class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95"
						onclick={() => onSizeChange(highlightSize > 1 ? highlightSize - 1 : 1)}
						title="Decrease"
					>
						<LucideMinus size={16} />
					</button>
					<div class="flex flex-1 items-center gap-2">
						<input
							type="range"
							min="5"
							max="50"
							step="5"
							value={highlightSize}
							oninput={(e) => onSizeChange(parseFloat(e.currentTarget.value))}
							class="h-1.5 w-full appearance-none rounded-full bg-gray-200 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-yellow-500 [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:hover:bg-yellow-600"
						/>
						<div class="w-10 text-center text-sm font-medium text-gray-700">
							{highlightSize}
						</div>
					</div>
					<button
						class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95"
						onclick={() => onSizeChange(highlightSize < 50 ? highlightSize + 1 : 50)}
						title="Increase"
					>
						<LucidePlus size={16} />
					</button>
				</div>
			</div>

			<!-- Color Section -->
			<div>
				<div class="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">Color</div>
				<div class="grid grid-cols-5 gap-2">
					{#each presetColors as color}
						<button
							type="button"
							aria-label="Select color"
							class="h-10 w-10 rounded-lg border-2 transition-all hover:scale-105 active:scale-95"
							style="background-color: {color.hex}"
							onclick={() => onColorChange(color.hex)}
							class:border-yellow-500={highlightColor === color.hex}
							class:border-gray-200={highlightColor !== color.hex}
							class:shadow-md={highlightColor === color.hex}
							title={color.label}
						>
						</button>
					{/each}

					<!-- Native Color Picker -->
					<div class="relative h-10 w-10 transition-all hover:scale-105 active:scale-95">
						<div
							class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg border-2"
							class:border-yellow-500={!presetColors.some((c) => c.hex === highlightColor)}
							class:border-gray-200={presetColors.some((c) => c.hex === highlightColor)}
							class:shadow-md={!presetColors.some((c) => c.hex === highlightColor)}
							style="background-color: {!presetColors.some((c) => c.hex === highlightColor)
								? highlightColor
								: '#ffffff'}"
						>
							<LucidePalette
								size={20}
								class={!presetColors.some((c) => c.hex === highlightColor)
									? 'text-white mix-blend-difference'
									: 'text-gray-600'}
							/>
						</div>
						<input
							type="color"
							value={highlightColor}
							oninput={(e) => onColorChange(e.currentTarget.value)}
							class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
							title="Custom Color"
						/>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
