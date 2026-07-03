<script lang="ts">
	import { fly } from 'svelte/transition';
	import {
		LucideX,
		LucideALargeSmall,
		LucideMinus,
		LucidePlus,
		LucidePalette,
		LucideAlignVerticalSpaceAround,
		LucideType,
		LucideTrash2,
		LucideTextCursorInput,
		LucideChevronDown,
		LucideChevronUp
	} from 'lucide-svelte';
	import { presetColors } from '../../utils/colorPresets';
	import { Fonts } from '../../utils/prepareFonts.js';

	interface Props {
		_size: number;
		_textColor: string;
		_lineHeight: number;
		_fontFamily: string;
		selectedCount?: number;
		variant?: 'fixed' | 'embedded';
		isMinimized?: boolean;
		title?: string;
		showClose?: boolean;
		showDelete?: boolean;
		showEdit?: boolean;
		deleteLabel?: string;
		editLabel?: string;
		onClose?: () => void;
		onEditText?: () => void;
		onUpdateSize: (size: number) => void;
		onUpdateColor: (color: string) => void;
		onUpdateLineHeight: (lineHeight: number) => void;
		onUpdateFontFamily: (family: string) => void;
		onDelete: () => void;
	}

	let {
		_size,
		_textColor,
		_lineHeight,
		_fontFamily,
		selectedCount = 1,
		variant = 'fixed',
		isMinimized = $bindable(false),
		title = 'Text',
		showClose = true,
		showDelete = true,
		showEdit = true,
		deleteLabel = 'Delete',
		editLabel = 'Edit Text',
		onClose,
		onEditText,
		onUpdateSize,
		onUpdateColor,
		onUpdateLineHeight,
		onUpdateFontFamily,
		onDelete
	}: Props = $props();

	const Families = Object.keys(Fonts);
	let displaySize = $derived(Math.max(1, Math.round(Number(_size) || 16)));
	let isFixed = $derived(variant === 'fixed');

	$effect(() => {
		if (selectedCount === 0) {
			onClose?.();
		}
	});
</script>

<div
	role="toolbar"
	tabindex="0"
	aria-label="Text editing toolbar"
	transition:fly={{ x: 10, y: 0, duration: 200 }}
	class={isFixed ? 'pdf-editor-touch-controls fixed top-20 right-3 z-[110]' : 'pdf-editor-touch-controls w-full'}
>
	<div
		class="bg-white transition-all duration-200"
		class:border={isFixed}
		class:border-gray-200={isFixed}
		class:shadow-2xl={isFixed}
		class:w-72={!isMinimized && isFixed}
		class:w-full={!isMinimized && !isFixed}
		class:rounded-xl={!isMinimized}
		class:p-4={!isMinimized && isFixed}
		class:p-3={!isMinimized && !isFixed}
		class:w-44={isMinimized}
		class:rounded-lg={isMinimized}
		class:p-2={isMinimized}
	>
		<!-- Header -->
		<div class="flex items-center justify-between" class:mb-3={!isMinimized}>
			<div class="flex min-w-0 items-center gap-2">
				<div
					class="flex items-center justify-center rounded-lg bg-purple-100 text-purple-600"
					class:h-8={!isMinimized}
					class:w-8={!isMinimized}
					class:h-7={isMinimized}
					class:w-7={isMinimized}
				>
					<LucideType size={isMinimized ? 14 : 16} />
				</div>
				{#if isMinimized}
					<div class="flex min-w-0 items-center gap-1.5">
						<span
							class="h-4 w-4 shrink-0 rounded-full border border-gray-200"
							style="background-color: {_textColor}"
							title="Text color"
						></span>
						<span class="truncate text-xs font-semibold text-gray-700" title="Font size">
							{displaySize}
						</span>
						{#if selectedCount > 1}
							<span class="text-xs text-gray-500" title="Selected text count">x{selectedCount}</span>
						{/if}
					</div>
				{:else}
					<div>
						<span class="text-sm font-semibold text-gray-800">{title}</span>
						{#if selectedCount > 1}
							<span class="ml-1 text-xs text-gray-500">({selectedCount} selected)</span>
						{/if}
					</div>
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
				{#if showClose}
					<button
						class="flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200"
						class:h-8={!isMinimized}
						class:w-8={!isMinimized}
						class:h-7={isMinimized}
						class:w-7={isMinimized}
						onclick={() => onClose?.()}
						title="Close"
					>
						<LucideX size={isMinimized ? 14 : 16} />
					</button>
				{/if}
			</div>
		</div>

		{#if !isMinimized}
			{#if showEdit && selectedCount === 1 && onEditText}
				<button
					type="button"
					onclick={onEditText}
					class="mb-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 text-sm font-medium text-blue-700 transition-all hover:bg-blue-100 active:scale-95"
					title="Focus selected text editor"
				>
					<LucideTextCursorInput size={16} />
					<span>{editLabel}</span>
				</button>
			{/if}

			<!-- Font Family Section -->
			<div class="mb-4">
				<div class="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
					Font Family
				</div>
				<select
					value={_fontFamily}
					onchange={(e) => onUpdateFontFamily(e.currentTarget.value)}
					class="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 focus:border-purple-300 focus:ring-2 focus:ring-purple-200 focus:outline-none"
				>
					{#each Families as family}
						<option value={family}>{family}</option>
					{/each}
				</select>
			</div>

			<!-- Font Size Section -->
			<div class="mb-4">
				<div class="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
					Font Size
				</div>
				<div class="flex items-center gap-2">
					<button
						class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95"
						onclick={() => onUpdateSize(Math.max(12, displaySize - 2))}
						title="Decrease"
					>
						<LucideMinus size={16} />
					</button>
					<div class="flex flex-1 items-center gap-2">
						<input
							type="range"
							min="12"
							max="120"
							step="2"
							value={displaySize}
							oninput={(e) => onUpdateSize(Math.round(parseFloat(e.currentTarget.value)))}
							class="h-1.5 w-full appearance-none rounded-full bg-gray-200 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:hover:bg-purple-600"
						/>
						<div class="w-10 text-center text-sm font-medium text-gray-700">
							{displaySize}
						</div>
					</div>
					<button
						class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95"
						onclick={() => onUpdateSize(Math.min(120, displaySize + 2))}
						title="Increase"
					>
						<LucidePlus size={16} />
					</button>
				</div>
			</div>

			<!-- Line Height Section -->
			<div class="mb-4">
				<div class="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
					Line Height
				</div>
				<div class="flex items-center gap-2">
					<button
						class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95"
						onclick={() => onUpdateLineHeight(Math.max(1, _lineHeight - 0.1))}
						title="Decrease"
					>
						<LucideMinus size={16} />
					</button>
					<div class="flex flex-1 items-center gap-2">
						<input
							type="range"
							min="1"
							max="10"
							step="0.1"
							value={_lineHeight}
							oninput={(e) => onUpdateLineHeight(parseFloat(e.currentTarget.value))}
							class="h-1.5 w-full appearance-none rounded-full bg-gray-200 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:hover:bg-purple-600"
						/>
						<div class="w-10 text-center text-sm font-medium text-gray-700">
							{_lineHeight.toFixed(1)}
						</div>
					</div>
					<button
						class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95"
						onclick={() => onUpdateLineHeight(Math.min(10, _lineHeight + 0.1))}
						title="Increase"
					>
						<LucidePlus size={16} />
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
							onclick={() => onUpdateColor(color.hex)}
							class:border-purple-500={_textColor === color.hex}
							class:border-gray-200={_textColor !== color.hex}
							class:shadow-md={_textColor === color.hex}
							title={color.label}
						>
						</button>
					{/each}

					<!-- Native Color Picker -->
					<div class="relative h-10 w-10 transition-all hover:scale-105 active:scale-95">
						<div
							class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg border-2"
							class:border-purple-500={!presetColors.some((c) => c.hex === _textColor)}
							class:border-gray-200={presetColors.some((c) => c.hex === _textColor)}
							class:shadow-md={!presetColors.some((c) => c.hex === _textColor)}
							style="background-color: {!presetColors.some((c) => c.hex === _textColor)
								? _textColor
								: '#ffffff'}"
						>
							<LucidePalette
								size={20}
								class={!presetColors.some((c) => c.hex === _textColor)
									? 'text-white mix-blend-difference'
									: 'text-gray-600'}
							/>
						</div>
						<input
							type="color"
							value={_textColor}
							oninput={(e) => onUpdateColor(e.currentTarget.value)}
							class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
							title="Custom Color"
						/>
					</div>
				</div>
			</div>

			{#if showDelete}
				<!-- Delete Button -->
				<button
					onclick={onDelete}
					class="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-sm font-medium text-red-600 transition-all hover:bg-red-100 active:scale-95"
					title="Delete text"
				>
					<LucideTrash2 size={16} />
					<span>{deleteLabel}</span>
				</button>
			{/if}
		{/if}
	</div>
</div>
