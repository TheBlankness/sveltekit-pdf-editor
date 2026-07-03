<script>
	/** @type {{children?: import('svelte').Snippet}} */
	let { children } = $props();
	let portal = $state();

	$effect(() => {
		if (!portal) return;

		document.body.appendChild(portal);

		return () => {
			portal.remove();
		};
	});
</script>

<div bind:this={portal}>
	{@render children?.()}
</div>
