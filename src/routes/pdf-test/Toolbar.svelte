<script>
	import Portal from './Portal.svelte';
</script>

<Portal>
	<div class="fixed z-10 top-16 left-0 right-0 h-12">
		<slot />
	</div>
</Portal>
