<script lang="ts">
	export let homework_info: any = undefined;
	export let view_homework_info: HTMLDialogElement | undefined = undefined;
</script>

<dialog bind:this={view_homework_info} class="rounded-lg border border-gray-200 bg-white p-0 shadow-xl">
	<div class="max-w-md p-4">
		<div class="mb-3 flex items-center justify-between gap-4">
			<h2 class="text-base font-semibold text-gray-900">Document Info</h2>
			<button
				type="button"
				class="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
				on:click={() => view_homework_info?.close()}
			>
				Close
			</button>
		</div>

		{#if homework_info}
			<pre class="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700">{JSON.stringify(homework_info, null, 2)}</pre>
		{:else}
			<p class="text-sm text-gray-600">No document info was provided.</p>
		{/if}
	</div>
</dialog>
