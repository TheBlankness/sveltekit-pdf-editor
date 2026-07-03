<script lang="ts">
	import { onMount } from 'svelte';
	import {
		LucideMenu,
		LucideX,
		LucideMove3D,
		LucideMonitor,
		LucideMaximize2,
		LucideCloudUpload,
		LucideMoveVertical,
		LucidePanelLeft,
		LucidePanelRight,
		LucideBrush,
		LucideGauge,
		LucideChevronDown,
		LucideSettings,
		LucideRefreshCw
	} from 'lucide-svelte';
	import {
		getPDFEditorContext,
		type RenderQualityMode,
		type ToolbarPosition
	} from '../../context/pdfEditorContext.svelte';
	import { requestPdfEditorRefreshBypass } from '../../utils/refreshNavigationBypass';

	interface Props {
		homework_info?: any;
		allowPrinting: boolean;
		pdfFile: File | undefined;
		saving: boolean;
		pages: any[];
		isFullscreen: boolean;
		stroke_visibility: string;
		zoomEnabled: boolean;
		doubleTapZoomEnabled: boolean;
		autoSaveEnabled: boolean;
		visibleObjectRenderingEnabled: boolean;
		minimapAnnotationsEnabled: boolean;
		adjacentPagePreviewEnabled: boolean;
		adjacentPagePreviewCount: number;
		adjacentPagePreviewLayout: 'row' | 'column';
		renderQualityMode: RenderQualityMode;
		isPageDisabled: boolean;
		onViewHomeworkInfo?: () => void;
		onPrint?: () => void;
		onToggleFullscreen: () => void;
		onStrokeVisibilityChange: (value: string) => void;
		onToggleZoom: () => void;
		onToggleDoubleTapZoom: () => void;
		onToggleAutoSave: () => void;
		onToggleVisibleObjectRendering: () => void;
		onToggleMinimapAnnotations: () => void;
		onToggleAdjacentPagePreview: () => void;
		onAdjacentPagePreviewCountChange: (value: number) => void;
		onAdjacentPagePreviewLayoutChange: (value: 'row' | 'column') => void;
		onRenderQualityModeChange: (mode: RenderQualityMode) => void;
		onSave: () => void | Promise<void>;
	}

	let {
		homework_info,
		allowPrinting,
		pdfFile,
		saving,
		pages,
		isFullscreen,
		stroke_visibility,
		zoomEnabled,
		doubleTapZoomEnabled,
		autoSaveEnabled,
		visibleObjectRenderingEnabled,
		minimapAnnotationsEnabled,
		adjacentPagePreviewEnabled,
		adjacentPagePreviewCount,
		adjacentPagePreviewLayout,
		renderQualityMode,
		isPageDisabled,
		onViewHomeworkInfo,
		onPrint,
		onToggleFullscreen,
		onStrokeVisibilityChange,
		onToggleZoom,
		onToggleDoubleTapZoom,
		onToggleAutoSave,
		onToggleVisibleObjectRendering,
		onToggleMinimapAnnotations,
		onToggleAdjacentPagePreview,
		onAdjacentPagePreviewCountChange,
		onAdjacentPagePreviewLayoutChange,
		onRenderQualityModeChange,
		onSave
	}: Props = $props();

	const ctx = getPDFEditorContext();
	let isMenuOpen = $state(false);
	let isRefreshingPage = $state(false);
	let sidePageSettingsOpen = $state(true);
	let settingsModal: HTMLDialogElement | undefined = $state();
	const SAVE_WAIT_TIMEOUT_MS = 30000;
	const SAVE_WAIT_POLL_MS = 100;
	const refreshButtonDisabled = $derived(
		saving || isRefreshingPage || ctx.state.saveState.status === 'saving'
	);
	const refreshButtonLabel = $derived(
		saving || isRefreshingPage || ctx.state.saveState.status === 'saving'
			? 'Saving...'
			: 'Refresh page'
	);

	// Load settings from localStorage on mount
	onMount(() => {
		const savedZoomEnabled = localStorage.getItem('pdf-editor-zoom-enabled');
		const savedDoubleTapZoom = localStorage.getItem('pdf-editor-doubletap-zoom-enabled');
		const savedAutoSave = localStorage.getItem('pdf-editor-auto-save-enabled');
		const savedRenderQualityMode = localStorage.getItem('pdf-editor-render-quality-mode');
		const savedAdaptiveRender = localStorage.getItem('pdf-editor-adaptive-render-enabled');
		const savedToolbarPosition = localStorage.getItem('pdf-editor-toolbar-position');
		const savedRememberDrawingSettings = localStorage.getItem(
			'pdf-editor-remember-drawing-settings'
		);
		const savedDrawingBrushSize = localStorage.getItem('pdf-editor-drawing-brush-size');
		const savedDrawingBrushColor = localStorage.getItem('pdf-editor-drawing-brush-color');

		if (savedZoomEnabled !== null) {
			ctx.state.zoomEnabled = savedZoomEnabled === 'true';
		}
		if (savedDoubleTapZoom !== null) {
			ctx.state.doubleTapZoomEnabled = savedDoubleTapZoom === 'true';
		}
		if (savedAutoSave !== null) {
			ctx.state.autoSaveEnabled = savedAutoSave === 'true';
		}
		if (isRenderQualityMode(savedRenderQualityMode)) {
			ctx.state.renderQualityMode = savedRenderQualityMode;
		} else if (savedAdaptiveRender !== null) {
			ctx.state.renderQualityMode = savedAdaptiveRender === 'true' ? 'default' : 'sharp';
		}
		if (isToolbarPosition(savedToolbarPosition)) {
			ctx.state.toolbarPosition = savedToolbarPosition;
		}
		if (savedRememberDrawingSettings !== null) {
			ctx.state.rememberDrawingSettings = savedRememberDrawingSettings === 'true';
		}
		if (ctx.state.rememberDrawingSettings) {
			const parsedBrushSize = parseFloat(savedDrawingBrushSize || '');
			if (!Number.isNaN(parsedBrushSize)) {
				ctx.state.brushSize = clampDrawingBrushSize(parsedBrushSize);
			}
			if (isValidColor(savedDrawingBrushColor)) {
				ctx.state.brushColor = savedDrawingBrushColor;
			}
		}
	});

	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
	}

	function closeMenu() {
		isMenuOpen = false;
	}

	function openSettingsModal() {
		closeMenu();
		if (settingsModal && !settingsModal.open) {
			settingsModal.showModal();
		}
	}

	function closeSettingsModal() {
		settingsModal?.close();
	}

	function wait(milliseconds: number) {
		return new Promise((resolve) => setTimeout(resolve, milliseconds));
	}

	async function waitForAnnotationSaveToSettle() {
		const startedAt = Date.now();

		while (ctx.state.saveState.status === 'saving') {
			if (Date.now() - startedAt > SAVE_WAIT_TIMEOUT_MS) {
				throw new Error('Timed out waiting for annotations to save before refresh.');
			}

			await wait(SAVE_WAIT_POLL_MS);
		}
	}

	async function saveUnsavedChangesBeforeRefresh() {
		await waitForAnnotationSaveToSettle();

		if (!ctx.state.saveState.hasUnsavedChanges && ctx.state.saveState.status !== 'fail') {
			return true;
		}

		if (!pdfFile) {
			return false;
		}

		await onSave();
		await waitForAnnotationSaveToSettle();

		return !ctx.state.saveState.hasUnsavedChanges && ctx.state.saveState.status !== 'fail';
	}

	async function handleRefreshPage() {
		if (isRefreshingPage) return;

		closeMenu();
		isRefreshingPage = true;

		try {
			const canRefresh = await saveUnsavedChangesBeforeRefresh();
			if (!canRefresh) return;

			requestPdfEditorRefreshBypass();
			window.location.reload();
		} catch (error) {
			console.error('Failed to save before refreshing the PDF editor:', error);
		} finally {
			isRefreshingPage = false;
		}
	}

	function stopTouchPropagation(node: HTMLElement) {
		const stop = (event: TouchEvent) => event.stopPropagation();
		const events = ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const;

		for (const eventName of events) {
			node.addEventListener(eventName, stop, { passive: true });
		}

		return {
			destroy() {
				for (const eventName of events) {
					node.removeEventListener(eventName, stop);
				}
			}
		};
	}

	function handleToggleZoom() {
		onToggleZoom();
		// Read the updated value directly from context state after toggle
		localStorage.setItem('pdf-editor-zoom-enabled', String(ctx.state.zoomEnabled));
	}

	function handleToggleDoubleTapZoom() {
		onToggleDoubleTapZoom();
		// Read the updated value directly from context state after toggle
		localStorage.setItem('pdf-editor-doubletap-zoom-enabled', String(ctx.state.doubleTapZoomEnabled));
	}

	function handleToggleAutoSave() {
		onToggleAutoSave();
		// Read the updated value directly from context state after toggle
		localStorage.setItem('pdf-editor-auto-save-enabled', String(ctx.state.autoSaveEnabled));
	}

	function isRenderQualityMode(value: string | null): value is RenderQualityMode {
		return value === 'performance' || value === 'default' || value === 'sharp';
	}

	function isToolbarPosition(value: string | null): value is ToolbarPosition {
		return value === 'bottom' || value === 'left' || value === 'right';
	}

	function handleRenderQualityModeChange(mode: RenderQualityMode) {
		onRenderQualityModeChange(mode);
		localStorage.setItem('pdf-editor-render-quality-mode', mode);
	}

	function handleToolbarPositionChange(position: ToolbarPosition) {
		ctx.state.toolbarPosition = position;
		localStorage.setItem('pdf-editor-toolbar-position', ctx.state.toolbarPosition);
	}

	function clampDrawingBrushSize(size: number) {
		return Math.min(13, Math.max(0.1, size));
	}

	function isValidColor(value: string | null): value is string {
		return !!value && /^#[0-9a-fA-F]{6}$/.test(value);
	}

	function handleToggleRememberDrawingSettings() {
		ctx.state.rememberDrawingSettings = !ctx.state.rememberDrawingSettings;
		localStorage.setItem(
			'pdf-editor-remember-drawing-settings',
			String(ctx.state.rememberDrawingSettings)
		);

		if (ctx.state.rememberDrawingSettings) {
			localStorage.setItem('pdf-editor-drawing-brush-size', String(ctx.state.brushSize));
			localStorage.setItem('pdf-editor-drawing-brush-color', ctx.state.brushColor);
		} else {
			localStorage.removeItem('pdf-editor-drawing-brush-size');
			localStorage.removeItem('pdf-editor-drawing-brush-color');
		}
	}

	const strokeVisibilityOptions = [
		{ value: 'all', label: 'All Notes', icon: '👁️', description: 'Show all annotations' },
		{ value: 'self', label: 'My Notes', icon: '📝', description: 'Only show my annotations' },
		{ value: 'others', label: 'Others', icon: '👥', description: 'Only show others annotations' }
	];
	const renderQualityModes: Array<{
		value: RenderQualityMode;
		label: string;
		description: string;
	}> = [
		{
			value: 'performance',
			label: 'Low',
			description: 'For slower devices. The PDF may look softer while moving, but panning should feel lighter.'
		},
		{
			value: 'default',
			label: 'Default',
			description: 'Recommended. Keeps panning smooth without making the PDF noticeably blurry.'
		},
		{
			value: 'sharp',
			label: 'Sharp',
			description:
				'Prioritizes PDF detail while keeping render size within a safe limit for the device.'
		}
	];
	const toolbarPositionOptions: Array<{ value: ToolbarPosition; label: string }> = [
		{ value: 'left', label: 'Left' },
		{ value: 'bottom', label: 'Bottom' },
		{ value: 'right', label: 'Right' }
	];
	const selectedRenderQualityDescription = $derived(
		renderQualityModes.find((mode) => mode.value === renderQualityMode)?.description ||
			renderQualityModes[1].description
	);
</script>

<!-- Menu Button -->
<div class="pdf-editor-touch-controls relative">
	<button
		onclick={toggleMenu}
		class="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-700 shadow-md transition-all hover:bg-gray-50 active:scale-95"
		title="Menu"
	>
		{#if isMenuOpen}
			<LucideX size={20} />
		{:else}
			<LucideMenu size={20} />
		{/if}
	</button>

	<!-- Dropdown Menu -->
	{#if isMenuOpen}
		<!-- Backdrop -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-60"
			onclick={closeMenu}
		></div>

		<!-- Menu Panel -->
		<div
			class="menu-panel absolute left-0 top-12 z-70 w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-xl sm:w-72"
			use:stopTouchPropagation
		>
			<!-- Settings Section -->
			<div class="border-b border-gray-100 p-3">
				<h3 class="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Settings</h3>

				<!-- Toggle Options Grid -->
				<div class="space-y-2">
					<!-- Fullscreen Toggle -->
					<button
						onclick={() => {
							onToggleFullscreen();
							closeMenu();
						}}
						class="flex w-full items-center gap-3 rounded-lg bg-amber-50 px-3 py-2.5 text-left text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
					>
						<div class="flex h-8 w-8 items-center justify-center rounded-md bg-white shadow-sm">
							<LucideMaximize2 size={16} class="text-amber-600" />
						</div>
						<span>{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
					</button>

					<button
						type="button"
						onclick={openSettingsModal}
						class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
					>
						<div class="flex h-8 w-8 items-center justify-center rounded-md bg-gray-50 shadow-sm">
							<LucideSettings size={16} class="text-gray-600" />
						</div>
						<div>
							<div>More Settings</div>
							<div class="text-xs font-normal text-gray-500">
								Zoom, performance, toolbar and pen options
							</div>
						</div>
					</button>

					<div class="rounded-md bg-rose-50 px-3 py-2 text-xs leading-snug text-rose-700">
						<p>
							Save your work first. If the editor feels slow, stuck, or laggy, press Refresh.
						</p>
						<button
							type="button"
							onclick={handleRefreshPage}
							disabled={refreshButtonDisabled}
							class="mt-2 inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<LucideRefreshCw
								size={13}
								class={saving || isRefreshingPage || ctx.state.saveState.status === 'saving'
									? 'animate-spin'
									: ''}
							/>
							<span>{refreshButtonLabel}</span>
						</button>
					</div>
				</div>
			</div>

			<!-- Stroke Visibility Section -->
			<div class="border-b border-gray-100 p-3">
				<h3 class="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Visibility</h3>
				<div class="space-y-1">
					{#each strokeVisibilityOptions as option}
						<button
							onclick={() => {
								onStrokeVisibilityChange(option.value);
							}}
							class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all duration-200"
							class:bg-indigo-50={stroke_visibility === option.value}
							class:hover:bg-indigo-100={stroke_visibility === option.value}
							class:text-indigo-900={stroke_visibility === option.value}
							class:bg-transparent={stroke_visibility !== option.value}
							class:hover:bg-gray-50={stroke_visibility !== option.value}
							class:text-gray-700={stroke_visibility !== option.value}
						>
							<div class="flex h-8 w-8 items-center justify-center rounded-md bg-white shadow-sm">
								<span class="text-base">{option.icon}</span>
							</div>
							<div class="flex-1">
								<div class="text-sm font-medium">{option.label}</div>
								<div class="text-xs text-gray-500">{option.description}</div>
							</div>
							{#if stroke_visibility === option.value}
								<div class="h-2 w-2 rounded-full bg-indigo-600"></div>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			{#if homework_info || allowPrinting}
			<!-- Actions Section -->
			<div class="p-3">
				<h3 class="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Actions</h3>
				<div class="space-y-1">
					<!-- Homework Info -->
					{#if homework_info}
						<button
							onclick={() => {
								onViewHomeworkInfo?.();
								closeMenu();
							}}
							class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50"
						>
							<div class="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 shadow-sm">
								<span class="text-base">📋</span>
							</div>
							<span>Homework Info</span>
						</button>
					{/if}

					<!-- Print Option -->
					{#if allowPrinting}
						<button
							onclick={() => {
								onPrint?.();
								closeMenu();
							}}
							disabled={pages.length === 0 || saving || !pdfFile}
							class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<div class="flex h-8 w-8 items-center justify-center rounded-md bg-white shadow-sm">
								<span class="text-base">🖨️</span>
							</div>
							<span>{saving ? 'Saving...' : 'Print'}</span>
						</button>
					{/if}
				</div>
			</div>
			{/if}
		</div>
	{/if}
</div>

<dialog
	bind:this={settingsModal}
	class="pdf-editor-touch-controls modal modal-bottom sm:modal-middle"
	aria-labelledby="pdf-editor-settings-title"
>
	<div
		class="settings-modal-box modal-box flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white p-0 shadow-2xl"
		use:stopTouchPropagation
	>
		<div class="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-4 sm:px-5">
			<div>
				<h2 id="pdf-editor-settings-title" class="text-lg font-semibold text-gray-900">
					Editor Settings
				</h2>
				<p class="mt-1 text-sm leading-snug text-gray-500">
					Control saving, touch behavior, performance, page previews and drawing preferences.
				</p>
			</div>
			<button
				type="button"
				onclick={closeSettingsModal}
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
				aria-label="Close editor settings"
			>
				<LucideX size={18} />
			</button>
		</div>

		<div class="settings-modal-content min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
			<section class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-3 flex items-center gap-2">
					<LucideCloudUpload size={18} class="text-emerald-600" />
					<h3 class="text-sm font-semibold text-gray-900">Saving</h3>
				</div>
				<button
					type="button"
					onclick={handleToggleAutoSave}
					aria-pressed={autoSaveEnabled}
					class="flex w-full items-center justify-between gap-4 rounded-lg p-3 text-left transition-colors"
					class:bg-emerald-50={autoSaveEnabled}
					class:hover:bg-emerald-100={autoSaveEnabled}
					class:bg-gray-50={!autoSaveEnabled}
					class:hover:bg-gray-100={!autoSaveEnabled}
				>
					<div>
						<div
							class="text-sm font-medium"
							class:text-emerald-900={autoSaveEnabled}
							class:text-gray-800={!autoSaveEnabled}
						>
							Auto Save
						</div>
						<p class="mt-1 text-xs leading-snug text-gray-500">
							Saves changes in the background after edits. Turn this off when you want to control
							exactly when the PDF uploads.
						</p>
					</div>
					<div class="relative h-6 w-11 shrink-0">
						<div
							class="absolute inset-0 rounded-full transition-colors duration-200"
							class:bg-emerald-600={autoSaveEnabled}
							class:bg-gray-300={!autoSaveEnabled}
						></div>
						<div
							class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
							class:translate-x-5={autoSaveEnabled}
							class:translate-x-0.5={!autoSaveEnabled}
						></div>
					</div>
				</button>
			</section>

			<section class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-3 flex items-center gap-2">
					<LucideMove3D size={18} class="text-indigo-600" />
					<h3 class="text-sm font-semibold text-gray-900">Touch And Zoom</h3>
				</div>
				<div class="grid gap-3 md:grid-cols-2">
					<button
						type="button"
						onclick={handleToggleZoom}
						disabled={isPageDisabled}
						aria-pressed={zoomEnabled}
						class="flex items-center justify-between gap-4 rounded-lg p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
						class:bg-indigo-50={zoomEnabled}
						class:hover:bg-indigo-100={zoomEnabled}
						class:bg-gray-50={!zoomEnabled}
						class:hover:bg-gray-100={!zoomEnabled}
					>
						<div>
							<div
								class="text-sm font-medium"
								class:text-indigo-900={zoomEnabled}
								class:text-gray-800={!zoomEnabled}
							>
								Pinch Zoom
							</div>
							<p class="mt-1 text-xs leading-snug text-gray-500">
								Allows two-finger zooming and panning on touch devices. Disable it if it gets in
								the way while drawing.
							</p>
						</div>
						<div class="relative h-6 w-11 shrink-0">
							<div
								class="absolute inset-0 rounded-full transition-colors duration-200"
								class:bg-indigo-600={zoomEnabled}
								class:bg-gray-300={!zoomEnabled}
							></div>
							<div
								class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
								class:translate-x-5={zoomEnabled}
								class:translate-x-0.5={!zoomEnabled}
							></div>
						</div>
					</button>

					<button
						type="button"
						onclick={handleToggleDoubleTapZoom}
						disabled={isPageDisabled}
						aria-pressed={doubleTapZoomEnabled}
						class="flex items-center justify-between gap-4 rounded-lg p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
						class:bg-indigo-50={doubleTapZoomEnabled}
						class:hover:bg-indigo-100={doubleTapZoomEnabled}
						class:bg-gray-50={!doubleTapZoomEnabled}
						class:hover:bg-gray-100={!doubleTapZoomEnabled}
					>
						<div>
							<div
								class="text-sm font-medium"
								class:text-indigo-900={doubleTapZoomEnabled}
								class:text-gray-800={!doubleTapZoomEnabled}
							>
								Double Tap Zoom
							</div>
							<p class="mt-1 text-xs leading-snug text-gray-500">
								Zooms in or out after a quick double tap. This only applies while using hand mode.
							</p>
						</div>
						<div class="relative h-6 w-11 shrink-0">
							<div
								class="absolute inset-0 rounded-full transition-colors duration-200"
								class:bg-indigo-600={doubleTapZoomEnabled}
								class:bg-gray-300={!doubleTapZoomEnabled}
							></div>
							<div
								class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
								class:translate-x-5={doubleTapZoomEnabled}
								class:translate-x-0.5={!doubleTapZoomEnabled}
							></div>
						</div>
					</button>
				</div>
			</section>

			<section class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-3 flex items-center gap-2">
					<LucideGauge size={18} class="text-teal-600" />
					<h3 class="text-sm font-semibold text-gray-900">Performance And Quality</h3>
				</div>
				<div class="space-y-3">
					<button
						type="button"
						onclick={onToggleVisibleObjectRendering}
						aria-pressed={visibleObjectRenderingEnabled}
						class="flex w-full items-center justify-between gap-4 rounded-lg p-3 text-left transition-colors"
						class:bg-teal-50={visibleObjectRenderingEnabled}
						class:hover:bg-teal-100={visibleObjectRenderingEnabled}
						class:bg-gray-50={!visibleObjectRenderingEnabled}
						class:hover:bg-gray-100={!visibleObjectRenderingEnabled}
					>
						<div>
							<div
								class="text-sm font-medium"
								class:text-teal-900={visibleObjectRenderingEnabled}
								class:text-gray-800={!visibleObjectRenderingEnabled}
							>
								Smart Rendering
							</div>
							<p class="mt-1 text-xs leading-snug text-gray-500">
								Draws only the visible annotation objects while you move around the PDF. This can
								make large homework files feel lighter on slower devices.
							</p>
						</div>
						<div class="relative h-6 w-11 shrink-0">
							<div
								class="absolute inset-0 rounded-full transition-colors duration-200"
								class:bg-teal-600={visibleObjectRenderingEnabled}
								class:bg-gray-300={!visibleObjectRenderingEnabled}
							></div>
							<div
								class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
								class:translate-x-5={visibleObjectRenderingEnabled}
								class:translate-x-0.5={!visibleObjectRenderingEnabled}
							></div>
						</div>
					</button>

					<button
						type="button"
						onclick={onToggleMinimapAnnotations}
						aria-pressed={minimapAnnotationsEnabled}
						class="flex w-full items-center justify-between gap-4 rounded-lg p-3 text-left transition-colors"
						class:bg-teal-50={minimapAnnotationsEnabled}
						class:hover:bg-teal-100={minimapAnnotationsEnabled}
						class:bg-gray-50={!minimapAnnotationsEnabled}
						class:hover:bg-gray-100={!minimapAnnotationsEnabled}
					>
						<div>
							<div
								class="text-sm font-medium"
								class:text-teal-900={minimapAnnotationsEnabled}
								class:text-gray-800={!minimapAnnotationsEnabled}
							>
								Minimap Annotations
							</div>
							<p class="mt-1 text-xs leading-snug text-gray-500">
								Shows tiny annotation marks in the minimap. Turn this off to reduce minimap memory
								and layout work on slower devices.
							</p>
						</div>
						<div class="relative h-6 w-11 shrink-0">
							<div
								class="absolute inset-0 rounded-full transition-colors duration-200"
								class:bg-teal-600={minimapAnnotationsEnabled}
								class:bg-gray-300={!minimapAnnotationsEnabled}
							></div>
							<div
								class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
								class:translate-x-5={minimapAnnotationsEnabled}
								class:translate-x-0.5={!minimapAnnotationsEnabled}
							></div>
						</div>
					</button>

					<div class="rounded-lg bg-gray-50 p-3">
						<div class="mb-3 flex items-start justify-between gap-3">
							<div>
								<div class="text-sm font-medium text-gray-800">Render Quality</div>
								<p class="mt-1 text-xs leading-snug text-gray-500">
									Controls how sharp the PDF stays during movement. Lower quality improves
									responsiveness; sharper quality uses more device resources.
								</p>
							</div>
							<LucideMonitor size={18} class="mt-0.5 shrink-0 text-sky-600" />
						</div>
						<div class="grid grid-cols-3 gap-1 rounded-md bg-white p-1 shadow-sm">
							{#each renderQualityModes as mode}
								<button
									type="button"
									onclick={() => handleRenderQualityModeChange(mode.value)}
									class="rounded px-2 py-2 text-xs font-medium transition-colors"
									class:bg-sky-600={renderQualityMode === mode.value}
									class:text-white={renderQualityMode === mode.value}
									class:text-gray-600={renderQualityMode !== mode.value}
									class:hover:bg-gray-100={renderQualityMode !== mode.value}
								>
									{mode.label}
								</button>
							{/each}
						</div>
						<p class="mt-2 text-xs leading-snug text-gray-500">
							{selectedRenderQualityDescription}
						</p>
					</div>
				</div>
			</section>

			<section class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-3 flex items-center gap-2">
					<LucidePanelLeft size={18} class="text-orange-600" />
					<h3 class="text-sm font-semibold text-gray-900">Side Page Preview</h3>
				</div>
				<div
					class="rounded-lg transition-colors"
					class:bg-orange-50={adjacentPagePreviewEnabled}
					class:bg-gray-50={!adjacentPagePreviewEnabled}
				>
					<button
						type="button"
						onclick={onToggleAdjacentPagePreview}
						aria-pressed={adjacentPagePreviewEnabled}
						class="flex w-full items-center justify-between gap-4 rounded-lg p-3 text-left transition-colors"
						class:hover:bg-orange-100={adjacentPagePreviewEnabled}
						class:hover:bg-gray-100={!adjacentPagePreviewEnabled}
					>
						<div>
							<div
								class="text-sm font-medium"
								class:text-orange-900={adjacentPagePreviewEnabled}
								class:text-gray-800={!adjacentPagePreviewEnabled}
							>
								Show Side Pages
							</div>
							<p class="mt-1 text-xs leading-snug text-gray-500">
								Keeps nearby pages visible as reference while editing. Higher counts are useful for
								checking context, but may slow down weaker devices.
							</p>
						</div>
						<div class="relative h-6 w-11 shrink-0">
							<div
								class="absolute inset-0 rounded-full transition-colors duration-200"
								class:bg-orange-600={adjacentPagePreviewEnabled}
								class:bg-gray-300={!adjacentPagePreviewEnabled}
							></div>
							<div
								class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
								class:translate-x-5={adjacentPagePreviewEnabled}
								class:translate-x-0.5={!adjacentPagePreviewEnabled}
							></div>
						</div>
					</button>

					{#if adjacentPagePreviewEnabled}
						<div class="border-t border-orange-100 px-3 pb-3">
							<button
								type="button"
								class="flex w-full items-center justify-between pt-3 text-left"
								onclick={() => (sidePageSettingsOpen = !sidePageSettingsOpen)}
								aria-expanded={sidePageSettingsOpen}
							>
								<span class="text-xs font-semibold text-orange-950">Preview options</span>
								<LucideChevronDown
									size={16}
									class={`text-orange-700 transition-transform ${sidePageSettingsOpen ? 'rotate-180' : ''}`}
								/>
							</button>

							{#if sidePageSettingsOpen}
								<div class="mt-3 grid gap-4 md:grid-cols-[1fr_12rem]">
									<div>
										<div class="mb-2 flex items-center justify-between gap-3">
											<div>
												<div class="text-xs font-semibold text-orange-950">Preview pages</div>
												<div class="text-[11px] text-orange-800/75">
													{adjacentPagePreviewCount}
													{adjacentPagePreviewCount === 1
														? ' page before the current page'
														: ' extra pages around the current page'}
												</div>
											</div>
											<div class="rounded-full bg-white px-2 py-1 text-xs font-bold text-orange-700 shadow-sm">
												{adjacentPagePreviewCount}
											</div>
										</div>
										<input
											type="range"
											min="1"
											max="6"
											step="1"
											value={adjacentPagePreviewCount}
											class="h-2 w-full cursor-pointer accent-orange-600"
											oninput={(event) =>
												onAdjacentPagePreviewCountChange(
													Number((event.currentTarget as HTMLInputElement).value)
												)}
										/>
									</div>

									<div>
										<div class="mb-2 text-xs font-semibold text-orange-950">Layout</div>
										<div class="grid grid-cols-2 gap-1 rounded-md bg-white p-1 shadow-sm">
											<button
												type="button"
												onclick={() => onAdjacentPagePreviewLayoutChange('row')}
												class="rounded px-2 py-2 text-xs font-medium transition-colors"
												class:bg-orange-600={adjacentPagePreviewLayout === 'row'}
												class:text-white={adjacentPagePreviewLayout === 'row'}
												class:text-gray-600={adjacentPagePreviewLayout !== 'row'}
												class:hover:bg-orange-50={adjacentPagePreviewLayout !== 'row'}
											>
												Row
											</button>
											<button
												type="button"
												onclick={() => onAdjacentPagePreviewLayoutChange('column')}
												class="rounded px-2 py-2 text-xs font-medium transition-colors"
												class:bg-orange-600={adjacentPagePreviewLayout === 'column'}
												class:text-white={adjacentPagePreviewLayout === 'column'}
												class:text-gray-600={adjacentPagePreviewLayout !== 'column'}
												class:hover:bg-orange-50={adjacentPagePreviewLayout !== 'column'}
											>
												Column
											</button>
										</div>
										<p class="mt-2 text-[11px] leading-snug text-orange-800/75">
											Row compares pages side by side. Column behaves more like a normal PDF scroll.
										</p>
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</section>

			<section class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-3 flex items-center gap-2">
					<LucideBrush size={18} class="text-blue-600" />
					<h3 class="text-sm font-semibold text-gray-900">Toolbar And Pen</h3>
				</div>
				<div class="grid gap-3 md:grid-cols-2">
					<div class="rounded-lg bg-gray-50 p-3">
						<div class="mb-3 flex items-start justify-between gap-3">
							<div>
								<div class="text-sm font-medium text-gray-800">Toolbar Position</div>
								<p class="mt-1 text-xs leading-snug text-gray-500">
									Dock the drawing tools to the side or bottom so the controls stay out of your
									working area.
								</p>
							</div>
							{#if ctx.state.toolbarPosition === 'left'}
								<LucidePanelLeft size={18} class="mt-0.5 shrink-0 text-purple-600" />
							{:else if ctx.state.toolbarPosition === 'right'}
								<LucidePanelRight size={18} class="mt-0.5 shrink-0 text-purple-600" />
							{:else}
								<LucideMoveVertical size={18} class="mt-0.5 shrink-0 text-purple-600" />
							{/if}
						</div>
						<div class="grid grid-cols-3 gap-1 rounded-md bg-white p-1 shadow-sm">
							{#each toolbarPositionOptions as option}
								<button
									type="button"
									onclick={() => handleToolbarPositionChange(option.value)}
									class="rounded px-2 py-2 text-xs font-medium transition-colors"
									class:bg-purple-600={ctx.state.toolbarPosition === option.value}
									class:text-white={ctx.state.toolbarPosition === option.value}
									class:text-gray-600={ctx.state.toolbarPosition !== option.value}
									class:hover:bg-gray-100={ctx.state.toolbarPosition !== option.value}
								>
									{option.label}
								</button>
							{/each}
						</div>
					</div>

					<button
						type="button"
						onclick={handleToggleRememberDrawingSettings}
						aria-pressed={ctx.state.rememberDrawingSettings}
						class="flex items-center justify-between gap-4 rounded-lg p-3 text-left transition-colors"
						class:bg-blue-50={ctx.state.rememberDrawingSettings}
						class:hover:bg-blue-100={ctx.state.rememberDrawingSettings}
						class:bg-gray-50={!ctx.state.rememberDrawingSettings}
						class:hover:bg-gray-100={!ctx.state.rememberDrawingSettings}
					>
						<div>
							<div
								class="text-sm font-medium"
								class:text-blue-900={ctx.state.rememberDrawingSettings}
								class:text-gray-800={!ctx.state.rememberDrawingSettings}
							>
								Remember Pen
							</div>
							<p class="mt-1 text-xs leading-snug text-gray-500">
								Keeps your last drawing color and brush size for the next editor session.
							</p>
						</div>
						<div class="relative h-6 w-11 shrink-0">
							<div
								class="absolute inset-0 rounded-full transition-colors duration-200"
								class:bg-blue-600={ctx.state.rememberDrawingSettings}
								class:bg-gray-300={!ctx.state.rememberDrawingSettings}
							></div>
							<div
								class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
								class:translate-x-5={ctx.state.rememberDrawingSettings}
								class:translate-x-0.5={!ctx.state.rememberDrawingSettings}
							></div>
						</div>
					</button>
				</div>
			</section>
		</div>

		<div class="flex justify-end border-t border-gray-100 bg-gray-50 px-4 py-3 sm:px-5">
			<button
				type="button"
				onclick={closeSettingsModal}
				class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
			>
				Done
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop bg-gray-900/50">
		<button aria-label="Close editor settings">close</button>
	</form>
</dialog>

<style>
	.menu-panel {
		max-height: calc(100vh - 5rem);
		overflow-y: auto;
		overscroll-behavior: contain;
		touch-action: pan-y;
		-webkit-overflow-scrolling: touch;
	}

	.settings-modal-content {
		overscroll-behavior: contain;
		touch-action: pan-y;
		-webkit-overflow-scrolling: touch;
	}

	.settings-modal-box {
		touch-action: pan-y;
	}

	@supports (height: 100dvh) {
		.menu-panel {
			max-height: calc(100dvh - 5rem);
		}

		.settings-modal-box {
			max-height: 90dvh;
		}
	}
</style>
