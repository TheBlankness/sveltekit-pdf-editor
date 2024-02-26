<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { PageData } from './$types';
	import PDFEDitor from '$lib/PDFEditor.svelte';
	export let data: PageData;

	let allObjects = JSON.parse(localStorage.getItem('allObjects') ?? '[]');

	function handleDataUpdate(event) {
		localStorage.setItem('allObjects', JSON?.stringify(event.detail.newData));
	}

	function handleLocalStorageChange(event) {
		if (event.key === 'allObjects') {
			allObjects = JSON.parse(event.newValue);
		}
	}

	// Add event listener to listen for changes in localStorage
	window.addEventListener('storage', handleLocalStorageChange);

	// Cleanup function to remove the event listener when the component is destroyed
	onDestroy(() => {
		window.removeEventListener('storage', handleLocalStorageChange);
	});

	let pdfBlob;

	onMount(async () => {
		const res = await fetch('/document.pdf');
		pdfBlob = await res.blob();
	});
</script>

{#if pdfBlob}
	<PDFEDitor
		{allObjects}
		on:dataUpdated={handleDataUpdate}
		{pdfBlob}
		on:done={() => {
			alert('done');
		}}
	/>
{/if}
