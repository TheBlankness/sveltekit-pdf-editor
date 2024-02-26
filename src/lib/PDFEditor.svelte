<script>
	// @ts-nocheck
	import { onMount, createEventDispatcher } from 'svelte';
	import { fly } from 'svelte/transition';
	import PDFPage from './PDFPage.svelte';
	import Image from './Image.svelte';
	import Text from './Text.svelte';
	import Drawing from './Drawing.svelte';
	import DrawingCanvas from './DrawingCanvas.svelte';
	import { fetchFont } from './utils/prepareFonts.js';
	// for image
	import { readAsArrayBuffer, readAsImage, readAsDataURL } from './utils/asyncReader.js';
	import { ggID } from './utils/helper.js';
	import { save } from './utils/PDF.js';

	import { getDocument } from 'pdfjs-dist';
	import 'pdfjs-dist/build/pdf.worker.min.mjs';

	const dispatch = createEventDispatcher();

	export let allObjects = [];
	export let pdfBlob;
	export let allowPrinting = true;

	const handleDone = () => {
		dispatch('done', { newData: allObjects });
	};

	const genID = ggID();
	let pdfFile;
	let pdfName = '';
	let pages = [];
	let pagesScale = [];
	let zoom = 1;

	let currentFont = 'Roboto';
	let selectedPageIndex = -1;
	let saving = false;
	let addingDrawing = false;
	let brushSize = 5;
	let brushColor = '#000000';

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

	function customSort(a, b) {
		if (a.type === 'text' && b.type !== 'text') {
			return 1; // 'a' is text, 'b' is not text, so 'a' should come after 'b'
		} else if (a.type !== 'text' && b.type === 'text') {
			return -1; // 'b' is text, 'a' is not text, so 'a' should come before 'b'
		} else {
			return 0; // Both are text or both are not text, maintain their relative positions
		}
	}

	async function onUploadPDF(e) {
		const files = e.target.files || (e.dataTransfer && e.dataTransfer.files);
		const file = files[0];
		if (!file || file.type !== 'application/pdf') return;
		selectedPageIndex = -1;
		try {
			await addPDF(file);
			selectedPageIndex = 0;
		} catch (e) {
			console.log(e);
		}
	}
	async function addPDF(file) {
		try {
			async function readAsPDF(file) {
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
				.fill()
				.map((_, i) => pdf.getPage(i + 1));
			// check if past allObjects has something if nothing overwrite to match page lenght
			// TODO: add double check incase page changes
			if (allObjects.every((arr) => arr.length === 0) && pages.every((arr) => arr.length === 0)) {
				// Overwrite allObjects
				allObjects = pages.map(() => []);
				dispatch('dataUpdated', { newData: allObjects });
			}
			pagesScale = Array(numPages).fill(1);
		} catch (e) {
			console.log('Failed to add pdf.');
			throw e;
		}
	}
	//TODO: Image generation disabled for now
	// async function onUploadImage(e) {
	// 	const file = e.target.files[0];
	// 	if (file && selectedPageIndex >= 0) {
	// 		addImage(file);
	// 	}
	// 	e.target.value = null;
	// }
	// async function addImage(file) {
	// 	try {
	// 		// get dataURL to prevent canvas from tainted
	// 		const url = await readAsDataURL(file);
	// 		const img = await readAsImage(url);
	// 		const id = genID();
	// 		const { width, height } = img;
	// 		const object = {
	// 			id,
	// 			type: 'image',
	// 			width,
	// 			height,
	// 			x: 0,
	// 			y: 0,
	// 			payload: img,
	// 			file
	// 		};
	// 		allObjects = allObjects.map((objects, pIndex) =>
	// 			pIndex === selectedPageIndex ? [...objects, object] : objects
	// 		);
	// 	} catch (e) {
	// 		console.log(`Fail to add image.`, e);
	// 	}
	// }
	function onAddTextField() {
		if (selectedPageIndex >= 0) {
			addingDrawing = false;
			addTextField();
		}
	}
	function addTextField() {
		const id = genID();
		const object = {
			id,
			type: 'text',
			size: 16,
			width: 0, // not being used for now
			lineHeight: 1, // for now fixed until text position rework
			fontFamily: currentFont,
			x: 10,
			y: 10,
			lines: ['Text']
		};
		allObjects = allObjects.map((objects, pIndex) =>
			pIndex === selectedPageIndex ? [...objects, object] : objects
		);
		dispatch('dataUpdated', { newData: allObjects });
	}
	function onAddDrawing(isaddingDrawing) {
		if (selectedPageIndex >= 0) {
			addingDrawing = !isaddingDrawing;
		}
	}
	async function addDrawing(originWidth, originHeight, path, scale = 1, brushSize, brushColor) {
		const id = genID();
		const object = {
			id,
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
		allObjects = allObjects.map((objects, pIndex) =>
			pIndex === selectedPageIndex ? [...objects, object] : objects
		);
		allObjects[selectedPageIndex].sort(customSort);
		dispatch('dataUpdated', { newData: allObjects });
	}
	function selectFontFamily(event) {
		const name = event.detail.name;
		fetchFont(name);
		currentFont = name;
	}
	function selectPage(index) {
		selectedPageIndex = index;
	}
	function updateObject(objectId, payload) {
		allObjects = allObjects.map((objects, pIndex) =>
			pIndex == selectedPageIndex
				? objects.map((object) => (object.id === objectId ? { ...object, ...payload } : object))
				: objects
		);
		dispatch('dataUpdated', { newData: allObjects });
	}
	function deleteObject(objectId) {
		allObjects = allObjects.map((objects, pIndex) =>
			pIndex == selectedPageIndex ? objects.filter((object) => object.id !== objectId) : objects
		);
		dispatch('dataUpdated', { newData: allObjects });
	}
	function onMeasure(scale, i) {
		pagesScale[i] = scale;
	}
	// FIXME: Should wait all objects finish their async work
	async function savePDF() {
		if (!pdfFile || saving || !pages.length) return;
		saving = true;
		try {
			await save(pdfFile, allObjects, pdfName, pagesScale);
		} catch (e) {
			console.log(e);
		} finally {
			saving = false;
		}
	}
	let redoobjects = [];

	const handleUndo = () => {
		function removeLatestIDWithRecentTimestamp(objectsArray) {
			// Find the latest timestamp ID
			let latestTimestamp = 0;
			let latestIDIndex = { outer: -1, inner: -1 }; // Initialize with invalid indices

			objectsArray.forEach((objects, outerIndex) => {
				objects.forEach((object, innerIndex) => {
					const idTimestamp = parseInt(object.id);
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
		const modifiedArray = removeLatestIDWithRecentTimestamp(allObjects);
		allObjects = modifiedArray;
		dispatch('dataUpdated', { newData: allObjects });
	};
	const handleRedo = () => {
		if (redoobjects.length > 0) {
			const redoObject = redoobjects.pop(); // Get the last removed object from redoobjects
			const { outer, inner, object } = redoObject;

			// Create a deep copy of allObjects
			const modifiedArray = allObjects.map((innerArray) => innerArray.slice());

			// Restore the removed object to its original position in the modified array
			if (modifiedArray[outer] && modifiedArray[outer].length >= inner) {
				modifiedArray[outer].splice(inner, 0, object);
			} else if (modifiedArray[outer]) {
				modifiedArray[outer].push(object);
			} else {
				modifiedArray[outer] = [object];
			}

			// Update allObjects with the modified array
			allObjects = modifiedArray;
			dispatch('dataUpdated', { newData: allObjects });
		}
	};
</script>

<!-- <svelte:window
	on:dragenter|preventDefault
	on:dragover|preventDefault
	on:drop|preventDefault={onUploadPDF}
/> -->
<div
	class="fixed navbar z-10 top-0 left-0 right-0 rounded-b-lg flex flex-col
    "
>
	<div class="bg-gray-200 border-b border-gray-300">
		<div class="flex flex-row justify-center items-center p-2">
			<!-- <input type="file" name="pdf" id="pdf" on:change={onUploadPDF} class="hidden" /> -->
			<!-- <input type="file" id="image" name="image" class="hidden" on:change={onUploadImage} /> -->
			<!-- <label
				class="whitespace-no-wrap bg-blue-500 hover:bg-blue-700 text-white
      font-bold py-1 px-1 md:px-3 rounded mr-3 cursor-pointer md:mr-4"
				for="pdf"
			>
				<svg
					class="w-5 h-5 text-gray-800 dark:text-white"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 -960 960 960"
					><path
						d="M452-336v-341l-98 98-39-37 164-164 164 164-39 37-98-98v341h-54ZM180-180v-176h54v122h492v-122h54v176H180Z"
					/></svg
				>
			</label> -->
			<div
				class="relative mr-3 flex h-8 bg-gray-400 rounded-sm overflow-hidden
      md:mr-4"
			>
				<!-- <label
				class="flex items-center justify-center h-full w-8 hover:bg-gray-500
        cursor-pointer"
				for="image"
				class:cursor-not-allowed={selectedPageIndex < 0}
				class:bg-gray-500={selectedPageIndex < 0}
			>
				<img src="/icons/image.svg" alt="An icon for adding images" />
			</label> -->
				<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<button
					class="flex items-center justify-center h-full w-8 hover:bg-gray-500"
					on:click={handleUndo}
				>
					<svg
						class="w-6 h-6 text-gray-800 dark:text-white"
						aria-hidden="true"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke="currentColor"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3 9h13a5 5 0 0 1 0 10H7M3 9l4-4M3 9l4 4"
						/>
					</svg>
				</button>
				<button
					class="flex items-center justify-center h-full w-8 hover:bg-gray-500"
					on:click={handleRedo}
				>
					<svg
						class="w-6 h-6 text-gray-800 dark:text-white"
						aria-hidden="true"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke="currentColor"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 9H8a5 5 0 0 0 0 10h9m4-10-4-4m4 4-4 4"
						/>
					</svg>
				</button>

				<button
					class="flex items-center justify-center h-full w-8 hover:bg-gray-500"
					class:cursor-not-allowed={selectedPageIndex < 0}
					class:bg-gray-500={selectedPageIndex < 0}
					on:click={onAddTextField}
				>
					<svg
						class="w-6 h-6 text-gray-800 dark:text-white"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 -960 960 960"
						><path
							d="M466-320v-292H346v-28h268v28H494v292h-28ZM112-112v-148h60v-440h-60v-148h148v60h440v-60h148v148h-60v440h60v148H700v-60H260v60H112Zm148-88h440v-60h60v-440h-60v-60H260v60h-60v440h60v60ZM140-728h92v-92h-92v92Zm588 0h92v-92h-92v92Zm0 588h92v-92h-92v92Zm-588 0h92v-92h-92v92Zm92-588Zm496 0Zm0 496Zm-496 0Z"
						/></svg
					>
				</button>

				<button
					class="flex items-center justify-center h-full w-8 hover:bg-gray-500 {addingDrawing
						? 'bg-gray-700'
						: ''}
        cursor-pointer"
					on:click={() => {
						onAddDrawing(addingDrawing);
					}}
					class:cursor-not-allowed={selectedPageIndex < 0}
					class:bg-gray-500={selectedPageIndex < 0}
				>
					<svg
						class="w-6 h-6 text-gray-800 dark:text-white"
						aria-hidden="true"
						xmlns="http://www.w3.org/2000/svg"
						fill="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							fill-rule="evenodd"
							d="M14 4.2a4.1 4.1 0 0 1 5.8 0 4 4 0 0 1 0 5.7l-1.3 1.3-5.8-5.7L14 4.2Zm-2.7 2.7-5.1 5.2 2.2 2.2 5-5.2-2.1-2.2ZM5 14l-2 5.8c0 .3 0 .7.3 1 .3.3.7.4 1 .2l6-1.9L5 13.8Zm7 4 5-5.2-2.1-2.2-5.1 5.2 2.2 2.1Z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
				<button
					class="flex items-center justify-center h-full w-8 hover:bg-gray-500"
					on:click={() => {
						zoom = zoom + 0.1;
					}}
				>
					<svg
						class="w-6 h-6 text-gray-800 dark:text-white"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 -960 960 960"
						><path
							d="M787-138 535-390q-30 25-73.5 38.5T379-338q-102.292 0-173.146-70.794Q135-479.588 135-581.794T205.794-755q70.794-71 173-71T552-755.146Q623-684.292 623-582q0 42-13.5 83T572-429l253 253-38 38ZM379-392q81 0 135.5-54.5T569-582q0-81-54.5-135.5T379-772q-81 0-135.5 54.5T189-582q0 81 54.5 135.5T379-392Zm-27-86v-78h-78v-54h78v-78h54v78h78v54h-78v78h-54Z"
						/></svg
					>
					<path
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 9H8a5 5 0 0 0 0 10h9m4-10-4-4m4 4-4 4"
					/>
				</button>
				<button
					class="flex items-center justify-center h-full w-8 hover:bg-gray-500"
					on:click={() => {
						if (zoom > 1) {
							zoom = zoom - 0.1;
						}
					}}
				>
					<svg
						class="w-6 h-6 text-gray-800 dark:text-white"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 -960 960 960"
						><path
							d="M787-138 535-390q-30 25-73.5 38.5T379-338q-102.292 0-173.146-70.794Q135-479.588 135-581.794T205.794-755q70.794-71 173-71T552-755.146Q623-684.292 623-582q0 42-13.5 83T572-429l253 253-38 38ZM379-392q81 0 135.5-54.5T569-582q0-81-54.5-135.5T379-772q-81 0-135.5 54.5T189-582q0 81 54.5 135.5T379-392Zm-96-164v-54h192v54H283Z"
						/></svg
					>
					<path
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 9H8a5 5 0 0 0 0 10h9m4-10-4-4m4 4-4 4"
					/>
				</button>
			</div>

			<!-- <div class="justify-center mr-3 md:mr-4 hidden sm:flex">
				<input
					placeholder="Rename PDF"
					type="text"
					class="bg-transparent w-28"
					bind:value={pdfName}
				/>
			</div> -->
			<button
				class="w-20 bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3
md:px-4 mr-3 md:mr-4 rounded"
				on:click={handleDone}
			>
				Done
			</button>
			{#if allowPrinting}
				<button
					on:click={savePDF}
					class="w-20 bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3
      md:px-4 mr-3 md:mr-4 rounded"
					class:cursor-not-allowed={pages.length === 0 || saving || !pdfFile}
					class:bg-blue-700={pages.length === 0 || saving || !pdfFile}
				>
					{saving ? 'Saving' : 'Print'}
				</button>
			{/if}
		</div>
	</div>
	{#if addingDrawing}
		<div transition:fly={{ x: 0, y: -5 }} class="flex flex-row justify-center items-center">
			<div class="bg-gray-200 p-1 px-20 border-b border-gray-300 rounded-b-lg flex flex-row">
				<button
					class="mr-6 font-bold flex flex-col justify-center"
					on:click={() => {
						addingDrawing = false;
					}}
					><svg
						class="w-7 h-7 text-gray-800 dark:text-white"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 -960 960 960"
						><path
							d="m334-296 146-146 146 146 38-38-146-146 146-146-38-38-146 146-146-146-38 38 146 146-146 146 38 38Zm146.174 196q-78.814 0-148.212-29.911-69.399-29.912-120.734-81.188-51.336-51.277-81.282-120.595Q100-401.012 100-479.826q0-79.07 29.97-148.694 29.971-69.623 81.348-121.126 51.378-51.502 120.594-80.928Q401.128-860 479.826-860q79.06 0 148.676 29.391 69.615 29.392 121.13 80.848 51.516 51.457 80.942 121.018Q860-559.181 860-480.091q0 79.091-29.391 148.149-29.392 69.059-80.835 120.496-51.443 51.436-120.987 81.441Q559.244-100 480.174-100ZM480-154q136.513 0 231.256-94.744Q806-343.487 806-480t-94.744-231.256Q616.513-806 480-806t-231.256 94.744Q154-616.513 154-480t94.744 231.256Q343.487-154 480-154Zm0-326Z"
						/></svg
					></button
				>
				<button
					class="px-3 border border-gray-500 bg-gray-400 font-bold"
					on:click={() => {
						brushSize = brushSize > 1 ? brushSize - 1 : 1;
					}}>-</button
				>
				<input
					class="w-8 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
					type="number"
					readonly
					bind:value={brushSize}
				/>
				<button
					class="px-3 border border-gray-500 bg-gray-400 font-bold"
					on:click={() => {
						brushSize++;
					}}>+</button
				>
				<input class="w-8 text-center" type="color" bind:value={brushColor} />
			</div>
		</div>
	{/if}
</div>
<div
	class="flex flex-col {zoom === 1
		? 'items-center'
		: 'items-start'}  py-16 pt-28 bg-gray-100 min-h-screen overflow-x-scroll"
>
	<div class="">
		{#if pages.length}
			<div>
				{#each pages as page, pIndex (page)}
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<div
						class="p-8 scroll-m-14 items-center"
						on:mousedown={() => selectPage(pIndex)}
						on:touchstart={() => selectPage(pIndex)}
					>
						<div class="relative shadow-lg" class:shadow-outline={pIndex === selectedPageIndex}>
							<PDFPage {zoom} on:measure={(e) => onMeasure(e.detail.scale, pIndex)} {page} />
							<div
								class="absolute top-0 left-0 transform origin-top-left"
								style="transform: scale({zoom}); "
							>
								{#each allObjects[pIndex] as object (object.id)}
									{#if object.type === 'image'}
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
										/>
									{:else if object.type === 'text'}
										<Text
											on:update={(e) => updateObject(object.id, e.detail)}
											on:delete={() => deleteObject(object.id)}
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
											on:delete={() => deleteObject(object.id)}
											path={object.path}
											x={object.x}
											y={object.y}
											width={object.width}
											originWidth={object.originWidth}
											originHeight={object.originHeight}
											pageScale={zoom}
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
										let scale = 1;
										addDrawing(originWidth, originHeight, path, scale, brushSize, brushColor);
										addingDrawing = false;
										requestAnimationFrame(() => {
											addingDrawing = true;
										});
									}}
									on:cancel={() => (addingDrawing = false)}
								/>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="w-full flex-grow flex justify-center items-center">
				<span class=" font-bold text-3xl text-gray-500">Loading</span>
			</div>
		{/if}
	</div>
</div>
