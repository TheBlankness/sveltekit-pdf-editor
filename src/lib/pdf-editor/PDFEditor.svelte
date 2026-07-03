<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import PDFEditorCore from './PDFEditorCore.svelte';
	import { defaultPdfEditorPlugins, type PdfEditorPlugin } from './plugins';
	import type { SaveState } from './context/pdfEditorContext.svelte';

	type SavingState = 'saving' | 'saved' | 'fail';
	type DisabledPageRange = { from_page: number; to_page: number };

	export let pageAnnotations: any[][] = [];
	export let pdfBlob: Blob | File | ArrayBuffer | Uint8Array | null = null;
	export let allowPrinting = true;
	export let ownerId = 'user1';
	export let user: string | undefined = undefined;
	export let fileName = '';
	export let savingState: SavingState = 'saved';
	export let disabledPages: DisabledPageRange[] = [];
	export let disabled_pages: DisabledPageRange[] | undefined = undefined;
	export let disabled = false;
	export let currentPage = 1;
	export let saveState: SaveState | undefined = undefined;
	export let autoSaveEnabled: boolean | undefined = undefined;
	export let plugins: PdfEditorPlugin[] = defaultPdfEditorPlugins;
	export let allowTeacherMark = false;
	export let teacherMarkName = 'User';
	export let homework_info: any = undefined;
	export let isPageLoading = false;
	export let wasmUrl = '/vendor/embedpdf/pdfium.wasm?v=2.14.4';
	export let handleSave: ((annotations: any[][]) => void | Promise<void>) | undefined = undefined;
	export let handleComplete: ((annotations: any[][]) => void | Promise<void>) | undefined = undefined;
	export let onSaveAnnotations: ((annotations: any[][]) => void | Promise<void>) | undefined = undefined;
	export let onAnnotationChange: ((annotations: any[][]) => void) | undefined = undefined;
	export let retryFailedSave: (() => void | Promise<void>) | undefined = undefined;

	const dispatch = createEventDispatcher();

	let internalAnnotations: any[][] = [];
	let allObjects: any[] = [];
	let activePage = Math.max(1, Number(currentPage || 1));
	let lastAnnotationsRef = pageAnnotations;
	let lastPdfBlobRef = pdfBlob;
	let initialized = false;
	let adjacentPageAnnotations: Record<number, any[]> = {};
	let coreSaveState: SaveState = normalizeSavingState(savingState);
	let effectiveSaveState: SaveState = coreSaveState;
	let effectiveUser = ownerId;
	let effectiveDisabledPages: DisabledPageRange[] = [];
	let pdfInput: typeof pdfBlob = pdfBlob;

	function cloneValue<T>(value: T): T {
		if (value == null) return value;
		if (typeof structuredClone === 'function') {
			try {
				return structuredClone(value);
			} catch {
				// Fall through for values that structuredClone cannot handle.
			}
		}

		return JSON.parse(JSON.stringify(value));
	}

	function cloneObjects(objects: any[] | undefined) {
		return Array.isArray(objects) ? objects.map((object) => cloneValue(object)) : [];
	}

	function normalizeAnnotations(value: any, minPages = 0) {
		const pages = Array.isArray(value)
			? value.map((objects) => cloneObjects(Array.isArray(objects) ? objects : []))
			: [];

		while (pages.length < minPages) pages.push([]);
		return pages;
	}

	function normalizeSavingState(state: SavingState): SaveState {
		if (state === 'saving') return { status: 'saving', hasUnsavedChanges: true };
		if (state === 'fail') return { status: 'fail', hasUnsavedChanges: true };
		return { status: 'saved', hasUnsavedChanges: false };
	}

	function makePdfInput(value: typeof pdfBlob) {
		if (!value) return value;
		if (typeof File !== 'undefined' && value instanceof File) return value;
		if (typeof Blob !== 'undefined' && value instanceof Blob && typeof File !== 'undefined') {
			return new File([value], fileName || 'document.pdf', {
				type: value.type || 'application/pdf'
			});
		}
		return value;
	}

	function ensurePage(page: number) {
		while (internalAnnotations.length < page) internalAnnotations.push([]);
	}

	function saveActivePage(objects = allObjects, page = activePage) {
		ensurePage(page);
		internalAnnotations[page - 1] = cloneObjects(objects);
	}

	function rebuildAdjacentAnnotations(activeObjects = allObjects) {
		const map: Record<number, any[]> = {};
		internalAnnotations.forEach((objects, index) => {
			const page = index + 1;
			map[page] = page === activePage ? activeObjects : objects;
		});
		adjacentPageAnnotations = map;
	}

	function getAnnotationSnapshot(objects = allObjects, page = activePage) {
		const snapshot = normalizeAnnotations(internalAnnotations, page);
		snapshot[page - 1] = cloneObjects(objects);
		return snapshot;
	}

	function publishAnnotations(objects = allObjects, page = activePage) {
		const snapshot = getAnnotationSnapshot(objects, page);
		pageAnnotations = snapshot;
		lastAnnotationsRef = snapshot;
		dispatch('dataUpdated', { newData: snapshot, annotations: snapshot, currentPage: activePage });
		dispatch('annotationsChange', { annotations: snapshot, currentPage: activePage });
		onAnnotationChange?.(snapshot);
		return snapshot;
	}

	function loadPage(page: number) {
		activePage = Math.max(1, Number(page || 1));
		currentPage = activePage;
		ensurePage(activePage);
		allObjects = cloneObjects(internalAnnotations[activePage - 1]);
		rebuildAdjacentAnnotations();
	}

	function hydrateFromProps() {
		activePage = Math.max(1, Number(currentPage || 1));
		internalAnnotations = normalizeAnnotations(pageAnnotations, activePage);
		loadPage(activePage);
	}

	function handleCoreAnnotationChange(currentObjects = allObjects) {
		saveActivePage(currentObjects);
		coreSaveState = { status: 'idle', hasUnsavedChanges: true };
		rebuildAdjacentAnnotations(currentObjects);
		publishAnnotations(currentObjects);
	}

	async function handleCoreSave() {
		saveActivePage();
		coreSaveState = { status: 'saving', hasUnsavedChanges: true };
		const snapshot = publishAnnotations();

		try {
			await Promise.resolve(handleSave?.(snapshot));
			await Promise.resolve(onSaveAnnotations?.(snapshot));
			coreSaveState = { status: 'saved', hasUnsavedChanges: false };
			dispatch('save', { annotations: snapshot, currentPage: activePage });
		} catch (error) {
			coreSaveState = { status: 'fail', hasUnsavedChanges: true };
			throw error;
		}
	}

	async function handleCoreComplete() {
		await handleCoreSave();
		const snapshot = getAnnotationSnapshot();
		await Promise.resolve(handleComplete?.(snapshot));
		dispatch('done', { newData: snapshot, annotations: snapshot, currentPage: activePage });
	}

	function handleCorePageChange(page: number) {
		saveActivePage();
		publishAnnotations();
		loadPage(page);
		dispatch('pageChange', { page, annotations: cloneObjects(internalAnnotations[page - 1]) });
	}

	async function handleCoreRetry() {
		if (retryFailedSave) {
			await Promise.resolve(retryFailedSave());
			return;
		}

		await handleCoreSave();
	}

	function getAllPageAnnotations(currentObjects: any[], page: number) {
		saveActivePage(currentObjects, page);
		return getAnnotationSnapshot(currentObjects, page);
	}

	$: if (!initialized) {
		initialized = true;
		hydrateFromProps();
	}

	$: if (pdfBlob !== lastPdfBlobRef) {
		lastPdfBlobRef = pdfBlob;
		lastAnnotationsRef = pageAnnotations;
		hydrateFromProps();
	}

	$: if (pageAnnotations !== lastAnnotationsRef) {
		lastAnnotationsRef = pageAnnotations;
		internalAnnotations = normalizeAnnotations(pageAnnotations, activePage);
		loadPage(activePage);
	}

	$: effectiveUser = user || ownerId || 'user1';
	$: effectiveDisabledPages = disabled_pages || disabledPages || [];
	$: coreSaveState = saveState ?? normalizeSavingState(savingState);
	$: effectiveSaveState = saveState ?? coreSaveState;
	$: pdfInput = makePdfInput(pdfBlob);
	$: {
		internalAnnotations;
		allObjects;
		activePage;
		rebuildAdjacentAnnotations();
	}
</script>

{#if pdfInput}
	<PDFEditorCore
		bind:allObjects
		currentPage={activePage}
		pdfBlob={pdfInput}
		{allowPrinting}
		user={effectiveUser}
		saveState={effectiveSaveState}
		disabled_pages={effectiveDisabledPages}
		{disabled}
		homework_info={homework_info}
		{isPageLoading}
		{autoSaveEnabled}
		{allowTeacherMark}
		{teacherMarkName}
		{plugins}
		{adjacentPageAnnotations}
		onAnnotationChange={handleCoreAnnotationChange}
		handleSave={handleCoreSave}
		handleComplete={handleCoreComplete}
		retryFailedSave={handleCoreRetry}
		handlePageChange={handleCorePageChange}
		{getAllPageAnnotations}
	/>
{:else}
	<slot />
{/if}



