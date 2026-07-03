<script lang="ts">
	import { fly } from 'svelte/transition';
	import {
		LucideType,
		LucidePencilLine,
		LucideEraser,
		LucideMinus,
		LucideHighlighter,
		LucidePen,
		LucideMousePointerClick,
		LucideHand,
		LucideMoreHorizontal,
		LucideX,
		LucideClipboardCheck
	} from 'lucide-svelte';
	import { getPDFEditorContext } from '../../context/pdfEditorContext.svelte';
	import Portal from '../../Portal.svelte';

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
		onTeacherMark = () => {}
	}: Props = $props();

	let isOpen = $state(false);
	let triggerButton: HTMLButtonElement;
	let menuElement: HTMLDivElement;
	let menuStyle = $state('');
	const ctx = getPDFEditorContext();
	let toolbarPosition = $derived(ctx.state.toolbarPosition);

	// Combined disabled state for all editing tools
	let isDisabled = $derived(disabled || isPageDisabled);
	let hasExplicitToolMap = $derived(Object.keys(enabledToolMap).length > 0);

	function isToolEnabled(tool: string) {
		return !hasExplicitToolMap || enabledToolMap[tool] === true;
	}

	function clamp(value: number, min: number, max: number) {
		return Math.min(Math.max(value, min), max);
	}

	function updateMenuPosition() {
		if (!triggerButton || typeof window === 'undefined') return;

		const rect = triggerButton.getBoundingClientRect();
		const gap = 12;
		const margin = 8;
		const menuWidth = 224;
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;

		if (toolbarPosition === 'bottom') {
			const left = clamp(
				rect.left + rect.width / 2 - menuWidth / 2,
				margin,
				viewportWidth - menuWidth - margin
			);
			const bottom = Math.max(viewportHeight - rect.top + gap, margin);
			const availableAboveToolbar = rect.top - margin - gap;

			if (availableAboveToolbar >= 180) {
				menuStyle = `left: ${left}px; bottom: ${bottom}px; max-height: ${availableAboveToolbar}px;`;
				return;
			}

			menuStyle = `left: ${left}px; top: ${margin}px; max-height: ${viewportHeight - margin * 2}px;`;
			return;
		}

		const left =
			toolbarPosition === 'left'
				? clamp(rect.right + gap, margin, viewportWidth - menuWidth - margin)
				: clamp(rect.left - menuWidth - gap, margin, viewportWidth - menuWidth - margin);

		menuStyle = `left: ${left}px; top: ${margin}px; max-height: ${viewportHeight - margin * 2}px;`;
	}

	function closeMenu() {
		isOpen = false;
	}

	function handleTriggerClick() {
		if (isOpen) {
			closeMenu();
			return;
		}

		updateMenuPosition();
		isOpen = true;
	}

	function handleToolClick(handler: () => void) {
		handler();
		closeMenu();
	}

	$effect(() => {
		if (!isOpen || typeof window === 'undefined') return;

		updateMenuPosition();

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (menuElement?.contains(target) || triggerButton?.contains(target)) return;

			closeMenu();
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closeMenu();
		};

		window.addEventListener('pointerdown', handlePointerDown, true);
		window.addEventListener('resize', updateMenuPosition);
		window.addEventListener('scroll', updateMenuPosition, true);
		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('pointerdown', handlePointerDown, true);
			window.removeEventListener('resize', updateMenuPosition);
			window.removeEventListener('scroll', updateMenuPosition, true);
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<!-- Overflow Menu Button -->
<div class="pdf-editor-touch-controls relative">
	<button
		bind:this={triggerButton}
		onclick={handleTriggerClick}
		class="flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-gray-100 active:scale-95"
		class:bg-blue-100={isOpen}
		class:text-blue-600={isOpen}
		class:text-gray-700={!isOpen}
		title="More Tools"
	>
		{#if isOpen}
			<LucideX size={18} />
		{:else}
			<LucideMoreHorizontal size={18} />
		{/if}
	</button>

	<!-- Popup Menu -->
	{#if isOpen}
		<Portal>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="fixed inset-0 z-[60]" onclick={closeMenu}></div>
			<div
				bind:this={menuElement}
				transition:fly={{ y: toolbarPosition === 'bottom' ? 10 : 0, duration: 200 }}
				class="pdf-editor-touch-controls fixed z-[120] w-56 overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white p-2 shadow-2xl"
				style={menuStyle}
			>
				<div class="mb-2 px-3 py-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
					Drawing Tools
				</div>

				<!-- Selection & Hand -->
				<button
					onclick={() => handleToolClick(onSelectionMode)}
					disabled={selectedPageIndex < 0 || isDisabled}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
					class:bg-blue-100={isSelectionMode}
					class:text-blue-600={isSelectionMode}
					class:text-gray-700={!isSelectionMode}
				>
					<LucideMousePointerClick size={18} />
					<span class="font-medium">Select & Move</span>
				</button>

				<button
					onclick={() => handleToolClick(onHandMode)}
					disabled={selectedPageIndex < 0 || isDisabled}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
					class:bg-blue-100={isHandMode}
					class:text-blue-600={isHandMode}
					class:text-gray-700={!isHandMode}
				>
					<LucideHand size={18} />
					<span class="font-medium">Hand Tool (Pan)</span>
				</button>

				<div class="my-2 h-px bg-gray-200"></div>

				<!-- Drawing Tools -->
				<button
					onclick={() => handleToolClick(onAddDrawing)}
					disabled={selectedPageIndex < 0 || isDisabled}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
					class:bg-blue-100={addingDrawing}
					class:text-blue-600={addingDrawing}
					class:text-gray-700={!addingDrawing}
				>
					<LucidePencilLine size={18} />
					<span class="font-medium">Draw</span>
				</button>

				<button
					onclick={() => handleToolClick(onErasing)}
					disabled={isDisabled}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
					class:bg-blue-100={isErasing}
					class:text-blue-600={isErasing}
					class:text-gray-700={!isErasing}
				>
					<LucideEraser size={18} />
					<span class="font-medium">Erase</span>
				</button>

				<button
					onclick={() => handleToolClick(onHighlighting)}
					class:hidden={!isToolEnabled('highlighter')}
					disabled={selectedPageIndex < 0 || isDisabled}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
					class:bg-blue-100={isHighlighting}
					class:text-blue-600={isHighlighting}
					class:text-gray-700={!isHighlighting}
				>
					<LucideHighlighter size={18} />
					<span class="font-medium">Highlight</span>
				</button>

				<div class="my-2 h-px bg-gray-200"></div>

				<!-- Text & Shapes -->
				<button
					onclick={() => handleToolClick(onAddTextField)}
					class:hidden={!isToolEnabled('text')}
					disabled={isAddingDisabled || isDisabled}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
					class:bg-blue-100={isAddingText}
					class:text-blue-600={isAddingText}
					class:text-gray-700={!isAddingText}
				>
					<LucideType size={18} />
					<span class="font-medium">Add Text</span>
				</button>

				<button
					onclick={() => handleToolClick(activateLineMode)}
					class:hidden={!isToolEnabled('line')}
					disabled={selectedPageIndex < 0 || isDisabled}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
					class:bg-blue-100={isAddingLine}
					class:text-blue-600={isAddingLine}
					class:text-gray-700={!isAddingLine}
				>
					<LucideMinus size={18} />
					<span class="font-medium">Line</span>
				</button>

				{#if allowTeacherMark}
					<button
						onclick={() => handleToolClick(onTeacherMark)}
						disabled={selectedPageIndex < 0 || isDisabled}
						class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-green-700 transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<LucideClipboardCheck size={18} />
						<span class="font-medium">Teacher Stamp</span>
					</button>
				{/if}

				<button
					onclick={() => handleToolClick(onPointerMode)}
					disabled={selectedPageIndex < 0 || isDisabled}
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
					class:bg-blue-100={isPointerMode}
					class:text-blue-600={isPointerMode}
					class:text-gray-700={!isPointerMode}
				>
					<LucidePen size={18} />
					<span class="font-medium">Pointer</span>
				</button>
			</div>
		</Portal>
	{/if}
</div>


