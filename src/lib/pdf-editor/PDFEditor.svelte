<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { fly } from 'svelte/transition';
	import PDFPage from './PDFPage.svelte';
	import Text from './Text.svelte';
	import Drawing from './Drawing.svelte';
	import DrawingCanvas from './DrawingCanvas.svelte';
	import { fetchFont } from './utils/prepareFonts.js';
	// for image
	import { readAsArrayBuffer, readAsImage, readAsDataURL } from './utils/asyncReader.js';
	import { ggID } from './utils/helper.js';
	import { save } from './utils/PDF.js';

	import { getDocument, type PDFPageProxy } from 'pdfjs-dist';
	import 'pdfjs-dist/build/pdf.worker.min.mjs';
	import {
		LucideEraser,
		LucidePencilLine,
		LucideRedo2,
		LucideType,
		LucideUndo2,
		LucideChevronLeft,
		LucidePlus,
		LucideMinus,
		LucideFileCheck,
		LucideTriangleAlert,
		LucideRepeat
	} from 'lucide-svelte';
	import ErasingCanvas from './ErasingCanvas.svelte';

	type DrawingAnnotation = {
		id: string;
		owner: string;
		type: 'drawing';
		path: string;
		x: number;
		y: number;
		originWidth: number;
		originHeight: number;
		width: number;
		scale: number;
		brushSize: number;
		brushColor: string;
	};

	type TextAnnotation = {
		id: string;
		owner: string;
		type: 'text';
		x: number;
		y: number;
		width: number;
		size: number;
		lineHeight: number;
		fontFamily: string;
		lines: string[];
	};

	type Annotation = DrawingAnnotation | TextAnnotation;
	type PageAnnotations = Annotation[];

	type DisabledPageRange = {
		from_page: number;
		to_page: number;
	};

	const dispatch = createEventDispatcher();

	type SavingState = 'saving' | 'saved' | 'fail';

	export let pageAnnotations: PageAnnotations[] = [];
	export let pdfBlob;
	export let allowPrinting = true;
	export let ownerId = 'user1';
	export let fileName = '';
	export let savingState: SavingState = 'saved';
	export let disabledPages: DisabledPageRange[] = [];

	const handleDone = () => {
		dispatch('done', { newData: pageAnnotations });
	};

	const genID = ggID();
	let pdfFile: File;
	let pdfName = '';
	let pages: Promise<PDFPageProxy>[] = [];
	let pagesScale: number[] = [];

	let zoom = 2;

	let currentFont = 'Roboto';

	let saving = false;
	let addingDrawing = false;
	let brushSize = 3;
	let ErasingBrushSize = 15;
	let brushColor = '#000000';

	let isErasing = false;

	//is PDF ready
	let PDFReady = false;

	// Page Index for pageAnnotations
	$: selectedPageIndex = currentPage - 1;

	//pagination
	let maxPage = 1;
	let minPage = 1;
	let currentPage = 1;
	const itemsPerPage = 1;

	// check page disabled
	function isPageDisdabledFunction(disabledPages: DisabledPageRange[], currentPage: number) {
		return disabledPages.some(
			(range) => currentPage >= range.from_page && currentPage <= range.to_page
		);
	}

	$: isPageDisabled = isPageDisdabledFunction(disabledPages, currentPage);

	$: if (isPageDisabled) {
		addingDrawing = false;
		isErasing = false;
		isAddingDisabled = true;
	} else {
		isAddingDisabled = false;
	}

	function nextPage() {
		if (currentPage < Math.ceil(maxPage / itemsPerPage)) {
			currentPage++;
		}
	}

	function prevPage() {
		if (currentPage > minPage) {
			currentPage--;
		}
	}

	$: paginatedPages = pages.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

	const presetColors = [
		'#232529', // Black - general writing
		'#5C5E63',
		'#FF5B59',
		'#F65385',
		'#FD9038',
		'#F5B900',
		'#0FC27B',
		'#17BDE9',
		'#266DF0',
		'#9162F9'
	];

	// for test purpose
	onMount(async () => {
		try {
			// const res = await fetch('/document.pdf');
			// const pdfBlob = await res.blob();
			await addPDF(pdfBlob);
			selectedPageIndex = 0;
			fetchFont(currentFont);
		} catch (e) {
			console.log(e);
		}
	});

	function customSort(a: { type: string }, b: { type: string }) {
		if (a.type === 'text' && b.type !== 'text') {
			return 1; // 'a' is text, 'b' is not text, so 'a' should come after 'b'
		} else if (a.type !== 'text' && b.type === 'text') {
			return -1; // 'b' is text, 'a' is not text, so 'a' should come before 'b'
		} else {
			return 0; // Both are text or both are not text, maintain their relative positions
		}
	}

	async function addPDF(file: File) {
		try {
			async function readAsPDF(file: BlobPart) {
				// Safari possibly get webkitblobresource error 1 when using origin file blob
				const blob = new Blob([file]);
				const url = window.URL.createObjectURL(blob);

				return getDocument(url).promise;
			}
			const pdf = await readAsPDF(file);
			pdfName = file.name;
			pdfFile = file;
			const numPages = pdf.numPages;
			pages = Array(numPages)
				.fill(null)
				.map((_, i) => pdf.getPage(i + 1));
			// check if past pageAnnotations has something if nothing overwrite to match page length
			// TODO: add double check incase page changes
			if (pageAnnotations.length === 0) {
				// Overwrite pageAnnotations
				pageAnnotations = pages.map(() => []);
				dispatch('dataUpdated', { newData: pageAnnotations });
			}
			if (pageAnnotations.length !== pages.length) {
				if (
					confirm(
						'Previous Saved Annotations are corrupted. Continue will result in loss of annotations. Do you want to continue?'
					)
				) {
					if (pageAnnotations.length < pages.length) {
						pageAnnotations = pageAnnotations.concat(
							Array(pages.length - pageAnnotations.length).fill([])
						);
						dispatch('dataUpdated', { newData: pageAnnotations });
					} else if (pageAnnotations.length > pages.length) {
						pageAnnotations = pageAnnotations.slice(0, pages.length);
						dispatch('dataUpdated', { newData: pageAnnotations });
					}
				} else {
					handleDone();
				}
			}

			pagesScale = Array(numPages).fill(zoom);
			maxPage = pages.length;

			PDFReady = true;
		} catch (e) {
			console.log('Failed to add pdf.');
			throw e;
		}
	}
	// ADDING TEXT FUNCTIONS
	let AddTextButtonField = 'Add Text';
	let isAddingDisabled = false; // Flag to track the cooldown

	function onAddTextField() {
		if (isAddingDisabled) return; // Prevent action if disabled

		if (selectedPageIndex >= 0) {
			addingDrawing = false;
			isErasing = false;
			addTextField();
			AddTextButtonField = 'Adding...';
			isAddingDisabled = true; // Disable further clicks
			setTimeout(() => {
				AddTextButtonField = 'Add Text';
				isAddingDisabled = false; // Re-enable after 1.5 seconds
			}, 1500);
		}
	}
	function addTextField() {
		const id = genID();
		const object: TextAnnotation = {
			id,
			owner: ownerId,
			type: 'text',
			size: 16,
			width: 0, // not being used for now
			lineHeight: 1, // for now fixed until text position rework
			fontFamily: currentFont,
			x: 10,
			y: 10,
			lines: ['Text']
		};
		pageAnnotations = pageAnnotations.map((objects, pIndex) =>
			pIndex === selectedPageIndex ? [...objects, object] : objects
		);
		dispatch('dataUpdated', { newData: pageAnnotations });
	}

	// ADDING DRAWINGS ---------------------------------------------------------------- START

	function onAddDrawing(isaddingDrawing: boolean) {
		if (selectedPageIndex >= 0) {
			addingDrawing = !isaddingDrawing;
			isErasing = false;
		}
	}

	async function addDrawing(
		originWidth: number,
		originHeight: any,
		path: any,
		scale = 1,
		brushSize: any,
		brushColor: any
	) {
		const id = genID();
		const object: DrawingAnnotation = {
			id,
			owner: ownerId,
			path,
			type: 'drawing',
			x: 0,
			y: 0,
			originWidth,
			originHeight,
			width: originWidth * scale,
			scale,
			brushSize,
			brushColor
		};
		pageAnnotations = pageAnnotations.map((objects, pIndex) =>
			pIndex === selectedPageIndex ? [...objects, object] : objects
		);
		pageAnnotations[selectedPageIndex].sort(customSort);
		dispatch('dataUpdated', { newData: pageAnnotations });
	}

	// ADDING TEXT ------------------------------------------------------------------- END

	// ERASING FUNCTIONS

	function onErasing(currentisErasing: boolean) {
		if (selectedPageIndex >= 0) {
			isErasing = !currentisErasing;
			addingDrawing = false;
		}
	}

	const deleteObjectById = (id: any) => {
		function removeObjectById(objectsArray: any[], id: any) {
			let foundObject: any = null;
			let foundIndex = { outer: -1, inner: -1 };

			// Iterate through the array to find the object with the given id
			objectsArray.forEach((objects, outerIndex) => {
				objects.forEach((object: { id: any }, innerIndex: any) => {
					if (object.id === id) {
						foundObject = object;
						foundIndex = { outer: outerIndex, inner: innerIndex };
					}
				});
			});

			if (foundObject && foundObject.owner !== ownerId) return objectsArray;

			// Remove the object with the given id and store it in redoobjects
			if (foundIndex.outer !== -1 && foundIndex.inner !== -1 && foundObject) {
				const removedObject = objectsArray[foundIndex.outer].splice(foundIndex.inner, 1)[0];
				redoobjects.push({
					outer: foundIndex.outer,
					inner: foundIndex.inner,
					object: removedObject
				});
			}

			return objectsArray;
		}

		// Example usage
		const modifiedArray = removeObjectById(pageAnnotations, id);
		pageAnnotations = modifiedArray;
		dispatch('dataUpdated', { newData: pageAnnotations });
	};

	function selectFontFamily(event: { detail: { name: any } }) {
		const name = event.detail.name;
		fetchFont(name);
		currentFont = name;
	}
	function selectPage(index: number) {
		selectedPageIndex = index;
	}
	function updateObject(objectId: string, payload: any) {
		if (isPageDisabled) return;
		pageAnnotations = pageAnnotations.map((objects, pIndex) =>
			pIndex == selectedPageIndex
				? objects.map((object) => (object.id === objectId ? { ...object, ...payload } : object))
				: objects
		);
		dispatch('dataUpdated', { newData: pageAnnotations });
	}
	function deleteObject(objectId: string) {
		if (isPageDisabled) return;
		pageAnnotations = pageAnnotations.map((objects, pIndex) =>
			pIndex == selectedPageIndex ? objects.filter((object) => object.id !== objectId) : objects
		);
		dispatch('dataUpdated', { newData: pageAnnotations });
	}

	// FIXME: Should wait all objects finish their async work
	async function savePDF() {
		if (!pdfFile || saving || !pages.length) return;
		saving = true;
		try {
			await save(pdfFile, pageAnnotations, pdfName);
		} catch (e) {
			console.log(e);
		} finally {
			saving = false;
		}
	}
	let redoobjects: { outer: number; inner: number; object: any }[] = [];

	const handleUndo = () => {
		function removeLatestIDWithRecentTimestamp(objectsArray: any[]) {
			// Find the latest timestamp ID
			let latestTimestamp = 0;
			let latestIDIndex = { outer: -1, inner: -1 }; // Initialize with invalid indices

			objectsArray.forEach((objects, outerIndex) => {
				objects.forEach((object: { id: string; owner: string }, innerIndex: any) => {
					const idTimestamp = parseInt(object.id);
					if (object.owner !== ownerId) return;
					const now = Date.now();
					if (idTimestamp < now - 60000) return;

					if (idTimestamp > latestTimestamp) {
						latestTimestamp = idTimestamp;
						latestIDIndex = { outer: outerIndex, inner: innerIndex };
					}
				});
			});

			// Remove the object with the latest timestamp ID and store it in redoobjects
			if (latestIDIndex.outer !== -1 && latestIDIndex.inner !== -1) {
				const removedObject = objectsArray[latestIDIndex.outer].splice(latestIDIndex.inner, 1)[0];
				redoobjects.push({
					outer: latestIDIndex.outer,
					inner: latestIDIndex.inner,
					object: removedObject
				});
			}

			return objectsArray;
		}

		// Example usage
		const modifiedArray = removeLatestIDWithRecentTimestamp(pageAnnotations);
		pageAnnotations = modifiedArray;
		dispatch('dataUpdated', { newData: pageAnnotations });
	};
	const handleRedo = () => {
		if (redoobjects.length > 0) {
			const redoObject = redoobjects.pop(); // Get the last removed object from redoobjects
			if (!redoObject) return; // If there's nothing to redo, exit
			const { outer, inner, object } = redoObject;

			// Create a deep copy of pageAnnotations
			const modifiedArray = pageAnnotations.map((innerArray) => innerArray.slice());

			// Restore the removed object to its original position in the modified array
			if (modifiedArray[outer] && modifiedArray[outer].length >= inner) {
				modifiedArray[outer].splice(inner, 0, object);
			} else if (modifiedArray[outer]) {
				modifiedArray[outer].push(object);
			} else {
				modifiedArray[outer] = [object];
			}

			// Update pageAnnotations with the modified array
			pageAnnotations = modifiedArray;
			dispatch('dataUpdated', { newData: pageAnnotations });
		}
	};

	function handlePageInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const value = parseInt(target.value, 10);
		if (!isNaN(value)) {
			currentPage = Math.max(minPage, Math.min(value, maxPage));
		}
	}
</script>

<div class="fixed left-0 right-0 top-0 z-10 flex flex-col shadow-md">
	<!-- Main Toolbar -->
	<div class="border-b border-gray-200 bg-white">
		<div class="flex flex-col px-2 py-1 sm:px-4">
			<!-- Upper toolbar with saving status and primary actions -->
			<div class="flex items-center justify-between">
				<!-- Saving status indicator -->
				<div class="flex items-center gap-2">
					{#if savingState === 'saved'}
						<div
							class="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-emerald-600"
						>
							<LucideFileCheck size={16} />
							<span class="hidden sm:inline">Saved</span>
						</div>
					{:else if savingState === 'saving'}
						<div
							class="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-amber-500"
						>
							<span class="loading loading-spinner loading-xs"></span>
							<span class="hidden sm:inline">Saving</span>
						</div>
					{:else}
						<div class="flex flex-wrap items-center gap-1 sm:gap-2">
							<div
								class="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-rose-500"
							>
								<LucideTriangleAlert size={16} />
								<span class="hidden sm:inline">Not saved</span>
							</div>
							<button
								class="flex items-center gap-1 rounded-md border border-amber-500 px-2 py-1 text-xs font-medium text-amber-500 hover:bg-amber-50 sm:text-sm"
								on:click={() => {
									dispatch('dataUpdated', { newData: pageAnnotations });
								}}
							>
								<LucideRepeat size={14} />
								<span>Retry</span>
							</button>
						</div>
					{/if}
				</div>
				<p class="text-sm text-gray-600">
					Currently editing: <span class="font-medium">{fileName}</span>
				</p>
				<!-- Primary Actions -->
				<div class="flex items-center gap-2">
					{#if allowPrinting}
						<button
							on:click={savePDF}
							class="rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:from-amber-600 hover:to-yellow-500 disabled:opacity-60"
							class:cursor-not-allowed={pages.length === 0 || saving || !pdfFile}
							disabled={pages.length === 0 || saving || !pdfFile}
						>
							{saving ? 'Saving...' : 'Download'}
						</button>
					{/if}

					<button
						class="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-400 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:from-emerald-600 hover:to-teal-500"
						on:click={handleDone}
					>
						Done
					</button>
				</div>
			</div>

			<!-- Scrollable toolbar with editing tools -->
			<div class="no-scrollbar -mx-1 mt-1 flex items-center overflow-x-auto py-1">
				<!-- Undo/Redo group -->
				<div class="group mx-1 flex rounded-lg border border-gray-200 shadow-sm">
					<button
						disabled={isPageDisabled}
						on:click={handleUndo}
						class="flex h-9 w-9 items-center justify-center rounded-l-lg border-r border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-amber-600 disabled:bg-gray-100 disabled:text-gray-400"
					>
						<LucideUndo2 size={16} />
					</button>
					<button
						disabled={isPageDisabled}
						on:click={handleRedo}
						class="flex h-9 w-9 items-center justify-center rounded-r-lg text-gray-600 hover:bg-gray-50 hover:text-amber-600 disabled:bg-gray-100 disabled:text-gray-400"
					>
						<LucideRedo2 size={16} />
					</button>
				</div>

				<!-- Add Text button -->
				<button
					on:click={onAddTextField}
					disabled={selectedPageIndex < 0 || isAddingDisabled || isPageDisabled}
					class="mx-1 flex h-9 items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 text-sm text-gray-600 shadow-sm hover:bg-gray-50 hover:text-amber-600 disabled:bg-gray-100 disabled:text-gray-400"
				>
					<LucideType size={16} />
					<span class="hidden sm:inline">{AddTextButtonField}</span>
					<span class="inline sm:hidden">Text</span>
				</button>

				<!-- Drawing tools group -->
				<div class="group mx-1 flex rounded-lg border border-gray-200 shadow-sm">
					<button
						on:click={() => {
							onAddDrawing(addingDrawing);
						}}
						disabled={selectedPageIndex < 0 || isPageDisabled}
						class="flex h-9 items-center justify-center gap-1 rounded-l-lg border-r border-gray-200 px-3 text-sm hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
						class:text-amber-600={addingDrawing}
						class:bg-amber-50={addingDrawing}
						class:text-gray-600={!addingDrawing}
					>
						<LucidePencilLine size={16} />
						<span class="hidden sm:inline">Draw</span>
					</button>

					<button
						disabled={isPageDisabled}
						on:click={() => {
							onErasing(isErasing);
						}}
						class="flex h-9 items-center justify-center gap-1 rounded-r-lg px-3 text-sm hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
						class:text-amber-600={isErasing}
						class:bg-amber-50={isErasing}
						class:text-gray-600={!isErasing}
					>
						<LucideEraser size={16} />
						<span class="hidden sm:inline">Erase</span>
					</button>
				</div>

				<!-- Page navigation -->
				<div class="group mx-1 flex rounded-lg border border-gray-200 shadow-sm">
					<button
						on:click={prevPage}
						disabled={currentPage === minPage}
						class="flex h-9 items-center justify-center rounded-l-lg border-r border-gray-200 px-2 text-gray-600 hover:bg-gray-50 hover:text-amber-600 disabled:text-gray-300 sm:px-3"
					>
						<span class="hidden sm:inline">Prev</span>
						<span class="inline sm:hidden">←</span>
					</button>

					<div
						class="flex h-9 items-center justify-center border-r border-gray-200 px-1 text-sm text-gray-600"
					>
						<input
							type="number"
							class="w-7 border-none bg-transparent text-center [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
							bind:value={currentPage}
							on:input={handlePageInput}
							min={minPage}
							max={maxPage}
						/>
						<span>/{maxPage}</span>
					</div>

					<button
						on:click={nextPage}
						disabled={currentPage === Math.ceil(maxPage / itemsPerPage)}
						class="flex h-9 items-center justify-center rounded-r-lg px-2 text-gray-600 hover:bg-gray-50 hover:text-amber-600 disabled:text-gray-300 sm:px-3"
					>
						<span class="hidden sm:inline">Next</span>
						<span class="inline sm:hidden">→</span>
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Drawing tools panel - appears when drawing mode is active -->
	{#if addingDrawing}
		<div
			transition:fly={{ x: 0, y: -10, duration: 200 }}
			class="absolute left-1/2 top-full z-20 -translate-x-1/2 transform"
		>
			<div class="mt-2 flex items-center rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
				<button
					class="mr-3 flex items-center justify-center rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
					on:click={() => {
						addingDrawing = false;
					}}
				>
					<LucideChevronLeft size={18} />
				</button>

				<div class="flex items-center space-x-1">
					<button
						class="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
						on:click={() => {
							brushSize = brushSize > 1 ? brushSize - 1 : 1;
						}}
					>
						<LucideMinus size={16} />
					</button>

					<input
						class="w-8 text-center text-sm text-gray-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						type="number"
						readonly
						bind:value={brushSize}
					/>

					<button
						class="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
						on:click={() => {
							brushSize++;
						}}
					>
						<LucidePlus size={16} />
					</button>
				</div>

				<div class="ml-4 flex items-center space-x-1.5">
					{#each presetColors as color}
						<button
							class="h-6 w-6 cursor-pointer rounded-md border border-gray-200 transition-transform hover:scale-110"
							style="background-color: {color}"
							on:click={() => (brushColor = color)}
							class:ring-2={brushColor === color}
							class:ring-amber-400={brushColor === color}
							class:ring-offset-1={brushColor === color}
						>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Eraser tools panel - appears when erase mode is active -->
	{#if isErasing}
		<div
			transition:fly={{ x: 0, y: -10, duration: 200 }}
			class="absolute left-1/2 top-full z-20 -translate-x-1/2 transform"
		>
			<div class="mt-2 flex items-center rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
				<button
					class="mr-3 flex items-center justify-center rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
					on:click={() => {
						isErasing = false;
					}}
				>
					<LucideChevronLeft size={18} />
				</button>

				<span class="mr-3 text-sm font-medium text-gray-600">Eraser Size</span>

				<div class="flex items-center space-x-1">
					<button
						class="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
						on:click={() => {
							ErasingBrushSize = ErasingBrushSize > 1 ? ErasingBrushSize - 1 : 1;
						}}
					>
						<LucideMinus size={16} />
					</button>

					<input
						class="w-8 text-center text-sm text-gray-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						type="number"
						bind:value={ErasingBrushSize}
					/>

					<button
						class="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
						on:click={() => {
							ErasingBrushSize++;
						}}
					>
						<LucidePlus size={16} />
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Spacer to prevent content from hiding under the toolbar -->
<div class="h-20 sm:h-24 w-full"></div>

<!-- Main content area -->
<div class="h-[90vh]- -overflow-y-auto">
	<div class="w-fit pl-20 pr-40">
		{#if PDFReady}
			<div>
				{#each paginatedPages as page, index (page)}
					{@const pIndex = index + (currentPage - 1) * itemsPerPage}
					<div class="scroll-m-14 items-center p-8">
						<div class="relative shadow-lg" class:shadow-outline={pIndex === selectedPageIndex}>
							<PDFPage {zoom} {page} />
							<div
								class="absolute left-0 top-0 origin-top-left transform"
								style="transform: scale({zoom}); "
							>
								{#each pageAnnotations[pIndex] as object (object.id)}
									<!-- {#if object.type === 'image'}
										<Image
											on:update={(e) => updateObject(object.id, e.detail)}
											on:delete={() => deleteObject(object.id)}
											file={object.file}
											payload={object.payload}
											x={object.x}
											y={object.y}
											width={object.width}
											height={object.height}
											pageScale={zoom}
										/> -->
									{#if object.type === 'text'}
										<Text
											on:update={(e) => {
												if (object.owner !== ownerId) return;
												updateObject(object.id, e.detail);
											}}
											on:delete={() => {
												if (object.owner !== ownerId) return;
												deleteObject(object.id);
											}}
											on:selectFont={selectFontFamily}
											lines={object.lines}
											x={object.x}
											y={object.y}
											size={object.size}
											lineHeight={object.lineHeight}
											fontFamily={object.fontFamily}
											pageScale={zoom}
										/>
									{:else if object.type === 'drawing'}
										<Drawing
											on:update={(e) => updateObject(object.id, e.detail)}
											path={object.path}
											x={object.x}
											y={object.y}
											width={object.width}
											originWidth={object.originWidth}
											originHeight={object.originHeight}
											brushSize={object.brushSize}
											brushColor={object.brushColor}
										/>
									{/if}
								{/each}
							</div>
							{#if addingDrawing}
								<DrawingCanvas
									pageScale={zoom}
									{page}
									{brushSize}
									{brushColor}
									on:finish={(e) => {
										const { originWidth, originHeight, path, brushSize, brushColor } = e.detail;
										if (isPageDisabled) return;
										addDrawing(originWidth, originHeight, path, 1, brushSize, brushColor);
										addingDrawing = false;
										requestAnimationFrame(() => {
											addingDrawing = true;
										});
									}}
									on:cancel={() => (addingDrawing = false)}
								/>
							{/if}
							{#if isErasing}
								<ErasingCanvas
									pageAnnotations={pageAnnotations[pIndex]}
									pageScale={zoom}
									{page}
									brushSize={ErasingBrushSize}
									{brushColor}
									on:finish={(e) => {
										const { objectId } = e.detail;
										// deleteObject(objectId);
										deleteObjectById(objectId);
									}}
									on:cancel={() => (isErasing = false)}
								/>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex h-64 w-full items-center justify-center">
				<div class="flex flex-col items-center space-y-4">
					<div
						class="loading h-10 w-10 rounded-full border-4 border-amber-200 border-t-amber-500"
					></div>
					<p class="text-base font-medium text-gray-600">Loading PDF...</p>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Custom scrollbar styling */
	.no-scrollbar {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}

	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}

	/* Loading spinner animation */
	.loading {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
