<script lang="ts">
	import { fly } from 'svelte/transition';
	import {
		LucideX,
		LucideEraser,
		LucideMinus,
		LucidePlus,
		LucideChevronDown,
		LucideChevronUp
	} from 'lucide-svelte';

	interface Props {
		erasingBrushSize: number;
		isMinimized?: boolean;
		onClose: () => void;
		onSizeChange: (size: number) => void;
		user: any;
	}

	let {
		erasingBrushSize,
		isMinimized = $bindable(false),
		onClose,
		onSizeChange,
		user
	}: Props = $props();
</script>

<!-- Fixed Top-Right Panel -->
<div transition:fly={{ x: 10, y: 0, duration: 200 }} class="pdf-editor-touch-controls fixed top-20 right-3 z-[110]">
	<div
		class="border border-gray-200 bg-white shadow-2xl transition-all duration-200"
		class:w-64={!isMinimized}
		class:rounded-xl={!isMinimized}
		class:p-4={!isMinimized}
		class:w-36={isMinimized}
		class:rounded-lg={isMinimized}
		class:p-2={isMinimized}
	>
		<!-- Header -->
		<div class="flex items-center justify-between" class:mb-3={!isMinimized}>
			<div class="flex min-w-0 items-center gap-2">
				<div
					class="flex items-center justify-center rounded-lg bg-red-100 text-red-600"
					class:h-8={!isMinimized}
					class:w-8={!isMinimized}
					class:h-7={isMinimized}
					class:w-7={isMinimized}
				>
					<LucideEraser size={isMinimized ? 14 : 16} />
				</div>
				{#if isMinimized}
					<span class="truncate text-xs font-semibold text-gray-700" title="Eraser size">
						{erasingBrushSize}
					</span>
				{:else}
					<span class="text-sm font-semibold text-gray-800">Eraser</span>
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
			<div>
				<div class="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
					Eraser Size
				</div>
				<div class="flex items-center gap-2">
					<button
						class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95"
						onclick={() => onSizeChange(erasingBrushSize > 1 ? erasingBrushSize - 1 : 1)}
						title="Decrease"
					>
						<LucideMinus size={16} />
					</button>
					<div class="flex flex-1 items-center gap-2">
						<input
							type="range"
							min="1"
							max="50"
							step="1"
							value={erasingBrushSize}
							oninput={(e) => onSizeChange(parseInt(e.currentTarget.value))}
							class="h-1.5 w-full appearance-none rounded-full bg-gray-200 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:hover:bg-red-600"
						/>
						<div class="w-10 text-center text-sm font-medium text-gray-700">
							{erasingBrushSize}
						</div>
					</div>
					<button
						class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95"
						onclick={() => {
							if (erasingBrushSize >= 67) {
							} else {
								onSizeChange(erasingBrushSize + 1);
							}
						}}
						title="Increase"
					>
						<LucidePlus size={16} />
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
