<script>
	// @ts-nocheck
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import PDFPage from './PDFPage.svelte';
	import Image from './Image.svelte';
	import Text from './Text.svelte';
	import Drawing from './Drawing.svelte';
	import DrawingCanvas from './DrawingCanvas.svelte';
	import prepareAssets, { fetchFont } from './utils/prepareAssets.js';
	import { readAsArrayBuffer, readAsImage, readAsDataURL } from './utils/asyncReader.js';
	import { ggID } from './utils/helper.js';
	import { save } from './utils/PDF.js';

	import {getDocument} from "pdfjs-dist";
	import "pdfjs-dist/build/pdf.worker.min.mjs";

	const genID = ggID();
	let pdfFile;
	let pdfName = '';
	let pages = [];
	let pagesScale = [];
	let allObjects = [];
	let currentFont = 'Roboto';
	let focusId = null;
	let selectedPageIndex = -1;
	let saving = false;
	let addingDrawing = false;
	let canvasElement;
	// for test purpose
	onMount(async () => {

		try {
			const res = await fetch('/document.pdf');
			const pdfBlob = await res.blob();
			await addPDF(pdfBlob);
			selectedPageIndex = 0;
			setTimeout(() => {
				fetchFont(currentFont);
				prepareAssets();
			}, 5000);
	
		} catch (e) {
			console.log(e);
		}
	});

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
			allObjects = pages.map(() => []);
			pagesScale = Array(numPages).fill(1);
		} catch (e) {
			console.log('Failed to add pdf.');
			throw e;
		}
	}
	async function onUploadImage(e) {
		const file = e.target.files[0];
		if (file && selectedPageIndex >= 0) {
			addImage(file);
		}
		e.target.value = null;
	}
	async function addImage(file) {
		try {
			// get dataURL to prevent canvas from tainted
			const url = await readAsDataURL(file);
			const img = await readAsImage(url);
			const id = genID();
			const { width, height } = img;
			const object = {
				id,
				type: 'image',
				width,
				height,
				x: 0,
				y: 0,
				payload: img,
				file
			};
			allObjects = allObjects.map((objects, pIndex) =>
				pIndex === selectedPageIndex ? [...objects, object] : objects
			);
		} catch (e) {
			console.log(`Fail to add image.`, e);
		}
	}
	function onAddTextField() {
		if (selectedPageIndex >= 0) {
			addTextField();
		}
	}
	function addTextField(text = 'New Text Field') {
		const id = genID();
		fetchFont(currentFont);
		const object = {
			id,
			text,
			type: 'text',
			size: 16,
			width: 0, // recalculate after editing
			lineHeight: 1.4,
			fontFamily: currentFont,
			x: 0,
			y: 0
		};
		allObjects = allObjects.map((objects, pIndex) =>
			pIndex === selectedPageIndex ? [...objects, object] : objects
		);
	}
	function onAddDrawing(isaddingDrawing) {
		if (selectedPageIndex >= 0) {
			addingDrawing = !isaddingDrawing;
		}
	}
	function addDrawing(originWidth, originHeight, path, scale = 1, brushSize) {
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
			brushSize
		};
		console.log(object);
		allObjects = allObjects.map((objects, pIndex) =>
			pIndex === selectedPageIndex ? [...objects, object] : objects
		);
		console.log(allObjects);
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
	}
	function deleteObject(objectId) {
		allObjects = allObjects.map((objects, pIndex) =>
			pIndex == selectedPageIndex ? objects.filter((object) => object.id !== objectId) : objects
		);
	}
	function onMeasure(scale, i) {
		pagesScale[i] = scale;
	}
	// FIXME: Should wait all objects finish their async work
	async function savePDF() {
		if (!pdfFile || saving || !pages.length) return;
		saving = true;
		try {
			const newpdf = await save(pdfFile, allObjects, pdfName, pagesScale);
		} catch (e) {
			console.log(e);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window
	on:dragenter|preventDefault
	on:dragover|preventDefault
	on:drop|preventDefault={onUploadPDF}
/>
<main class="flex flex-col items-center py-16 bg-gray-100 min-h-screen">
	<div
		class="fixed navbar z-10 top-0 left-0 right-0 rounded-b-lg flex justify-center items-center
    bg-gray-200 border-b border-gray-300"
	>
		<input type="file" name="pdf" id="pdf" on:change={onUploadPDF} class="hidden" />
		<input type="file" id="image" name="image" class="hidden" on:change={onUploadImage} />
		<label
			class="whitespace-no-wrap bg-blue-500 hover:bg-blue-700 text-white
      font-bold py-1 px-3 md:px-4 rounded mr-3 cursor-pointer md:mr-4"
			for="pdf"
		>
			Choose PDF
		</label>
		<!-- svelte-ignore a11y-label-has-associated-control -->
		<div
			class="relative mr-3 flex h-8 bg-gray-400 rounded-sm overflow-hidden
      md:mr-4"
		>
			<label
				class="flex items-center justify-center h-full w-8 hover:bg-gray-500
        cursor-pointer"
				for="image"
				class:cursor-not-allowed={selectedPageIndex < 0}
				class:bg-gray-500={selectedPageIndex < 0}
			>
				<img src="/icons/image.svg" alt="An icon for adding images" />
			</label>
			<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<label
				class="flex items-center justify-center h-full w-8 hover:bg-gray-500
        cursor-pointer"
				for="text"
				class:cursor-not-allowed={selectedPageIndex < 0}
				class:bg-gray-500={selectedPageIndex < 0}
				on:click={onAddTextField}
			>
				<img src="/icons/notes.svg" alt="An icon for adding text" />
			</label>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
			<label
				class="flex items-center justify-center h-full w-8 hover:bg-gray-500 {addingDrawing ? 'bg-gray-700' : ''}
        cursor-pointer"
				on:click={()=>{onAddDrawing(addingDrawing)}}
				class:cursor-not-allowed={selectedPageIndex < 0}
				class:bg-gray-500={selectedPageIndex < 0}
			>
				<img src="/icons/gesture.svg" alt="An icon for adding drawing" />
			</label>
		</div>
		<div class="justify-center mr-3 md:mr-4 w-full max-w-xs hidden md:flex">
			<img src="/icons/edit.svg" class="mr-2" alt="a pen, edit pdf name" />
			<input
				placeholder="Rename your PDF here"
				type="text"
				class="flex-grow bg-transparent"
				bind:value={pdfName}
			/>
		</div>
		<button
			on:click={savePDF}
			class="w-20 bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3
      md:px-4 mr-3 md:mr-4 rounded"
			class:cursor-not-allowed={pages.length === 0 || saving || !pdfFile}
			class:bg-blue-700={pages.length === 0 || saving || !pdfFile}
		>
			{saving ? 'Saving' : 'Save'}
		</button>
	</div>

	{#if pages.length}
		<div class="flex justify-center px-5 w-full md:hidden">
			<img src="/icons/edit.svg" class="mr-2" alt="a pen, edit pdf name" />
			<input
				placeholder="Rename your PDF here"
				type="text"
				class="flex-grow bg-transparent"
				bind:value={pdfName}
			/>
		</div>
		<div class="w-full">
			{#each pages as page, pIndex (page)}
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<div
					class="p-5 w-full flex flex-col items-center overflow-hidden"
					on:mousedown={() => selectPage(pIndex)}
					on:touchstart={() => selectPage(pIndex)}
				>
					<div class="relative shadow-lg" class:shadow-outline={pIndex === selectedPageIndex}>
						<PDFPage on:measure={(e) => onMeasure(e.detail.scale, pIndex)} {page} />
						<div
							class="absolute top-0 left-0 transform origin-top-left"
							style="transform: scale({pagesScale[pIndex]}); touch-action: none;"
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
										pageScale={pagesScale[pIndex]}
									/>
								{:else if object.type === 'text'}
									<Text
										on:update={(e) => updateObject(object.id, e.detail)}
										on:delete={() => deleteObject(object.id)}
										on:selectFont={selectFontFamily}
										text={object.text}
										x={object.x}
										y={object.y}
										size={object.size}
										lineHeight={object.lineHeight}
										fontFamily={object.fontFamily}
										pageScale={pagesScale[pIndex]}
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
										pageScale={pagesScale[pIndex]}
										brushSize={object.brushSize}
									/>
								{/if}
							{/each}
						</div>
						{#if addingDrawing}
							<DrawingCanvas
								pageScale={pagesScale[pIndex]}
								{pages}
								{page}
								on:finish={(e) => {
									const { originWidth, originHeight, path } = e.detail;
									console.log(path)
									let scale = 1;
									addDrawing(originWidth, originHeight, path, scale);
									// addingDrawing = false;
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
			<span class=" font-bold text-3xl text-gray-500">Drag something here</span>
		</div>
	{/if}
</main>
