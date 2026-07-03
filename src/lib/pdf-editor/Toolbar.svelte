<script>
	import Portal from './Portal.svelte';
	/** @type {{children?: import('svelte').Snippet}} */
	let { children } = $props();
</script>

<Portal>
	<div class="pdf-editor-touch-controls fixed top-20 left-0 right-0 z-20 flex flex-row items-center justify-center">
		{@render children?.()}
	</div>
</Portal>
