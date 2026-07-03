<script lang="ts">
	import { fly } from 'svelte/transition';
	import {
		LucideX,
		LucideZoomIn,
		LucideMinus,
		LucidePlus,
		LucideRotateCcw,
		LucideMove3D,
		LucideChevronDown,
		LucideChevronUp
	} from 'lucide-svelte';
	import { MAX_PDF_ZOOM, MIN_PDF_ZOOM, pdfZoomToPercent } from '../../utils/zoomLimits';

	interface Props {
		zoom: number;
		zoomEnabled: boolean;
		isPageDisabled: boolean;
		isMinimized?: boolean;
		onClose: () => void;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onResetZoom: () => void;
		onToggleZoom: () => void;
	}

	let {
		zoom,
		zoomEnabled,
		isMinimized = $bindable(false),
		onClose,
		onZoomIn,
		onZoomOut,
		onResetZoom,
		onToggleZoom
	}: Props = $props();
</script>

<!-- Fixed Top-Right Panel -->
<div transition:fly={{ x: 10, y: 0, duration: 200 }} class="pdf-editor-touch-controls fixed top-20 right-4 z-[110]">
	<div class="w-64 rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
		<!-- Header -->
		<div class="mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"
				>
					<LucideZoomIn size={16} />
				</div>
				<span class="text-sm font-semibold text-gray-800">Zoom</span>
			</div>
			<div class="flex items-center gap-1">
				<button
					class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200"
					onclick={() => (isMinimized = !isMinimized)}
					title={isMinimized ? 'Expand' : 'Minimize'}
				>
					{#if isMinimized}
						<LucideChevronDown size={16} />
					{:else}
						<LucideChevronUp size={16} />
					{/if}
				</button>
				<button
					class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200"
					onclick={onClose}
					title="Close"
				>
					<LucideX size={16} />
				</button>
			</div>
		</div>

		{#if !isMinimized}
			<!-- Zoom Controls -->
			<div class="mb-4">
				<div class="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
					Zoom Level
				</div>
				<div class="flex items-center gap-2">
					<button
						onclick={onZoomOut}
						disabled={zoom <= MIN_PDF_ZOOM}
						class="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
						title="Zoom Out"
					>
						<LucideMinus size={18} />
					</button>
					<div class="flex flex-1 items-center justify-center">
						<div class="text-center text-xl font-semibold text-indigo-600">
							{pdfZoomToPercent(zoom)}%
						</div>
					</div>
					<button
						onclick={onZoomIn}
						disabled={zoom >= MAX_PDF_ZOOM}
						class="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
						title="Zoom In"
					>
						<LucidePlus size={18} />
					</button>
				</div>
			</div>

			<!-- Reset Button -->
			<button
				onclick={onResetZoom}
				class="mb-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				title="Reset Zoom (100%)"
			>
				<LucideRotateCcw size={16} />
				<span>Reset to 100%</span>
			</button>

			<!-- Touch Zoom Toggle -->
			<button
				onclick={onToggleZoom}
				class="flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				class:bg-indigo-100={zoomEnabled}
				class:text-indigo-700={zoomEnabled}
				class:border={zoomEnabled}
				class:border-indigo-200={zoomEnabled}
				class:bg-gray-100={!zoomEnabled}
				class:text-gray-600={!zoomEnabled}
				title="Toggle Touch Zoom"
			>
				<LucideMove3D size={16} />
				<span>{zoomEnabled ? 'Touch Zoom: ON' : 'Touch Zoom: OFF'}</span>
			</button>
		{/if}
	</div>
</div>
