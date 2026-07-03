<script lang="ts">
	import {
		LucideType,
		LucidePencilLine,
		LucideEraser,
		LucideMinus,
		LucideHighlighter,
		LucidePen,
		LucideMousePointerClick,
		LucideZoomIn,
		LucideUndo2,
		LucideRedo2,
		LucideHand
	} from 'lucide-svelte';
	import Tooltip from './Tooltip.svelte';
	import { onMount } from 'svelte';

	interface Props {
		// Tool mode states
		isAddingText: boolean;
		AddTextButtonField: string;
		addingDrawing: boolean;
		isErasing: boolean;
		isAddingLine: boolean;
		isHighlighting: boolean;
		isPointerMode: boolean;
		isSelectionMode: boolean;
		isHandMode: boolean;
		showingZoom: boolean;
		zoom: number;
		isCursorMode: boolean;

		// Page state
		selectedPageIndex: number;
		isPageDisabled: boolean;
		isAddingDisabled: boolean;

		// Handlers
		onAddTextField: () => void;
		onAddDrawing: () => void;
		onErasing: () => void;
		activateLineMode: () => void;
		onHighlighting: () => void;
		onPointerMode: () => void;
		onSelectionMode: () => void;
		onHandMode: () => void;
		toggleZoomPanel: () => void;
		handleUndo: () => void;
		handleRedo: () => void;
	}

	let {
		isAddingText,
		AddTextButtonField,
		addingDrawing,
		isErasing,
		isAddingLine,
		isHighlighting,
		isPointerMode,
		isSelectionMode,
		isHandMode,
		showingZoom,
		zoom,
		isCursorMode,
		selectedPageIndex,
		isPageDisabled,
		isAddingDisabled,
		onAddTextField,
		onAddDrawing,
		onErasing,
		activateLineMode,
		onHighlighting,
		onPointerMode,
		onSelectionMode,
		onHandMode,
		toggleZoomPanel,
		handleUndo,
		handleRedo
	}: Props = $props();

	let isMobile = $state(false);

	onMount(() => {
		// Detect if device is mobile/tablet based on screen width and touch capability
		const checkMobile = () => {
			isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
		};

		checkMobile();
		window.addEventListener('resize', checkMobile);

		return () => {
			window.removeEventListener('resize', checkMobile);
		};
	});
</script>

<div class="no-scrollbar -mx-1 mt-2 flex items-center gap-2 overflow-x-auto py-1">
	<!-- Undo/Redo group -->
	<div class="group flex shrink-0 rounded-lg border border-gray-200 shadow-sm">
		<button
			disabled={isPageDisabled}
			onclick={handleUndo}
			class="flex h-10 w-10 items-center justify-center rounded-l-lg border-r border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-amber-600 active:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400"
		>
			<LucideUndo2 size={18} />
		</button>
		{#if !isMobile}
			<Tooltip
				type="custom"
				defaultClass=""
				class="z-50 rounded-lg border-2 border-blue-400 bg-white px-3 py-2 text-black shadow-lg"
			>
			<div class="flex items-center gap-2">
				<LucideUndo2 class="h-4 w-4 text-blue-500" />
				<div>
					<p class="text-sm font-medium text-gray-800">
						Undo <kbd
							class="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-600"
							>Ctrl+Z</kbd
						>
					</p>
					<p class="text-xs text-gray-500">Remove last annotation</p>
				</div>
			</div>
		</Tooltip>
	{/if}
		<button
			disabled={isPageDisabled}
			onclick={handleRedo}
			class="flex h-10 w-10 items-center justify-center rounded-r-lg text-gray-600 hover:bg-gray-50 hover:text-amber-600 active:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400"
		>
			<LucideRedo2 size={18} />
		</button>
		{#if !isMobile}
			<Tooltip
				type="custom"
				defaultClass=""
				class="z-50 rounded-lg border-2 border-blue-400 bg-white px-3 py-2 text-black shadow-lg"
			>
			<div class="flex items-center gap-2">
				<LucideRedo2 class="h-4 w-4 text-blue-500" />
				<div>
					<p class="text-sm font-medium text-gray-800">
						Redo <kbd
							class="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-600"
							>Ctrl+Y</kbd
						>
					</p>
					<p class="text-xs text-gray-500">Restore last removed</p>
				</div>
			</div>
		</Tooltip>
	{/if}
	</div>

	<!-- Add Text button -->
	<button
		onclick={onAddTextField}
		disabled={isAddingDisabled || isPageDisabled}
		class="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 text-sm text-gray-600 shadow-sm hover:bg-gray-50 hover:text-amber-600 active:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400"
	>
		<LucideType size={18} />
		<span class="hidden sm:inline">{AddTextButtonField}</span>
		<span class="inline sm:hidden">Text</span>
	</button>
	{#if !isMobile}
		<Tooltip
			type="custom"
			defaultClass=""
			class="z-50 rounded-lg border-2 border-purple-400 bg-white px-3 py-2 text-black shadow-lg"
		>
		<div class="flex items-center gap-2">
			<LucideType class="h-4 w-4 text-purple-500" />
			<div>
				<p class="text-sm font-medium text-gray-800">
					Add Text <kbd
						class="ml-1 rounded bg-purple-100 px-1.5 py-0.5 text-xs font-semibold text-purple-600"
						>T</kbd
					>
				</p>
				<p class="text-xs text-gray-500">Click anywhere to add text</p>
			</div>
		</div>
	</Tooltip>

	<!-- Drawing tools group -->
	<div class="group flex shrink-0 rounded-lg border border-gray-200 shadow-sm">
		<button
			onclick={onAddDrawing}
			disabled={selectedPageIndex < 0 || isPageDisabled}
			class="flex h-10 items-center justify-center gap-2 rounded-l-lg border-r border-gray-200 px-3 text-sm hover:bg-gray-50 active:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 sm:px-4"
			class:text-amber-600={addingDrawing && !isCursorMode}
			class:bg-amber-50={addingDrawing && !isCursorMode}
			class:text-gray-600={!addingDrawing || isCursorMode}
		>
			<LucidePencilLine size={18} />
			<span class="hidden sm:inline">Draw</span>
		</button>
		{#if !isMobile}
			<Tooltip
				type="custom"
				defaultClass=""
				class="z-50 rounded-lg border-2 border-amber-400 bg-white px-3 py-2 text-black shadow-lg"
			>
			<div class="flex items-center gap-2">
				<LucidePencilLine class="h-4 w-4 text-amber-500" />
				<div>
					<p class="text-sm font-medium text-gray-800">
						Draw <kbd
							class="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-600"
							>D</kbd
						>
					</p>
					<p class="text-xs text-gray-500">Draw freehand annotations</p>
				</div>
			</div>
		</Tooltip>
	{/if}

		<button
			disabled={isPageDisabled}
			onclick={onErasing}
			class="flex h-10 items-center justify-center gap-2 border-r border-gray-200 px-3 text-sm hover:bg-gray-50 active:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 sm:px-4"
			class:text-amber-600={isErasing}
			class:bg-amber-50={isErasing}
			class:text-gray-600={!isErasing}
		>
			<LucideEraser size={18} />
			<span class="hidden sm:inline">Erase</span>
		</button>
		{#if !isMobile}
			<Tooltip
				type="custom"
				defaultClass=""
				class="z-50 rounded-lg border-2 border-red-400 bg-white px-3 py-2 text-black shadow-lg"
			>
			<div class="flex items-center gap-2">
				<LucideEraser class="h-4 w-4 text-red-500" />
				<div>
					<p class="text-sm font-medium text-gray-800">
						Erase <kbd
							class="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-600"
							>E</kbd
						>
					</p>
					<p class="text-xs text-gray-500">Remove annotations by drawing</p>
				</div>
			</div>
		</Tooltip>
	{/if}

		<button
			onclick={onSelectionMode}
			disabled={selectedPageIndex < 0 || isPageDisabled}
			class="flex h-10 items-center justify-center gap-2 border-r border-gray-200 px-3 text-sm hover:bg-gray-50 active:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 sm:px-4"
			class:text-amber-600={isSelectionMode}
			class:bg-amber-50={isSelectionMode}
			class:text-gray-600={!isSelectionMode}
		>
			<LucideMousePointerClick size={18} />
			<span class="hidden sm:inline">Select</span>
		</button>
		{#if !isMobile}
			<Tooltip
				type="custom"
				defaultClass=""
				class="z-50 rounded-lg border-2 border-blue-400 bg-white px-3 py-2 text-black shadow-lg"
			>
			<div class="flex items-center gap-2">
				<LucideMousePointerClick class="h-4 w-4 text-blue-500" />
				<div>
					<p class="text-sm font-medium text-gray-800">
						Select & Move <kbd
							class="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-600"
							>V</kbd
						>
					</p>
					<p class="text-xs text-gray-500">Select and move annotations</p>
				</div>
			</div>
		</Tooltip>
	{/if}

		<button
			onclick={onHandMode}
			disabled={selectedPageIndex < 0 || isPageDisabled}
			class="flex h-10 items-center justify-center gap-2 border-r border-gray-200 px-3 text-sm hover:bg-gray-50 active:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 sm:px-4"
			class:text-amber-600={isHandMode}
			class:bg-amber-50={isHandMode}
			class:text-gray-600={!isHandMode}
		>
			<LucideHand size={18} />
			<span class="hidden sm:inline">Hand</span>
		</button>
		{#if !isMobile}
			<Tooltip
				type="custom"
				defaultClass=""
				class="z-50 rounded-lg border-2 border-green-400 bg-white px-3 py-2 text-black shadow-lg"
			>
			<div class="flex items-center gap-2">
				<LucideHand class="h-4 w-4 text-green-500" />
				<div>
					<p class="text-sm font-medium text-gray-800">
						Hand Tool <kbd
							class="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-600"
							>H</kbd
						>
						or
						<kbd class="rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-600"
							>Space</kbd
						>
					</p>
					<p class="text-xs text-gray-500">Pan and navigate (Space holds temporarily)</p>
				</div>
			</div>
		</Tooltip>
	{/if}

		<button
			onclick={onHighlighting}
			disabled={selectedPageIndex < 0 || isPageDisabled}
			class="flex h-10 items-center justify-center gap-2 border-r border-gray-200 px-3 text-sm hover:bg-gray-50 active:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 sm:px-4"
			class:text-amber-600={isHighlighting}
			class:bg-amber-50={isHighlighting}
			class:text-gray-600={!isHighlighting}
		>
			<LucideHighlighter size={18} />
			<span class="hidden sm:inline">Highlight</span>
		</button>
		{#if !isMobile}
			<Tooltip
				type="custom"
				defaultClass=""
				class="z-50 rounded-lg border-2 border-yellow-400 bg-white px-3 py-2 text-black shadow-lg"
			>
			<div class="flex items-center gap-2">
				<LucideHighlighter class="h-4 w-4 text-yellow-500" />
				<div>
					<p class="text-sm font-medium text-gray-800">Highlight</p>
					<p class="text-xs text-gray-500">Highlight text with transparency</p>
				</div>
			</div>
		</Tooltip>
	{/if}

		<button
			onclick={activateLineMode}
			disabled={selectedPageIndex < 0 || isPageDisabled}
			class="flex h-10 items-center justify-center gap-2 border-r border-gray-200 px-3 text-sm hover:bg-gray-50 active:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 sm:px-4"
			class:text-amber-600={isAddingLine}
			class:bg-amber-50={isAddingLine}
			class:text-gray-600={!isAddingLine}
		>
			<LucideMinus size={18} />
			<span class="hidden sm:inline">Line</span>
		</button>
		{#if !isMobile}
			<Tooltip
				type="custom"
				defaultClass=""
				class="z-50 rounded-lg border-2 border-gray-400 bg-white px-3 py-2 text-black shadow-lg"
			>
			<div class="flex items-center gap-2">
				<LucideMinus class="h-4 w-4 text-gray-500" />
				<div>
					<p class="text-sm font-medium text-gray-800">Line</p>
					<p class="text-xs text-gray-500">Draw straight lines</p>
				</div>
			</div>
		</Tooltip>
	{/if}

		<button
			onclick={onPointerMode}
			disabled={selectedPageIndex < 0 || isPageDisabled}
			class="flex h-10 items-center justify-center gap-2 rounded-r-lg px-3 text-sm hover:bg-gray-50 active:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 sm:px-4"
			class:text-amber-600={isPointerMode}
			class:bg-amber-50={isPointerMode}
			class:text-gray-600={!isPointerMode}
		>
			<LucidePen size={18} />
			<span class="hidden sm:inline">Pointer</span>
		</button>
		{#if !isMobile}
			<Tooltip
				type="custom"
				defaultClass=""
				class="z-50 rounded-lg border-2 border-orange-400 bg-white px-3 py-2 text-black shadow-lg"
			>
			<div class="flex items-center gap-2">
				<LucidePen class="h-4 w-4 text-orange-500" />
				<div>
					<p class="text-sm font-medium text-gray-800">Pointer</p>
					<p class="text-xs text-gray-500">Draw temporary strokes</p>
				</div>
			</div>
		</Tooltip>
	{/if}
	</div>

	<!-- Zoom controls -->
	<button
		onclick={toggleZoomPanel}
		disabled={isPageDisabled}
		class="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 text-sm shadow-sm hover:bg-gray-50 active:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 sm:px-4"
		class:text-amber-600={showingZoom}
		class:bg-amber-50={showingZoom}
		class:text-gray-600={!showingZoom}
	>
		<LucideZoomIn size={18} />
		<span class="hidden sm:inline">Zoom</span>
		<span class="text-xs text-gray-500">({Math.round((zoom / 2) * 100)}%)</span>
	</button>
	{#if !isMobile}
		<Tooltip
			type="custom"
			defaultClass=""
			class="z-50 rounded-lg border-2 border-indigo-400 bg-white px-3 py-2 text-black shadow-lg"
		>
		<div class="flex items-center gap-2">
			<LucideZoomIn class="h-4 w-4 text-indigo-500" />
			<div>
				<p class="text-sm font-medium text-gray-800">Zoom Controls</p>
				<p class="text-xs text-gray-500">Adjust PDF zoom level ({Math.round((zoom / 2) * 100)}%)</p>
			</div>
		</div>
	</Tooltip>
</div>

<style>
	/* Custom scrollbar styling */
	.no-scrollbar {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}

	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
</style>

