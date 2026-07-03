<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { LucideCheck, LucideLoader2 } from 'lucide-svelte';
	import PDFPage from '../../PDFPage.svelte';
	import Text from '../../Text.svelte';
	import Drawing from '../../Drawing.svelte';
	import Line from '../../Line.svelte';
	import TeacherMark from '../../TeacherMark.svelte';
	import type { RenderQualityMode } from '../../context/pdfEditorContext.svelte';

	interface Props {
		documentId: string;
		currentPage: number;
		minPage: number;
		maxPage: number;
		pageWidth: number;
		pageHeight: number;
		renderQualityMode: RenderQualityMode;
		visibilityRevision?: number;
		visibilityViewport?: { left: number; top: number; right: number; bottom: number } | null;
		currentPageObjects?: any[];
		onClose: () => void;
		onSelectPage: (page: number) => void | Promise<void>;
	}

	let {
		documentId,
		currentPage,
		minPage,
		maxPage,
		pageWidth,
		pageHeight,
		renderQualityMode,
		visibilityRevision = 0,
		visibilityViewport = null,
		currentPageObjects = [],
		onClose,
		onSelectPage
	}: Props = $props();

	let menuElement: HTMLDivElement | undefined = $state();
	let previewList: HTMLDivElement | undefined = $state();
	let pageNumberList: HTMLDivElement | undefined = $state();
	let pendingPage: number | null = $state(null);

	let previewScale = $derived(Math.min(0.2, 112 / pageWidth, 154 / pageHeight));
	let previewWidth = $derived(Math.max(72, Math.round(pageWidth * previewScale)));
	let previewHeight = $derived(Math.max(96, Math.round(pageHeight * previewScale)));

	let previewPages = $derived.by(() => {
		const pages: number[] = [];
		const first = Math.max(minPage, currentPage - 2);
		const last = Math.min(maxPage, currentPage + 2);

		for (let page = first; page <= last; page += 1) {
			pages.push(page);
		}

		return pages;
	});

	let quickPages = $derived.by(() => {
		const pages: number[] = [];

		for (let page = minPage; page <= maxPage; page += 1) {
			pages.push(page);
		}

		return pages;
	});

	async function selectPage(page: number) {
		if (pendingPage !== null) return;

		if (page === currentPage) {
			onClose();
			return;
		}

		pendingPage = page;

		try {
			await onSelectPage(page);
			onClose();
		} finally {
			pendingPage = null;
		}
	}

	function handleDocumentPointerDown(event: PointerEvent) {
		const target = event.target;
		if (target instanceof Element && target.closest('[data-page-preview-toggle]')) return;
		if (target instanceof Node && menuElement?.contains(target)) return;
		onClose();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
	}

	onMount(() => {
		const timeout = window.setTimeout(() => {
			document.addEventListener('pointerdown', handleDocumentPointerDown);
			document.addEventListener('keydown', handleKeydown);
		}, 0);

		return () => {
			window.clearTimeout(timeout);
			document.removeEventListener('pointerdown', handleDocumentPointerDown);
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	$effect(() => {
		if ((!previewList || previewPages.length === 0) && (!pageNumberList || quickPages.length === 0)) {
			return;
		}

		currentPage;

		tick().then(() => {
			const activePreview = previewList?.querySelector<HTMLButtonElement>(
				`[data-preview-page="${currentPage}"]`
			);
			const activeButton = pageNumberList?.querySelector<HTMLButtonElement>(
				`[data-page="${currentPage}"]`
			);

			activePreview?.scrollIntoView({ block: 'nearest', inline: 'center' });
			activeButton?.scrollIntoView({ block: 'center', inline: 'nearest' });
		});
	});
</script>

<div
	bind:this={menuElement}
	class="pdf-editor-touch-controls fixed top-[74px] left-1/2 z-[120] w-[min(94vw,520px)] -translate-x-1/2 rounded-lg border border-amber-200 bg-white shadow-2xl shadow-amber-950/15 max-[520px]:top-[118px]"
	role="dialog"
	aria-label="Page preview navigation"
>
	<div class="border-b border-amber-100 px-3 py-2">
		<div bind:this={previewList} class="flex gap-2 overflow-x-auto pb-1">
			{#each previewPages as page (page)}
				<button
					type="button"
					data-preview-page={page}
					class="group shrink-0 rounded-md border bg-gray-50 p-1.5 text-left transition hover:border-amber-300 hover:bg-amber-50"
					class:border-amber-400={page === currentPage}
					class:border-gray-200={page !== currentPage}
					class:ring-2={page === currentPage}
					class:ring-amber-200={page === currentPage}
					onclick={() => selectPage(page)}
				>
					<div
						class="relative overflow-hidden rounded bg-white shadow-inner"
						style="width: {previewWidth}px; height: {previewHeight}px;"
					>
						<div
							class="absolute top-0 left-0 origin-top-left"
							style="width: {pageWidth}px; height: {pageHeight}px; transform: scale({previewScale});"
						>
							<PDFPage
								{documentId}
								pageIndex={page - 1}
								zoom={previewScale}
								width={pageWidth}
								height={pageHeight}
								renderQualityMode={renderQualityMode}
								{visibilityRevision}
								{visibilityViewport}
							/>
							{#if page === currentPage}
								<div class="absolute top-0 left-0 z-10 h-full w-full">
									{#each currentPageObjects as object (object.id)}
										{#if object.type === 'text'}
											<Text
												viewOnly={true}
												lines={object.lines}
												x={object.x}
												y={object.y}
												size={object.size}
												lineHeight={object.lineHeight}
												fontFamily={object.fontFamily}
												fontColor={object.fontColor}
												pageScale={previewScale}
											/>
										{:else if object.type === 'drawing' || object.type === 'highlight'}
											<Drawing
												{object}
												user={object.owner}
												path={object.path}
												x={object.x}
												y={object.y}
												width={object.width}
												scale={object.scale}
												rotation={object.rotation}
												originWidth={object.originWidth}
												originHeight={object.originHeight}
												brushSize={object.brushSize}
												brushColor={object.brushColor}
												pageScale={previewScale}
											/>
										{:else if object.type === 'line'}
											<Line
												{object}
												user={object.owner}
												x={object.x}
												y={object.y}
												shapeWidth={object.width}
												shapeHeight={object.height}
												strokeColor={object.strokeColor}
												strokeWidth={object.strokeWidth}
												lineType={object.lineType || 'solid'}
												pageScale={previewScale}
											/>
										{:else if object.type === 'teacher-mark'}
											<TeacherMark
												{object}
												x={object.x}
												y={object.y}
												width={object.width}
												height={object.height}
											/>
										{/if}
									{/each}
								</div>
							{/if}
						</div>
					</div>
					<div class="mt-1 flex h-5 items-center justify-center gap-1 text-xs font-medium">
						<span class:font-semibold={page === currentPage} class:text-amber-700={page === currentPage}>
							{page}
						</span>
						{#if pendingPage === page}
							<LucideLoader2 size={12} class="animate-spin text-amber-600" />
						{/if}
					</div>
				</button>
			{/each}
		</div>
	</div>

	<div bind:this={pageNumberList} class="max-h-56 overflow-y-auto p-3">
		<div class="grid grid-cols-5 gap-2 sm:grid-cols-8">
			{#each quickPages as page (page)}
				<button
					type="button"
					data-page={page}
					class="flex h-9 items-center justify-center gap-1 rounded-md border text-sm font-medium transition disabled:cursor-wait"
					class:border-amber-400={page === currentPage}
					class:bg-amber-50={page === currentPage}
					class:text-amber-700={page === currentPage}
					class:border-gray-200={page !== currentPage}
					class:bg-white={page !== currentPage}
					class:text-gray-700={page !== currentPage}
					class:hover:border-amber-300={page !== currentPage}
					class:hover:bg-amber-50={page !== currentPage}
					disabled={pendingPage !== null}
					onclick={() => selectPage(page)}
				>
					{#if page === currentPage}
						<LucideCheck size={13} />
					{/if}
					<span>{page}</span>
					{#if pendingPage === page}
						<LucideLoader2 size={13} class="animate-spin" />
					{/if}
				</button>
			{/each}
		</div>
	</div>
</div>

