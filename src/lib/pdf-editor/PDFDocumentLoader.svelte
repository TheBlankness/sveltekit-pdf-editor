<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		DocumentContent,
		useDocumentManagerCapability
	} from '@embedpdf/plugin-document-manager/svelte';

	let {
		documentId,
		buffer,
		name = 'document.pdf',
		children
	}: {
		documentId: string;
		buffer: ArrayBuffer | null;
		name?: string;
		children: any;
	} = $props();

	const documentManager = useDocumentManagerCapability();

	let isOpening = $state(true);
	let openError = $state<string | null>(null);
	let openedDocumentId: string | null = null;
	let openedBuffer: ArrayBuffer | null = null;

	$effect(() => {
		const capability = documentManager.provides;

		if (!capability || !buffer || !documentId || (openedDocumentId === documentId && openedBuffer === buffer)) {
			return;
		}

		let cancelled = false;

		if (openedDocumentId) {
			capability.closeDocument(openedDocumentId);
		}

		openedDocumentId = documentId;
		openedBuffer = buffer;
		isOpening = true;
		openError = null;

		const task = capability.openDocumentBuffer({
			documentId,
			buffer: buffer.slice(0),
			name,
			autoActivate: true
		});

		task.wait(
			(result) => {
				result.task.wait(
					() => {
						if (!cancelled) isOpening = false;
					},
					(error) => {
						if (!cancelled) {
							isOpening = false;
							openError = error?.reason?.message || 'Failed to open PDF document.';
						}
					}
				);
			},
			(error) => {
				if (!cancelled) {
					isOpening = false;
					openError = error?.reason?.message || 'Failed to start PDF document load.';
				}
			}
		);

		return () => {
			cancelled = true;
		};
	});

	onDestroy(() => {
		if (openedDocumentId) {
			documentManager.provides?.closeDocument(openedDocumentId);
		}
	});
</script>

{#if openError}
	<div class="flex h-64 w-full items-center justify-center">
		<div
			class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
		>
			{openError}
		</div>
	</div>
{:else if isOpening}
	<div class="flex h-64 w-full items-center justify-center">
		<div class="flex flex-col items-center space-y-3">
			<div class="loading h-10 w-10 rounded-full border-4 border-amber-200 border-t-amber-500"></div>
			<p class="text-sm font-medium text-gray-600">Opening PDF document...</p>
		</div>
	</div>
{:else}
	<DocumentContent {documentId}>
		{#snippet children(documentContent)}
			{@render children(documentContent)}
		{/snippet}
	</DocumentContent>
{/if}
