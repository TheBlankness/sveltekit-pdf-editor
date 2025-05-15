<script lang="ts">
	import { onMount } from 'svelte';
	// import type { PageData } from './$types';
	import { PdfEditor } from '$lib';
	import PDFUploadModal from '$lib/PDFUploadModal.svelte';
	import { FileUp } from 'lucide-svelte';
	// export let data: PageData;

	let pageAnnotations: any[] = [];
	let pdfBlob: Blob | null = null;
	let fileName = '';
	let isModalOpen = false;

	function handleDataUpdate(event: { detail: { newData: any } }) {
		// Save the updated annotation data
		const updatedData = event.detail.newData;

		// Update local state
		pageAnnotations = updatedData;

		// If we have a current document, update its annotations in storage
		if (fileName) {
			updateCurrentDocumentAnnotations(updatedData);
		}
	}

	function updateCurrentDocumentAnnotations(annotations: any[]) {
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
</div>
