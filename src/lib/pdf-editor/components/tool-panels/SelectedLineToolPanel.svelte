<script lang="ts">
	import { fly } from 'svelte/transition';
	import {
		LucideX,
		LucideBrush,
		LucideMinus,
		LucidePlus,
		LucidePalette,
		LucideTrash2,
		LucideChevronDown,
		LucideChevronUp
	} from 'lucide-svelte';
	import { presetColors } from '../../utils/colorPresets';
	import type { PDFObject } from '../../context/pdfEditorContext';

	interface Props {
		selectedLine: PDFObject | null;
		isMinimized?: boolean;
		onClose: () => void;
		onStrokeWidthChange: (width: number) => void;
		onStrokeColorChange: (color: string) => void;
		onLineTypeChange: (type: 'solid' | 'dotted' | 'dashed') => void;
		onDelete: () => void;
	}

	let {
		selectedLine,
		isMinimized = $bindable(false),
		onClose,
		onStrokeWidthChange,
		onStrokeColorChange,
		onLineTypeChange,
		onDelete
	}: Props = $props();
</script>

{#if selectedLine}
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
						class="flex items-center justify-center rounded-lg bg-gray-100 text-gray-600"
						class:h-8={!isMinimized}
						class:w-8={!isMinimized}
						class:h-7={isMinimized}
						class:w-7={isMinimized}
					>
						<LucideMinus size={isMinimized ? 14 : 16} />
					</div>
					{#if isMinimized}
						<div class="flex min-w-0 items-center gap-1.5">
							<span
								class="h-4 w-4 shrink-0 rounded-full border border-gray-200"
								style="background-color: {selectedLine?.strokeColor || '#232529'}"
								title="Line color"
							></span>
							<span class="truncate text-xs font-semibold text-gray-700" title="Line width">
								{selectedLine?.strokeWidth || 2}
							</span>
						</div>
					{:else}
						<span class="text-sm font-semibold text-gray-800">Edit Line</span>
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
				<!-- Stroke Width Section -->
				<div class="mb-4">
					<div class="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
						Line Width
					</div>
					<div class="flex items-center gap-2">
						<button
							class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95"
							onclick={() => onStrokeWidthChange(Math.max(1, (selectedLine?.strokeWidth || 2) - 1))}
							title="Decrease"
						>
							<LucideMinus size={16} />
						</button>
						<div class="flex flex-1 items-center gap-2">
							<input
								type="range"
								min="1"
								max="20"
								step="1"
								value={selectedLine?.strokeWidth || 2}
								oninput={(e) => onStrokeWidthChange(parseFloat(e.currentTarget.value))}
								class="h-1.5 w-full appearance-none rounded-full bg-gray-200 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gray-600 [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:hover:bg-gray-700"
							/>
							<div class="w-10 text-center text-sm font-medium text-gray-700">
								{selectedLine?.strokeWidth || 2}
							</div>
						</div>
						<button
							class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95"
							onclick={() =>
								onStrokeWidthChange(Math.min(20, (selectedLine?.strokeWidth || 2) + 1))}
							title="Increase"
						>
							<LucidePlus size={16} />
						</button>
					</div>
				</div>

				<!-- Line Type Section -->
				<div class="mb-4">
					<div class="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
						Line Style
					</div>
					<div class="grid grid-cols-3 gap-2">
						<button
							type="button"
							class="flex h-12 flex-col items-center justify-center gap-1 rounded-lg border-2 transition-all hover:bg-gray-50 active:scale-95"
							class:border-gray-600={selectedLine?.lineType === 'solid' || !selectedLine?.lineType}
							class:border-gray-200={selectedLine?.lineType !== 'solid' && selectedLine?.lineType}
							class:bg-gray-50={selectedLine?.lineType === 'solid' || !selectedLine?.lineType}
							onclick={() => onLineTypeChange('solid')}
							title="Solid line"
						>
							<svg width="32" height="4" class="overflow-visible">
								<line x1="0" y1="2" x2="32" y2="2" stroke="currentColor" stroke-width="2" />
							</svg>
							<span class="text-xs text-gray-600">Solid</span>
						</button>
						<button
							type="button"
							class="flex h-12 flex-col items-center justify-center gap-1 rounded-lg border-2 transition-all hover:bg-gray-50 active:scale-95"
							class:border-gray-600={selectedLine?.lineType === 'dotted'}
							class:border-gray-200={selectedLine?.lineType !== 'dotted'}
							class:bg-gray-50={selectedLine?.lineType === 'dotted'}
							onclick={() => onLineTypeChange('dotted')}
							title="Dotted line"
						>
							<svg width="32" height="4" class="overflow-visible">
								<line
									x1="0"
									y1="2"
									x2="32"
									y2="2"
									stroke="currentColor"
									stroke-width="2"
									stroke-dasharray="4,4"
								/>
							</svg>
							<span class="text-xs text-gray-600">Dotted</span>
						</button>
						<button
							type="button"
							class="flex h-12 flex-col items-center justify-center gap-1 rounded-lg border-2 transition-all hover:bg-gray-50 active:scale-95"
							class:border-gray-600={selectedLine?.lineType === 'dashed'}
							class:border-gray-200={selectedLine?.lineType !== 'dashed'}
							class:bg-gray-50={selectedLine?.lineType === 'dashed'}
							onclick={() => onLineTypeChange('dashed')}
							title="Dashed line"
						>
							<svg width="32" height="4" class="overflow-visible">
								<line
									x1="0"
									y1="2"
									x2="32"
									y2="2"
									stroke="currentColor"
									stroke-width="2"
									stroke-dasharray="8,4"
								/>
							</svg>
							<span class="text-xs text-gray-600">Dashed</span>
						</button>
					</div>
				</div>

				<!-- Color Section -->
				<div class="mb-4">
					<div class="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">Color</div>
					<div class="grid grid-cols-5 gap-2">
						{#each presetColors as color}
							<button
								type="button"
								aria-label="Select color"
								class="h-10 w-10 rounded-lg border-2 transition-all hover:scale-105 active:scale-95"
								style="background-color: {color.hex}"
								onclick={() => onStrokeColorChange(color.hex)}
								class:border-gray-600={selectedLine?.strokeColor === color.hex}
								class:border-gray-200={selectedLine?.strokeColor !== color.hex}
								class:shadow-md={selectedLine?.strokeColor === color.hex}
								title={color.label}
							>
							</button>
						{/each}

						<!-- Native Color Picker -->
						<div class="relative h-10 w-10 transition-all hover:scale-105 active:scale-95">
							<div
								class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg border-2"
								class:border-gray-600={!presetColors.some(
									(c) => c.hex === selectedLine?.strokeColor
								)}
								class:border-gray-200={presetColors.some(
									(c) => c.hex === selectedLine?.strokeColor
								)}
								class:shadow-md={!presetColors.some((c) => c.hex === selectedLine?.strokeColor)}
								style="background-color: {!presetColors.some(
									(c) => c.hex === selectedLine?.strokeColor
								)
									? selectedLine?.strokeColor
									: '#ffffff'}"
							>
								<LucidePalette
									size={20}
									class={!presetColors.some((c) => c.hex === selectedLine?.strokeColor)
										? 'text-white mix-blend-difference'
										: 'text-gray-600'}
								/>
							</div>
							<input
								type="color"
								value={selectedLine?.strokeColor}
								oninput={(e) => onStrokeColorChange(e.currentTarget.value)}
								class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
								title="Custom Color"
							/>
						</div>
					</div>
				</div>

				<!-- Delete Button -->
				<button
					onclick={onDelete}
					class="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-sm font-medium text-red-600 transition-all hover:bg-red-100 active:scale-95"
					title="Delete line"
				>
					<LucideTrash2 size={16} />
					<span>Delete Line</span>
				</button>
			{/if}
		</div>
	</div>
{/if}
