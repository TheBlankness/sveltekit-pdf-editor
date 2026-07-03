<script lang="ts">
	import { onMount } from 'svelte';
	// import type { PageData } from './$types';
	import { PdfEditor } from '$lib';
	import PDFUploadModal from '$lib/PDFUploadModal.svelte';
	import { Check, ClipboardCopy, FileUp, X } from 'lucide-svelte';
	// export let data: PageData;

	let pageAnnotations: any[][] = [];
	let pdfBlob: Blob | null = null;
	let fileName = '';
	let isModalOpen = false;
	let isSaveJsonModalOpen = false;
	let saveJsonOutput = '';
	let copyState: 'idle' | 'copied' | 'failed' = 'idle';

	function handleDataUpdate(event: { detail: { newData: any[][] } }) {
		// Save the updated annotation data
		const updatedData = event.detail.newData;

		// Update local state
		pageAnnotations = updatedData;

		// If we have a current document, update its annotations in storage
		if (fileName) {
			updateCurrentDocumentAnnotations(updatedData);
		}
	}

	function showSaveJsonModal(annotations: any[][]) {
		saveJsonOutput = JSON.stringify(annotations, null, 2);
		copyState = 'idle';
		isSaveJsonModalOpen = true;
	}

	async function handleSaveAnnotations(annotations: any[][]) {
		pageAnnotations = annotations;
		if (fileName) {
			updateCurrentDocumentAnnotations(annotations);
		}
		showSaveJsonModal(annotations);
	}

	async function copySaveJson() {
		try {
			await navigator.clipboard.writeText(saveJsonOutput);
			copyState = 'copied';
			setTimeout(() => {
				if (copyState === 'copied') copyState = 'idle';
			}, 1500);
		} catch {
			copyState = 'failed';
		}
	}

	function closeSaveJsonModal() {
		isSaveJsonModalOpen = false;
	}

	function updateCurrentDocumentAnnotations(annotations: any[][]) {
		const savedDocsString = localStorage.getItem('savedDocuments');
		if (savedDocsString) {
			const savedDocs = JSON.parse(savedDocsString);
			const updatedDocs = savedDocs.map((doc: { name: string }) => {
				if (doc.name === fileName) {
					return { ...doc, pageAnnotations: annotations };
				}
				return doc;
			});

			localStorage.setItem('savedDocuments', JSON.stringify(updatedDocs));
		}
	}

	function handleDocumentSelected(event: any) {
		const { pdfBlob: newPdfBlob, name, pageAnnotations: docObjects } = event.detail;

		// Update the UI state
		pdfBlob = newPdfBlob;
		fileName = name;
		pageAnnotations = docObjects || [];
	}

	function openUploadModal() {
		isModalOpen = true;
	}

	function handleDone() {
		// Save the current document first
		if (fileName && pageAnnotations.length > 0) {
			updateCurrentDocumentAnnotations(pageAnnotations);
		}

		// Reset the current document state
		pdfBlob = null;
		fileName = '';
		pageAnnotations = [];
		isSaveJsonModalOpen = false;

		// Open the modal to select a new document
		openUploadModal();
	}

	onMount(() => {
		// Initialize pageAnnotations based on the first document if available
		const savedDocsString = localStorage.getItem('savedDocuments');
		if (savedDocsString) {
			const savedDocs = JSON.parse(savedDocsString);
			if (savedDocs.length > 0) {
				// Don't auto-load, just initialize the array
				pageAnnotations = [];
			}
		}
	});
</script>

<div class="w-full h-full">
	<main class="w-full h-full">
		{#if pdfBlob}
			<PdfEditor
				{fileName}
				ownerId={'USER1'}
				{pageAnnotations}
				handleSave={handleSaveAnnotations}
				autoSaveEnabled={false}
				on:dataUpdated={handleDataUpdate}
				{pdfBlob}
				on:done={handleDone}
			/>
		{:else}
			<!-- landing page / product demo -->
			<div class="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
				<h1 class="text-3xl font-bold text-gray-900">Sveltekit PDF Annotations Example</h1>
				<div class="text-center">
					<h2 class="mt-2 text-lg font-medium text-gray-900">No PDF document loaded</h2>
					<p class="mt-1 text-sm text-gray-500">Get started by uploading a PDF document.</p>
					<div class="mt-6">
						<button
							on:click={openUploadModal}
							class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-400"
						>
							<FileUp size={18} class="mr-2" />
							Upload PDF
						</button>
					</div>
				</div>
			</div>
		{/if}
	</main>

	<PDFUploadModal bind:isOpen={isModalOpen} on:documentSelected={handleDocumentSelected} />

	{#if isSaveJsonModalOpen}
		<div class="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
			<button
				type="button"
				class="absolute inset-0 cursor-default"
				aria-label="Close JSON output modal"
				on:click={closeSaveJsonModal}
			></button>
			<section
				class="relative z-10 flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
				role="dialog"
				aria-modal="true"
				aria-labelledby="save-json-title"
			>
				<header class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
					<div>
						<h2 id="save-json-title" class="text-lg font-semibold text-gray-900">Saved annotation JSON</h2>
						<p class="mt-1 text-sm text-gray-500">Demo output from the editor Save button.</p>
					</div>
					<button
						type="button"
						class="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
						on:click={closeSaveJsonModal}
						aria-label="Close"
					>
						<X class="h-5 w-5" />
					</button>
				</header>

				<div class="min-h-0 flex-1 overflow-auto bg-gray-950 p-4">
					<pre class="whitespace-pre-wrap break-words text-xs leading-5 text-amber-100"><code>{saveJsonOutput}</code></pre>
				</div>

				<footer class="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
					<p class="text-sm text-gray-500">
						This is the annotation-only payload you can persist in your app.
					</p>
					<button
						type="button"
						class="inline-flex items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
						on:click={copySaveJson}
					>
						{#if copyState === 'copied'}
							<Check class="h-4 w-4" />
							Copied
						{:else}
							<ClipboardCopy class="h-4 w-4" />
							{copyState === 'failed' ? 'Copy failed' : 'Copy JSON'}
						{/if}
					</button>
				</footer>
			</section>
		</div>
	{/if}
</div>