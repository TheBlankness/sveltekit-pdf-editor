<script lang="ts">
	import { onMount } from 'svelte';
	import { PdfEditor } from '$lib';
	import {
		Check,
		ClipboardCopy,
		Database,
		FileText,
		FileUp,
		ShieldCheck,
		Trash2,
		UploadCloud,
		X
	} from 'lucide-svelte';

	type SavedDocument = {
		id: string;
		name: string;
		date: string;
		pdfBlob: string;
		pageAnnotations?: any[][];
		allObjects?: any;
		size?: number;
	};

	const STORAGE_KEY = 'savedDocuments';

	let pageAnnotations: any[][] = [];
	let pdfBlob: Blob | null = null;
	let fileName = '';
	let currentDocumentId = '';
	let savedDocuments: SavedDocument[] = [];
	let uploadError = '';
	let isDragActive = false;
	let isUploading = false;
	let fileInput: HTMLInputElement;
	let isSaveJsonModalOpen = false;
	let saveJsonOutput = '';
	let copyState: 'idle' | 'copied' | 'failed' = 'idle';

	function normalizeAnnotationPages(value: any): any[][] {
		if (!Array.isArray(value)) return [];
		if (value.length === 0) return [];
		if (value.every((page) => Array.isArray(page))) return value;
		return [value];
	}

	function normalizeSavedDocument(doc: any, index: number): SavedDocument | null {
		if (!doc?.pdfBlob || typeof doc.pdfBlob !== 'string') return null;

		return {
			id: String(doc.id || `${doc.name || 'pdf'}-${doc.date || index}`),
			name: String(doc.name || 'Untitled PDF'),
			date: String(doc.date || new Date().toISOString()),
			pdfBlob: doc.pdfBlob,
			pageAnnotations: normalizeAnnotationPages(doc.pageAnnotations ?? doc.allObjects),
			size: typeof doc.size === 'number' ? doc.size : undefined
		};
	}

	function loadSavedDocuments() {
		try {
			const savedDocsString = localStorage.getItem(STORAGE_KEY);
			if (!savedDocsString) {
				savedDocuments = [];
				return;
			}

			const parsed = JSON.parse(savedDocsString);
			savedDocuments = Array.isArray(parsed)
				? parsed
						.map((doc, index) => normalizeSavedDocument(doc, index))
						.filter((doc): doc is SavedDocument => Boolean(doc))
				: [];
		} catch (error) {
			console.error('Failed to load saved PDF documents', error);
			savedDocuments = [];
			uploadError = 'Saved PDFs could not be read from this browser.';
		}
	}

	function saveDocuments(docs: SavedDocument[]) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
		savedDocuments = docs;
	}

	function getDocumentName(fileName: string) {
		return fileName.replace(/\.pdf$/i, '') || 'Untitled PDF';
	}

	function makeDocumentId() {
		if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
			return crypto.randomUUID();
		}

		return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	}

	function isPdfFile(file: File) {
		return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
	}

	function openDocument(doc: SavedDocument, blob: Blob, annotations = doc.pageAnnotations || []) {
		currentDocumentId = doc.id;
		fileName = doc.name;
		pageAnnotations = normalizeAnnotationPages(annotations);
		pdfBlob = blob;
		isSaveJsonModalOpen = false;
	}

	async function saveAndOpenFile(file: File) {
		if (!isPdfFile(file)) {
			uploadError = 'Please choose a PDF file.';
			return;
		}

		isUploading = true;
		uploadError = '';

		const newDoc: SavedDocument = {
			id: makeDocumentId(),
			name: getDocumentName(file.name),
			date: new Date().toISOString(),
			pdfBlob: '',
			pageAnnotations: [],
			size: file.size
		};

		try {
			newDoc.pdfBlob = await blobToBase64(file);
			saveDocuments([newDoc, ...savedDocuments]);
			openDocument(newDoc, file, []);
		} catch (error) {
			console.error('Failed to save PDF locally', error);
			currentDocumentId = '';
			fileName = newDoc.name;
			pageAnnotations = [];
			pdfBlob = file;
			uploadError =
				'This PDF opened, but it could not be saved locally. Your browser storage may be full.';
		} finally {
			isUploading = false;
			if (fileInput) fileInput.value = '';
		}
	}

	function handleFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) void saveAndOpenFile(file);
	}

	function handleDragEnter(event: DragEvent) {
		event.preventDefault();
		isDragActive = true;
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragActive = true;
	}

	function handleDragLeave(event: DragEvent) {
		const currentTarget = event.currentTarget;
		const relatedTarget = event.relatedTarget;

		if (
			currentTarget instanceof HTMLElement &&
			relatedTarget instanceof Node &&
			currentTarget.contains(relatedTarget)
		) {
			return;
		}

		isDragActive = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragActive = false;

		const file = event.dataTransfer?.files?.[0];
		if (file) void saveAndOpenFile(file);
	}

	function loadDocument(doc: SavedDocument) {
		try {
			const blob = base64ToBlob(doc.pdfBlob, 'application/pdf');
			openDocument(doc, blob, doc.pageAnnotations || []);
		} catch (error) {
			console.error('Failed to load saved PDF document', error);
			uploadError = 'Failed to load the saved PDF.';
		}
	}

	function deleteDocument(id: string) {
		const updatedDocs = savedDocuments.filter((doc) => doc.id !== id);
		saveDocuments(updatedDocs);

		if (id === currentDocumentId) {
			pdfBlob = null;
			fileName = '';
			currentDocumentId = '';
			pageAnnotations = [];
		}
	}

	function handleDataUpdate(event: { detail: { newData: any[][] } }) {
		const updatedData = event.detail.newData;
		pageAnnotations = updatedData;

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
		try {
			const updatedDocs = savedDocuments.map((doc) => {
				const isCurrentDocument =
					(currentDocumentId && doc.id === currentDocumentId) ||
					(!currentDocumentId && doc.name === fileName);

				return isCurrentDocument
					? {
							...doc,
							pageAnnotations: annotations
						}
					: doc;
			});

			saveDocuments(updatedDocs);
		} catch (error) {
			console.error('Failed to save annotations locally', error);
		}
	}

	function handleDone() {
		if (fileName) {
			updateCurrentDocumentAnnotations(pageAnnotations);
		}

		pdfBlob = null;
		fileName = '';
		currentDocumentId = '';
		pageAnnotations = [];
		isSaveJsonModalOpen = false;
		loadSavedDocuments();
	}

	function blobToBase64(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result));
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}

	function base64ToBlob(base64: string, type: string) {
		const byteString = atob(base64.split(',')[1] || '');
		const arrayBuffer = new ArrayBuffer(byteString.length);
		const int8Array = new Uint8Array(arrayBuffer);

		for (let i = 0; i < byteString.length; i += 1) {
			int8Array[i] = byteString.charCodeAt(i);
		}

		return new Blob([int8Array], { type });
	}

	function formatDate(dateString: string) {
		const date = new Date(dateString);
		if (Number.isNaN(date.getTime())) return 'Saved locally';

		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(date);
	}

	function formatBytes(size: number | undefined) {
		if (!size) return '';
		if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
		return `${(size / (1024 * 1024)).toFixed(1)} MB`;
	}

	function getPreviewUrl(doc: SavedDocument) {
		return `${doc.pdfBlob}#toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH`;
	}

	function getAnnotationCount(doc: SavedDocument) {
		return normalizeAnnotationPages(doc.pageAnnotations).reduce(
			(total, pageObjects) => total + pageObjects.length,
			0
		);
	}

	function getAnnotationLabel(doc: SavedDocument) {
		const count = getAnnotationCount(doc);
		return `${count} annotation${count === 1 ? '' : 's'}`;
	}

	onMount(() => {
		loadSavedDocuments();
	});
</script>

<div class="min-h-screen w-full bg-zinc-50">
	<main class="min-h-screen w-full">
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
			<div class="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
				<header class="grid gap-5 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
					<div>
						<p class="text-sm font-semibold uppercase tracking-wide text-orange-600">
							Private demo
						</p>
						<h1 class="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
							Open a PDF and experiment with annotations.
						</h1>
						<p class="mt-3 max-w-3xl text-base leading-7 text-zinc-600">
							No data leaves your computer. PDFs and annotation JSON stay in this browser's
							localStorage for the demo, so you can safely upload a PDF, draw on it, save locally,
							and come back to it later.
						</p>
					</div>

					<div
						class="grid gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950"
					>
						<div class="flex gap-3">
							<ShieldCheck class="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
							<span>PDF files are read by your browser only.</span>
						</div>
						<div class="flex gap-3">
							<Database class="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
							<span>Annotations can be saved locally and copied as JSON.</span>
						</div>
					</div>
				</header>

				<section class="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
					<label
						for="pdf-file"
						class="group flex min-h-[22rem] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-white p-8 text-center shadow-sm transition hover:border-orange-300 hover:bg-orange-50/40"
						class:border-orange-400={isDragActive}
						class:bg-orange-50={isDragActive}
						on:dragenter={handleDragEnter}
						on:dragover={handleDragOver}
						on:dragleave={handleDragLeave}
						on:drop={handleDrop}
					>
						<input
							bind:this={fileInput}
							id="pdf-file"
							type="file"
							class="sr-only"
							accept="application/pdf"
							on:change={handleFileChange}
						/>

						<span
							class="rounded-full bg-orange-100 p-4 text-orange-600 transition group-hover:bg-orange-200"
						>
							<UploadCloud class="h-9 w-9" />
						</span>
						<h2 class="mt-5 text-xl font-semibold text-zinc-950">Select or drag a PDF here</h2>
						<p class="mt-2 max-w-sm text-sm leading-6 text-zinc-600">
							Drop a PDF to open it immediately. The file is also saved in your browser for this
							demo's previous PDF list.
						</p>
						<span
							class="mt-6 inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition group-hover:bg-orange-600"
						>
							<FileUp class="h-4 w-4" />
							{isUploading ? 'Opening PDF...' : 'Choose PDF'}
						</span>

						{#if uploadError}
							<p class="mt-4 text-sm font-medium text-red-600">{uploadError}</p>
						{/if}
					</label>

					<div class="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
						<div class="flex items-start justify-between gap-4">
							<div>
								<h2 class="text-xl font-semibold text-zinc-950">Previous PDFs</h2>
								<p class="mt-1 text-sm text-zinc-500">
									Resume documents stored in localStorage on this device.
								</p>
							</div>
							<span class="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
								{savedDocuments.length} saved
							</span>
						</div>

						{#if savedDocuments.length === 0}
							<div
								class="mt-6 flex min-h-[16rem] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center"
							>
								<FileText class="h-10 w-10 text-zinc-400" />
								<h3 class="mt-3 text-sm font-semibold text-zinc-800">No previous PDFs yet</h3>
								<p class="mt-1 max-w-xs text-sm text-zinc-500">
									Uploaded PDFs will appear here with a first-page preview after you open them.
								</p>
							</div>
						{:else}
							<div class="mt-6 grid max-h-[34rem] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
								{#each savedDocuments as doc}
									<article
										class="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm"
									>
										<div class="h-44 overflow-hidden bg-zinc-100">
											<iframe
												title={`${doc.name} preview`}
												src={getPreviewUrl(doc)}
												class="h-full w-full border-0 bg-white"
												loading="lazy"
											></iframe>
										</div>

										<div class="space-y-4 p-4">
											<div>
												<h3 class="truncate text-sm font-semibold text-zinc-950">{doc.name}</h3>
												<p class="mt-1 text-xs text-zinc-500">
													{formatDate(doc.date)}
													{#if formatBytes(doc.size)}
														<span aria-hidden="true"> - </span>{formatBytes(doc.size)}
													{/if}
												</p>
											</div>

											<div class="flex flex-wrap gap-2 text-xs">
												<span
													class="rounded-full bg-orange-50 px-2.5 py-1 font-medium text-orange-700"
												>
													{getAnnotationLabel(doc)}
												</span>
												<span
													class="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-600"
												>
													Local only
												</span>
											</div>

											<div class="flex gap-2">
												<button
													type="button"
													class="inline-flex flex-1 items-center justify-center rounded-md bg-zinc-950 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
													on:click={() => loadDocument(doc)}
												>
													Open
												</button>
												<button
													type="button"
													class="inline-flex items-center justify-center rounded-md border border-zinc-200 px-3 py-2 text-zinc-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
													aria-label={`Delete ${doc.name}`}
													on:click={() => deleteDocument(doc.id)}
												>
													<Trash2 class="h-4 w-4" />
												</button>
											</div>
										</div>
									</article>
								{/each}
							</div>
						{/if}
					</div>
				</section>
			</div>
		{/if}
	</main>

	{#if isSaveJsonModalOpen}
		<div class="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
			<button
				type="button"
				class="absolute inset-0 cursor-default"
				aria-label="Close JSON output modal"
				on:click={closeSaveJsonModal}
			></button>
			<div
				class="relative z-10 flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
				role="dialog"
				aria-modal="true"
				aria-labelledby="save-json-title"
			>
				<header class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
					<div>
						<h2 id="save-json-title" class="text-lg font-semibold text-gray-900">
							Saved annotation JSON
						</h2>
						<p class="mt-1 text-sm text-gray-500">
							This annotation payload was also saved locally for the current demo PDF.
						</p>
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
					<pre class="whitespace-pre-wrap break-words text-xs leading-5 text-amber-100"><code
							>{saveJsonOutput}</code
						></pre>
				</div>

				<footer
					class="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
				>
					<p class="text-sm text-gray-500">
						Copy this annotation-only JSON or reopen the PDF later from localStorage.
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
			</div>
		</div>
	{/if}
</div>
