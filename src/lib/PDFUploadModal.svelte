<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { X, Upload, File } from 'lucide-svelte';

	export let isOpen = false;

	const dispatch = createEventDispatcher();

	let savedDocuments = [];
	let selectedFile: File | null = null;
	let documentName = '';
	let error = '';

	onMount(() => {
		loadSavedDocuments();
	});

	function loadSavedDocuments() {
		const savedDocsString = localStorage.getItem('savedDocuments');
		if (savedDocsString) {
			savedDocuments = JSON.parse(savedDocsString);
		}
	}

	function closeModal() {
		isOpen = false;
		selectedFile = null;
		documentName = '';
		error = '';
		dispatch('close');
	}

	function handleFileChange(e) {
		const files = e.target.files;
		if (files && files[0]) {
			selectedFile = files[0];

			// Auto-populate the document name from the file name (without extension)
			const fileName = selectedFile.name;
			documentName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
		}
	}

	async function handleSubmit() {
		if (!selectedFile) {
			error = 'Please select a PDF file';
			return;
		}

		if (!documentName.trim()) {
			error = 'Please enter a document name';
			return;
		}

		try {
			// Read the file as a blob
			const pdfBlob = selectedFile;

			// Create a new document entry
			const newDoc = {
				id: Date.now().toString(),
				name: documentName,
				date: new Date().toISOString(),
				pdfBlob: await blobToBase64(pdfBlob),
				allObjects: []
			};

			// Save the document to localStorage
			savedDocuments = [newDoc, ...savedDocuments];
			localStorage.setItem('savedDocuments', JSON.stringify(savedDocuments));

			// Dispatch the document loaded event
			dispatch('documentSelected', {
				pdfBlob,
				name: documentName,
				allObjects: []
			});

			closeModal();
		} catch (err) {
			error = 'Failed to process the PDF file';
			console.error(err);
		}
	}

	function loadDocument(doc) {
		try {
			const pdfBlob = base64ToBlob(doc.pdfBlob, 'application/pdf');

			// Dispatch the document loaded event
			dispatch('documentSelected', {
				pdfBlob,
				name: doc.name,
				allObjects: doc.allObjects || []
			});

			closeModal();
		} catch (err) {
			error = 'Failed to load the saved document';
			console.error(err);
		}
	}

	function deleteDocument(id, event) {
		event.stopPropagation();

		savedDocuments = savedDocuments.filter((doc) => doc.id !== id);
		localStorage.setItem('savedDocuments', JSON.stringify(savedDocuments));
	}

	// Helper function to convert Blob to base64
	function blobToBase64(blob) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}

	// Helper function to convert base64 to Blob
	function base64ToBlob(base64, type) {
		const byteString = atob(base64.split(',')[1]);
		const arrayBuffer = new ArrayBuffer(byteString.length);
		const int8Array = new Uint8Array(arrayBuffer);

		for (let i = 0; i < byteString.length; i++) {
			int8Array[i] = byteString.charCodeAt(i);
		}

		return new Blob([int8Array], { type });
	}

	// Format date for display
	function formatDate(dateString) {
		const date = new Date(dateString);
		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
			<div class="flex justify-between items-center p-4 border-b">
				<h2 class="text-xl font-semibold">PDF Documents</h2>
				<button class="text-gray-500 hover:text-gray-700" on:click={closeModal}>
					<X size={20} />
				</button>
			</div>

			<div class="p-4 border-b">
				<div class="mb-4">
					<label for="pdf-file" class="block text-sm font-medium text-gray-700 mb-1"
						>Upload PDF</label
					>
					<div class="flex items-center justify-center w-full">
						<label
							class="flex flex-col w-full h-32 border-2 border-dashed rounded-lg border-gray-300 hover:bg-gray-50 hover:border-orange-300 cursor-pointer"
						>
							<div class="flex flex-col items-center justify-center pt-5 pb-6">
								<Upload size={28} class="text-gray-400 mb-2" />
								<p class="text-sm text-gray-500">
									<span class="font-semibold">Click to upload</span> or drag and drop
								</p>
								<p class="text-xs text-gray-500">PDF files only</p>
							</div>
							<input
								type="file"
								class="hidden"
								accept="application/pdf"
								on:change={handleFileChange}
							/>
						</label>
					</div>
				</div>

				{#if selectedFile}
					<div class="mb-4">
						<p class="text-sm text-gray-600">Selected: {selectedFile.name}</p>
					</div>

					<div class="mb-4">
						<label class="block text-sm font-medium text-gray-700 mb-1" for="documentName">
							Document Name
						</label>
						<input
							type="text"
							id="documentName"
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
							bind:value={documentName}
							placeholder="Enter document name"
						/>
					</div>

					<button
						class="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-md transition-colors"
						on:click={handleSubmit}
					>
						Upload and Open
					</button>
				{/if}

				{#if error}
					<p class="mt-2 text-sm text-red-600">{error}</p>
				{/if}
			</div>

			<div class="p-4">
				<h3 class="text-lg font-medium mb-3">Previous Documents</h3>

				{#if savedDocuments.length === 0}
					<p class="text-gray-500 text-sm">No saved documents</p>
				{:else}
					<div class="space-y-2">
						{#each savedDocuments as doc}
							<button
								class="flex items-center p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
								on:click={() => loadDocument(doc)}
							>
								<div class="mr-3 text-gray-400">
									<File size={24} />
								</div>
								<div class="flex-1">
									<p class="font-medium text-gray-800">{doc.name}</p>
									<p class="text-xs text-gray-500">{formatDate(doc.date)}</p>
								</div>
								<button
									class="text-gray-400 hover:text-red-500"
									on:click={(e) => deleteDocument(doc.id, e)}
								>
									<X size={18} />
								</button>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
