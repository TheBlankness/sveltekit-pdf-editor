<script lang="ts">
	import { LucideCheck, LucideAlertCircle, LucideLoader2, LucideCircle } from 'lucide-svelte';
	import type { SaveState } from '../../context/pdfEditorContext';

	interface Props {
		saveState: SaveState;
		onRetry: () => void;
	}

	let { saveState, onRetry }: Props = $props();

	// Get status icon and color
	function getStatusDisplay() {
		// Priority: show unsaved warning if there are unsaved changes
		if (saveState.hasUnsavedChanges && saveState.status !== 'saving') {
			return { icon: LucideAlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Not saved' };
		}

		switch (saveState.status) {
			case 'saved':
			case 'cloud_saved':
				return { icon: LucideCheck, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Saved' };
			case 'local_saved':
				return {
					icon: LucideAlertCircle,
					color: 'text-amber-700',
					bg: 'bg-amber-50',
					label: 'Local only'
				};
			case 'saving':
				return { icon: LucideLoader2, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Saving...' };
			case 'fail':
				return { icon: LucideAlertCircle, color: 'text-rose-500', bg: 'bg-rose-50', label: 'Failed' };
			default:
				return { icon: LucideCircle, color: 'text-gray-400', bg: 'bg-gray-50', label: 'Idle' };
		}
	}

	let display = $derived(getStatusDisplay());
</script>

<div class="flex items-center gap-2">
	<!-- Status Indicator -->
	<div
		class="flex h-10 items-center gap-2 rounded-lg px-3 shadow-md transition-all {display.bg}"
		title={saveState.hasUnsavedChanges
			? 'Changes not saved yet'
			: saveState.status === 'fail'
				? 'Save failed - Click retry'
				: saveState.status === 'local_saved'
					? 'Stored on this device only. Reconnect and sync before your teacher can see it.'
					: `Status: ${saveState.status}`}
	>
		{#if saveState.status === 'saving'}
			<svelte:component this={display.icon} size={16} class="{display.color} animate-spin" />
		{:else}
			<svelte:component this={display.icon} size={16} class={display.color} />
		{/if}
		<span class="text-xs font-medium {display.color}">{display.label}</span>
	</div>

	<!-- Retry button (only on failure) -->
	{#if saveState.status === 'fail'}
		<button
			onclick={onRetry}
			class="flex h-10 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-sm font-medium text-white shadow-md transition-all hover:bg-amber-600 active:scale-95"
		>
			Retry
		</button>
	{/if}
</div>
