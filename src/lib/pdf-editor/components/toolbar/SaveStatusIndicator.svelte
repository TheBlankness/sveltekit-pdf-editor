<script lang="ts">
	import {
		LucideFileCheck,
		LucideTriangleAlert,
		LucideRepeat,
		LucideHardDrive,
		LucideCloudLightning,
		LucidePauseCircle
	} from 'lucide-svelte';
	import type { SaveState } from '../../context/pdfEditorContext';

	interface Props {
		saveState: SaveState;
		onRetry: () => void;
	}

	let { saveState, onRetry }: Props = $props();
</script>

<div class="flex items-center gap-2">
	{#if saveState.status === 'saved'}
		<div
			class="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-emerald-600"
		>
			<LucideFileCheck size={18} />
			<span class="hidden sm:inline">Saved</span>
		</div>
	{:else if saveState.status === 'saving'}
		<div
			class="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-amber-500"
		>
			<span class="loading loading-spinner loading-sm"></span>
			<span class="hidden sm:inline">Saving</span>
		</div>
	{:else if saveState.status === 'local_saved'}
		<div
			class="flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700"
			title="Stored on this device only. Reconnect and sync before your teacher can see it."
		>
			<LucideHardDrive size={18} />
			<span class="hidden sm:inline">Saved locally only</span>
		</div>
	{:else if saveState.status === 'cloud_saved'}
		<div
			class="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-emerald-600"
		>
			<LucideCloudLightning size={18} />
			<span class="hidden sm:inline">Cloud Saved</span>
		</div>
	{:else if saveState.status === 'idle'}
		<div
			class="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-gray-500"
		>
			<LucidePauseCircle size={18} />
			<span class="hidden sm:inline">Idle</span>
		</div>
	{:else}
		<div class="flex flex-wrap items-center gap-2">
			<div
				class="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-rose-500"
			>
				<LucideTriangleAlert size={18} />
				<span class="hidden sm:inline">Not saved</span>
			</div>
			<button
				class="flex items-center gap-1 rounded-lg border border-amber-500 px-3 py-2 text-sm font-medium text-amber-500 hover:bg-amber-50 active:bg-amber-100"
				onclick={() => {
					onRetry();
				}}
			>
				<LucideRepeat size={16} />
				<span>Retry</span>
			</button>
		</div>
	{/if}
	<div class="text-sm text-gray-500">
		{#if saveState.lastCloudSave}
			Last cloud save: {new Date(saveState.lastCloudSave).toLocaleTimeString()}
		{/if}
		{#if saveState.lastLocalSave}
			{#if saveState.lastCloudSave},
			{/if}Last local save:
			{new Date(saveState.lastLocalSave).toLocaleTimeString()}
		{/if}
	</div>
</div>
