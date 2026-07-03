<script lang="ts">
	import { fly } from 'svelte/transition';
	import {
		LucideX,
		LucideBrush,
		LucideMinus,
		LucidePlus,
		LucidePalette,
		LucideChevronDown,
		LucideChevronUp
	} from 'lucide-svelte';
	import { presetColors } from '../../utils/colorPresets';

	interface Props {
		brushSize: number;
		brushColor: string;
		isMinimized?: boolean;
		onClose: () => void;
		onBrushSizeChange: (size: number) => void;
		onColorChange: (color: string) => void;
	}

	let {
		brushSize,
		brushColor,
		isMinimized = $bindable(false),
		onClose,
		onBrushSizeChange,
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
					class="flex items-center justify-center rounded-lg bg-blue-100 text-blue-600"
					class:h-8={!isMinimized}
					class:w-8={!isMinimized}
					class:h-7={isMinimized}
					class:w-7={isMinimized}
				>
					<LucideBrush size={isMinimized ? 14 : 16} />
				</div>
				{#if isMinimized}
					<div class="flex min-w-0 items-center gap-1.5">
						<span
							class="h-4 w-4 shrink-0 rounded-full border border-gray-200"
							style="background-color: {brushColor}"
							title="Pen color"
						></span>
						<span class="truncate text-xs font-semibold text-gray-700" title="Pen size">
							{Math.round(brushSize * 10) / 10}
						</span>
					</div>
				{:else}
					<span class="text-sm font-semibold text-gray-800">Draw</span>
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
			<!-- Brush Size Section -->
			<div class="mb-4">
				<div class="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
					Brush Size
				</div>
				<div class="flex items-center gap-2">
					<button
						class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95"
						onclick={() => {
							onBrushSizeChange(brushSize > 1 ? brushSize - 1 : 1);
						}}
						title="Decrease"
					>
						<LucideMinus size={16} />
					</button>
					<div class="flex flex-1 items-center gap-2">
						<input
							type="range"
							min="0.1"
							max="13"
							step="0.1"
							value={brushSize}
							oninput={(e) => onBrushSizeChange(parseFloat(e.currentTarget.value))}
							class="h-1.5 w-full appearance-none rounded-full bg-gray-200 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:hover:bg-blue-600"
						/>
						<div class="w-10 text-center text-sm font-medium text-gray-700">
							{Math.round(brushSize * 10) / 10}
						</div>
					</div>
					<button
						class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95"
						onclick={() => {
							onBrushSizeChange(brushSize < 13 ? brushSize + 1 : 13);
						}}
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
							class:border-blue-500={brushColor === color.hex}
							class:border-gray-200={brushColor !== color.hex}
							class:shadow-md={brushColor === color.hex}
							title={color.name}
						>
						</button>
					{/each}

					<!-- Native Color Picker -->
					<div class="relative h-10 w-10 transition-all hover:scale-105 active:scale-95">
						<div
							class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg border-2"
							class:border-blue-500={!presetColors.some((c) => c.hex === brushColor)}
							class:border-gray-200={presetColors.some((c) => c.hex === brushColor)}
							class:shadow-md={!presetColors.some((c) => c.hex === brushColor)}
							style="background-color: {!presetColors.some((c) => c.hex === brushColor)
								? brushColor
								: '#ffffff'}"
						>
							<LucidePalette
								size={20}
								class={!presetColors.some((c) => c.hex === brushColor)
									? 'text-white mix-blend-difference'
									: 'text-gray-600'}
							/>
						</div>
						<input
							type="color"
							value={brushColor}
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
