<script lang="ts">
	let {
		document,
		currentPage,
		onSync
	}: {
		document: any;
		currentPage: number;
		onSync: (document: any) => void;
	} = $props();

	$effect(() => {
		currentPage;
		onSync(document);
	});
</script>
