<script lang="ts">
	import type { SaveState } from '../../context/pdfEditorContext.svelte';
	import {
		LucideChevronRight,
		LucideChevronLeft,
		LucideFileText,
		LucideLoader2
	} from 'lucide-svelte';

	interface Props {
		internalPage: number;
		minPage: number;
		maxPage: number;
		itemsPerPage: number;
		isChangingPage: boolean;
		saveState: SaveState;
		isPagePreviewOpen: boolean;
		onNext: () => void;
		onPrev: () => void;
		onPageInput: (event: Event) => void;
		onBlur: () => void;
		onTogglePagePreview: () => void;
	}

	let {
		internalPage,
		minPage,
		maxPage,
		itemsPerPage,
		isChangingPage,
		saveState,
		isPagePreviewOpen,
		onNext,
		onPrev,
		onPageInput,
		onBlur,
		onTogglePagePreview
	}: Props = $props();

	let inputValue = $derived(internalPage.toString());

	// Disable navigation only when actively saving or there are unsaved changes
	// Allow navigation when status is 'saved', 'local_saved', or 'cloud_saved'
	let isNavigationDisabled = $derived(
		saveState.status === 'saving'
	);

	function handlePreviewToggle(event: MouseEvent) {
		event.stopPropagation();
		onTogglePagePreview();
	}
</script>

<!-- PAGE NAVIGATION -->
<div class="relative inline-flex items-center">
	<div
		class="flex shrink-0 items-center gap-2 rounded-lg border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 p-1 shadow-sm"
	>
		<button
			onclick={onPrev}
			disabled={internalPage === minPage || isNavigationDisabled}
			class="flex h-9 w-9 items-center justify-center rounded-md bg-white text-amber-600 shadow-sm hover:bg-amber-100 active:bg-amber-200 disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed"
			title="Previous Page"
		>
			<LucideChevronLeft size={20} />
		</button>

		<div class="flex items-center gap-1.5 rounded-md bg-white px-2 py-1.5 shadow-sm">
			<button
				type="button"
				class="flex h-6 w-6 items-center justify-center rounded text-amber-600 transition hover:bg-amber-50 active:bg-amber-100 disabled:cursor-not-allowed disabled:text-gray-300"
				title="Page previews"
				aria-label="Open page previews"
				aria-expanded={isPagePreviewOpen}
				data-page-preview-toggle
				disabled={isNavigationDisabled}
				onclick={handlePreviewToggle}
			>
				<LucideFileText size={16} />
			</button>
			<input
				type="number"
				class="w-10 [appearance:textfield] border-none bg-transparent text-center text-sm font-medium focus:outline-none disabled:cursor-not-allowed disabled:text-gray-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
				value={inputValue}
				oninput={onPageInput}
				onblur={onBlur}
				min={minPage}
				max={maxPage}
				disabled={isNavigationDisabled}
			/>
			<span class="text-sm font-medium text-gray-500">/ {maxPage}</span>
		</div>

		<button
			onclick={onNext}
			disabled={internalPage === Math.ceil(maxPage / itemsPerPage) || isNavigationDisabled}
			class="flex h-9 w-9 items-center justify-center rounded-md bg-white text-amber-600 shadow-sm hover:bg-amber-100 active:bg-amber-200 disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed"
			title="Next Page"
		>
			<LucideChevronRight size={20} />
		</button>
	</div>

	{#if isChangingPage}
		<div
			class="absolute left-full top-0 ml-2 flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600 whitespace-nowrap"
		>
			<LucideLoader2 class="animate-spin" size={16} />
			<span class="hidden sm:inline">Changing page...</span>
		</div>
	{/if}
</div>

