<script lang="ts">
	import {
		LucideType,
		LucidePencilLine,
		LucideEraser,
		LucideMinus,
		LucideHighlighter,
		LucidePen,
		LucideMousePointerClick,
		LucideUndo2,
		LucideRedo2,
		LucideHand,
		LucideClipboardCheck
	} from 'lucide-svelte';
	import Tooltip from './Tooltip.svelte';
	import ToolbarOverflow from './ToolbarOverflow.svelte';
	import { onMount } from 'svelte';
	import { getPDFEditorContext } from '../../context/pdfEditorContext.svelte';

	interface Props {
		// Tool mode states
		isAddingText: boolean;
		addingDrawing: boolean;
		isErasing: boolean;
		isAddingLine: boolean;
		isHighlighting: boolean;
		isPointerMode: boolean;
		isSelectionMode: boolean;
		isHandMode: boolean;
		allowTeacherMark?: boolean;
		enabledToolMap?: Partial<Record<string, boolean>>;

		// Page state
		selectedPageIndex: number;
		isPageDisabled: boolean;
		disabled?: boolean;
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
		onTeacherMark?: () => void;
		handleUndo: () => void;
		handleRedo: () => void;
	}

	let {
		isAddingText,
		addingDrawing,
		isErasing,
		isAddingLine,
		isHighlighting,
		isPointerMode,
		isSelectionMode,
		isHandMode,
		allowTeacherMark = false,
		enabledToolMap = {},
		selectedPageIndex,
		isPageDisabled,
		disabled = false,
		isAddingDisabled,
		onAddTextField,
		onAddDrawing,
		onErasing,
		activateLineMode,
		onHighlighting,
		onPointerMode,
		onSelectionMode,
		onHandMode,
		onTeacherMark = () => {},
		handleUndo,
		handleRedo
	}: Props = $props();

	const ctx = getPDFEditorContext();
	let isMobile = $state(false);

	// Combined disabled state for all editing tools
	let isDisabled = $derived(disabled || isPageDisabled);
	let hasExplicitToolMap = $derived(Object.keys(enabledToolMap).length > 0);

	function isToolEnabled(tool: string) {
		return !hasExplicitToolMap || enabledToolMap[tool] === true;
	}

	// Get toolbar position from context
	let toolbarPosition = $derived(ctx.state.toolbarPosition);
	let isBottomToolbar = $derived(toolbarPosition === 'bottom');

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
<!-- Toolbar - Position toggleable between bottom, left, and right -->
<div
	class="pdf-editor-touch-controls fixed z-[70] transform transition-all duration-300 {toolbarPosition === 'bottom'
		? 'bottom-6 left-1/2 max-w-[calc(100vw-1rem)] -translate-x-1/2'
		: toolbarPosition === 'left'
			? 'top-1/2 left-4 max-h-[calc(100dvh-12rem)] -translate-y-1/2'
			: 'top-1/2 right-4 max-h-[calc(100dvh-12rem)] -translate-y-1/2'}"
>
	<div
		class="scrollbar-thin flex gap-1 overscroll-contain rounded-xl border border-gray-200 bg-white px-2 py-2 shadow-2xl transition-all duration-300 {isBottomToolbar
			? 'max-w-[calc(100vw-1rem)] items-center overflow-x-auto overflow-y-hidden'
			: 'max-h-[calc(100dvh-12rem)] flex-col items-start overflow-y-auto overflow-x-hidden'}"
	>
		<!-- Desktop: Full toolbar -->
		<div
			class="hidden gap-1 md:flex {isBottomToolbar
				? 'items-center'
				: 'flex-col'}"
		>
			<!-- Undo/Redo -->
			<button
				disabled={isDisabled}
				onclick={handleUndo}
				class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
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
							<p class="text-sm font-medium text-gray-800">Undo <kbd class="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-600">Ctrl+Z</kbd></p>
							<p class="text-xs text-gray-500">Remove last annotation</p>
						</div>
					</div>
				</Tooltip>
			{/if}
			<button
				disabled={isDisabled}
				onclick={handleRedo}
				class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
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
							<p class="text-sm font-medium text-gray-800">Redo <kbd class="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-600">Ctrl+Y</kbd></p>
							<p class="text-xs text-gray-500">Restore last removed</p>
						</div>
					</div>
				</Tooltip>
			{/if}

			<!-- Separator -->
			<div
				class="bg-gray-300 {isBottomToolbar ? 'mx-1 h-6 w-px' : 'my-1 h-px w-6'}"
			></div>

			<!-- Selection & Hand -->
			<button
				onclick={onSelectionMode}
				disabled={selectedPageIndex < 0 || isDisabled}
				class="flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				class:bg-blue-100={isSelectionMode}
				class:text-blue-600={isSelectionMode}
				class:text-gray-700={!isSelectionMode}
			>
				<LucideMousePointerClick size={18} />

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
							<p class="text-sm font-medium text-gray-800">Select & Move <kbd class="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-600">V</kbd></p>
							<p class="text-xs text-gray-500">Select and move annotations</p>
						</div>
					</div>
				</Tooltip>
			{/if}

			<button
				onclick={onHandMode}
				disabled={selectedPageIndex < 0}
				class="flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				class:bg-blue-100={isHandMode}
				class:text-blue-600={isHandMode}
				class:text-gray-700={!isHandMode}
			>
				<LucideHand size={18} />

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
							<p class="text-sm font-medium text-gray-800">Hand Tool <kbd class="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-600">H</kbd> or <kbd class="rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-600">Space</kbd></p>
							<p class="text-xs text-gray-500">Pan and navigate (Space holds temporarily)</p>
						</div>
					</div>
				</Tooltip>
			{/if}

			<!-- Separator -->
			<div
				class="bg-gray-300 {isBottomToolbar ? 'mx-1 h-6 w-px' : 'my-1 h-px w-6'}"
			></div>

			<!-- Drawing Tools -->
			<button
				onclick={onAddDrawing}
				disabled={selectedPageIndex < 0 || isDisabled}
				class="flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				class:bg-blue-100={addingDrawing}
				class:text-blue-600={addingDrawing}
				class:text-gray-700={!addingDrawing}
			>
				<LucidePencilLine size={18} />

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
							<p class="text-sm font-medium text-gray-800">Draw <kbd class="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-600">D</kbd></p>
							<p class="text-xs text-gray-500">Draw freehand annotations</p>
						</div>
					</div>
				</Tooltip>
			{/if}

			<button
				disabled={isDisabled}
				onclick={onErasing}
				class="flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				class:bg-blue-100={isErasing}
				class:text-blue-600={isErasing}
				class:text-gray-700={!isErasing}
			>
				<LucideEraser size={18} />

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
							<p class="text-sm font-medium text-gray-800">Erase <kbd class="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-600">E</kbd></p>
							<p class="text-xs text-gray-500">Remove annotations by drawing</p>
						</div>
					</div>
				</Tooltip>
			{/if}

			<!-- Separator -->
			<div
				class="bg-gray-300 {isBottomToolbar ? 'mx-1 h-6 w-px' : 'my-1 h-px w-6'}"
			></div>

			<button
				onclick={onHighlighting}
				class:hidden={!isToolEnabled('highlighter')}
				disabled={selectedPageIndex < 0 || isDisabled}
				class="flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				class:bg-blue-100={isHighlighting}
				class:text-blue-600={isHighlighting}
				class:text-gray-700={!isHighlighting}
			>
				<LucideHighlighter size={18} />

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

			<!-- Text & Shapes -->
			<button
				onclick={onAddTextField}
				class:hidden={!isToolEnabled('text')}
				disabled={isAddingDisabled || isDisabled}
				class="flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				class:bg-blue-100={isAddingText}
				class:text-blue-600={isAddingText}
				class:text-gray-700={!isAddingText}
			>
				<LucideType size={18} />

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
							<p class="text-sm font-medium text-gray-800">Add Text <kbd class="ml-1 rounded bg-purple-100 px-1.5 py-0.5 text-xs font-semibold text-purple-600">T</kbd></p>
							<p class="text-xs text-gray-500">Click anywhere to add text</p>
						</div>
					</div>
				</Tooltip>
			{/if}

			<button
				onclick={activateLineMode}
				class:hidden={!isToolEnabled('line')}
				disabled={selectedPageIndex < 0 || isDisabled}
				class="flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				class:bg-blue-100={isAddingLine}
				class:text-blue-600={isAddingLine}
				class:text-gray-700={!isAddingLine}
			>
				<LucideMinus size={18} />
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

			{#if allowTeacherMark}
				<button
					onclick={onTeacherMark}
					disabled={selectedPageIndex < 0 || isDisabled}
					class="flex h-9 w-9 items-center justify-center rounded-lg text-green-700 transition-all hover:bg-green-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<LucideClipboardCheck size={18} />
				</button>
				{#if !isMobile}
					<Tooltip
						type="custom"
						defaultClass=""
						class="z-50 rounded-lg border-2 border-green-400 bg-white px-3 py-2 text-black shadow-lg"
					>
						<div class="flex items-center gap-2">
							<LucideClipboardCheck class="h-4 w-4 text-green-600" />
							<div>
								<p class="text-sm font-medium text-gray-800">Teacher Stamp</p>
								<p class="text-xs text-gray-500">Mark this answer as checked</p>
							</div>
						</div>
					</Tooltip>
				{/if}
			{/if}

			<button
				onclick={onPointerMode}
				disabled={selectedPageIndex < 0 || isDisabled}
				class="flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				class:bg-blue-100={isPointerMode}
				class:text-blue-600={isPointerMode}
				class:text-gray-700={!isPointerMode}
			>
				<LucidePen size={18} />
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

		<!-- Mobile/Tablet: Compact toolbar with overflow -->
		<div
			class="flex gap-1 md:hidden {isBottomToolbar
				? 'items-center'
				: 'flex-col'}"
		>
			<!-- Undo/Redo -->
			<button
				disabled={isDisabled}
				onclick={handleUndo}
				class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
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
							<p class="text-sm font-medium text-gray-800">Undo <kbd class="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-600">Ctrl+Z</kbd></p>
							<p class="text-xs text-gray-500">Remove last annotation</p>
						</div>
					</div>
				</Tooltip>
			{/if}
			<button
				disabled={isDisabled}
				onclick={handleRedo}
				class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
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
							<p class="text-sm font-medium text-gray-800">Redo <kbd class="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-600">Ctrl+Y</kbd></p>
							<p class="text-xs text-gray-500">Restore last removed</p>
						</div>
					</div>
				</Tooltip>
			{/if}

			<div
				class="bg-gray-300 {isBottomToolbar ? 'mx-1 h-6 w-px' : 'my-1 h-px w-6'}"
			></div>

			<!-- Essential tools -->
			<button
				onclick={onSelectionMode}
				disabled={selectedPageIndex < 0 || isDisabled}
				class="flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				class:bg-blue-100={isSelectionMode}
				class:text-blue-600={isSelectionMode}
				class:text-gray-700={!isSelectionMode}
			>
				<LucideMousePointerClick size={18} />
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
							<p class="text-sm font-medium text-gray-800">Select & Move <kbd class="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-600">V</kbd></p>
							<p class="text-xs text-gray-500">Select and move annotations</p>
						</div>
					</div>
				</Tooltip>
			{/if}

			<button
				onclick={onAddDrawing}
				disabled={selectedPageIndex < 0 || isDisabled}
				class="flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				class:bg-blue-100={addingDrawing}
				class:text-blue-600={addingDrawing}
				class:text-gray-700={!addingDrawing}
			>
				<LucidePencilLine size={18} />
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
							<p class="text-sm font-medium text-gray-800">Draw <kbd class="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-600">D</kbd></p>
							<p class="text-xs text-gray-500">Draw freehand annotations</p>
						</div>
					</div>
				</Tooltip>
			{/if}

			<button
				onclick={onErasing}
				disabled={isDisabled}
				class="flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				class:bg-blue-100={isErasing}
				class:text-blue-600={isErasing}
				class:text-gray-700={!isErasing}
			>
				<LucideEraser size={18} />
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
							<p class="text-sm font-medium text-gray-800">Erase <kbd class="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-600">E</kbd></p>
							<p class="text-xs text-gray-500">Remove annotations by drawing</p>
						</div>
					</div>
				</Tooltip>
			{/if}

			<div
				class="bg-gray-300 {isBottomToolbar ? 'mx-1 h-6 w-px' : 'my-1 h-px w-6'}"
			></div>

			<!-- Overflow menu -->
			<ToolbarOverflow
				{enabledToolMap}
				{isAddingText}
				{addingDrawing}
				{isErasing}
				{isAddingLine}
				{isHighlighting}
				{isPointerMode}
				{isSelectionMode}
				{isHandMode}
				{allowTeacherMark}
				{selectedPageIndex}
				{isPageDisabled}
				{disabled}
				{isAddingDisabled}
				{onAddTextField}
				{onAddDrawing}
				{onErasing}
				{activateLineMode}
				{onHighlighting}
				{onPointerMode}
				{onSelectionMode}
				{onHandMode}
				{onTeacherMark}
			/>
		</div>
	</div>
</div>


