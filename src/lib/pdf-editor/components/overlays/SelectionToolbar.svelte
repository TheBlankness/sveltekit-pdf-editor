<script lang="ts">
	import { fly } from 'svelte/transition';
	import {
		LucideChevronDown,
		LucideCopy,
		LucideEye,
		LucideMousePointer2,
		LucideMousePointerClick,
		LucideMinusCircle,
		LucideTextCursorInput,
		LucideTrash2,
		LucideX
	} from 'lucide-svelte';
	import TextToolPanel from '../tool-panels/TextToolPanel.svelte';

	type SelectedObject = {
		id: string;
		type: string;
		canDelete?: boolean;
	};

	interface Props {
		isSelectionMode: boolean;
		selectedObjectIds: string[];
		selectedObjects?: SelectedObject[];
		previewedObjectId?: string | null;
		onDelete: () => void;
		onClearSelection: () => void;
		onDuplicate: () => void;
		onSelectObject?: (id: string) => void;
		onPreviewObject?: (id: string) => void;
		onUnselectObject?: (id: string) => void;
		onDeleteObject?: (id: string) => void;
		selectedTextCount?: number;
		textSize?: number;
		textColor?: string;
		textLineHeight?: number;
		textFontFamily?: string;
		onEditText?: () => void;
		onUpdateTextSize?: (size: number) => void;
		onUpdateTextColor?: (color: string) => void;
		onUpdateTextLineHeight?: (lineHeight: number) => void;
		onUpdateTextFontFamily?: (family: string) => void;
	}

	let {
		isSelectionMode,
		selectedObjectIds,
		selectedObjects = [],
		previewedObjectId = null,
		onDelete,
		onClearSelection,
		onDuplicate,
		onSelectObject,
		onPreviewObject,
		onUnselectObject,
		onDeleteObject,
		selectedTextCount = 0,
		textSize = 16,
		textColor = '#000000',
		textLineHeight = 1,
		textFontFamily = 'Roboto',
		onEditText,
		onUpdateTextSize = () => {},
		onUpdateTextColor = () => {},
		onUpdateTextLineHeight = () => {},
		onUpdateTextFontFamily = () => {}
	}: Props = $props();

	let isExpanded = $state(false);
	let selectedLabel = $derived(
		selectedTextCount > 0 && selectedTextCount === selectedObjectIds.length
			? `${selectedTextCount} Text Selected`
			: `${selectedObjectIds.length} Selected`
	);
	let selectionHint = $derived(
		selectedTextCount > 1
			? 'Style text, or drag to move'
			: selectedTextCount === 1
				? 'Style, edit, or drag to move'
				: 'Drag to move, or use actions'
	);

	const objectTypeLabel = (type: string) =>
		type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();

	function handleSelectObject(id: string) {
		onSelectObject?.(id);
		isExpanded = false;
	}

	function handlePreviewObject(id: string) {
		onPreviewObject?.(id);
	}

	function handleUnselectObject(id: string) {
		onUnselectObject?.(id);
	}

	function handleDeleteObject(event: MouseEvent, id: string) {
		event.stopPropagation();
		onDeleteObject?.(id);
	}

	function handleEditText(event: MouseEvent) {
		event.stopPropagation();
		onEditText?.();
		isExpanded = false;
	}

	$effect(() => {
		if (!isSelectionMode || selectedObjectIds.length === 0) {
			isExpanded = false;
		}
	});
</script>

{#if isSelectionMode && selectedObjectIds.length > 0}
	<div
		transition:fly={{ x: 10, y: 0, duration: 200 }}
		class="pdf-editor-touch-controls fixed top-20 right-3 z-[110] w-[min(24rem,calc(100vw-1.5rem))]"
		style="touch-action: manipulation; -webkit-user-select: none; user-select: none; pointer-events: none;"
	>
		<div
			class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
			style="pointer-events: auto;"
		>
			<div class="flex items-center gap-2 px-3 py-2">
				<div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
					<LucideMousePointerClick size={12} />
				</div>
				<button
					type="button"
					onclick={() => (isExpanded = !isExpanded)}
					aria-expanded={isExpanded}
					class="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-gray-50 active:bg-gray-100"
					title="Show selected objects"
				>
					<div class="flex min-w-0 flex-1 flex-col">
						<span class="text-xs font-semibold text-gray-800">{selectedLabel}</span>
						<span class="truncate text-xs text-gray-500">{selectionHint}</span>
					</div>
					<LucideChevronDown
						size={14}
						class={`shrink-0 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
					/>
				</button>
				{#if selectedTextCount === 1 && onEditText}
					<button
						type="button"
						onclick={handleEditText}
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 active:bg-blue-100"
						title="Edit selected text"
					>
						<LucideTextCursorInput size={14} />
					</button>
				{/if}
				<button
					type="button"
					onclick={onDuplicate}
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200"
					title="Duplicate selected objects"
				>
					<LucideCopy size={14} />
				</button>
				<button
					type="button"
					onclick={onDelete}
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 active:bg-red-100"
					title="Delete selected objects"
				>
					<LucideTrash2 size={14} />
				</button>
				<button
					type="button"
					onclick={onClearSelection}
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200"
					title="Clear selection"
				>
					<LucideX size={14} />
				</button>
			</div>

			{#if isExpanded}
				<div class="max-h-72 overflow-y-auto border-t border-gray-100 bg-gray-50/80 p-2">
					{#each selectedObjects as object (object.id)}
						<div
							class={`mb-1 flex w-full items-center gap-2 rounded-lg bg-white px-2 py-2 shadow-sm ring-1 last:mb-0 ${
								previewedObjectId === object.id ? 'ring-amber-300' : 'ring-gray-100'
							}`}
						>
							<div class="flex min-w-0 flex-1 items-center gap-2 px-1 py-0.5">
								<span class="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
									{objectTypeLabel(object.type)}
								</span>
								<span class="min-w-0 flex-1 break-all text-xs font-medium text-gray-800">{object.id}</span>
							</div>
							<div class="flex shrink-0 items-center gap-1">
								<button
									type="button"
									onclick={() => handleSelectObject(object.id)}
									class="flex h-7 w-7 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 active:bg-blue-100"
									title={`Select only ${object.id}`}
								>
									<LucideMousePointer2 size={13} />
								</button>
								<button
									type="button"
									onclick={() => handlePreviewObject(object.id)}
									class={`flex h-7 w-7 items-center justify-center rounded-lg hover:bg-amber-50 active:bg-amber-100 ${
										previewedObjectId === object.id ? 'bg-amber-100 text-amber-700' : 'text-amber-600'
									}`}
									title={`Preview ${object.id}`}
								>
									<LucideEye size={13} />
								</button>
								<button
									type="button"
									onclick={() => handleUnselectObject(object.id)}
									class="flex h-7 w-7 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200"
									title={`Unselect ${object.id}`}
								>
									<LucideMinusCircle size={13} />
								</button>
								<button
									type="button"
									onclick={(event) => handleDeleteObject(event, object.id)}
									disabled={object.canDelete === false}
									class="flex h-7 w-7 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 active:bg-red-100 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
									title={`Delete ${object.id}`}
								>
									<LucideTrash2 size={13} />
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if selectedTextCount > 0}
				<div class="border-t border-gray-100">
					<TextToolPanel
						variant="embedded"
						title="Text Styles"
						selectedCount={selectedTextCount}
						_size={textSize}
						_textColor={textColor}
						_lineHeight={textLineHeight}
						_fontFamily={textFontFamily}
						showClose={false}
						showDelete={false}
						onEditText={selectedTextCount === 1 ? onEditText : undefined}
						onUpdateSize={onUpdateTextSize}
						onUpdateColor={onUpdateTextColor}
						onUpdateLineHeight={onUpdateTextLineHeight}
						onUpdateFontFamily={onUpdateTextFontFamily}
						onDelete={onDelete}
					/>
				</div>
			{/if}
		</div>
	</div>
{/if}
