<script>
	import Portal from './Portal.svelte';
</script>

<Portal
	><div class="flex justify-center">
		<div class="fixed z-10 top-12 h-12">
			<slot />
		</div>
	</div>
</Portal>
