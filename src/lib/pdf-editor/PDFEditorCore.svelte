<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { toast, TOAST_ERROR } from './utils/toast';
	import { createPluginRegistration } from '@embedpdf/core';
	import { EmbedPDF } from '@embedpdf/core/svelte';
	import { usePdfiumEngine } from '@embedpdf/engines/svelte';
	import { DocumentManagerPluginPackage } from '@embedpdf/plugin-document-manager/svelte';
	import { RenderPluginPackage } from '@embedpdf/plugin-render/svelte';
	import { LucideArrowRight, LucideRotateCw } from 'lucide-svelte';

	// Canvas components
	import PDFDocumentLoader from './PDFDocumentLoader.svelte';
	import PDFDocumentSync from './PDFDocumentSync.svelte';
	import PDFPage from './PDFPage.svelte';
	import Image from './Image.svelte';
	import Text from './Text.svelte';
	import Drawing from './Drawing.svelte';
	import AnnotationCanvasLayer from './AnnotationCanvasLayer.svelte';
	import DrawingCanvas from './DrawingCanvas.svelte';
	import ErasingCanvas from './ErasingCanvas.svelte';
	import HighlightCanvas from './HighlightCanvas.svelte';
	import PointerCanvas from './PointerCanvas.svelte';
	import PointerStroke from './PointerStroke.svelte';
	import Line from './Line.svelte';
	import LineCanvas from './LineCanvas.svelte';
	import SelectionCanvas from './SelectionCanvas.svelte';
	import TeacherMark from './TeacherMark.svelte';

	// New toolbar components
	import TopBar from './components/toolbar/TopBar.svelte';
	import BottomToolbar from './components/toolbar/BottomToolbar.svelte';
	import PagePreviewMenu from './components/toolbar/PagePreviewMenu.svelte';

	// Tool panel components
	import DrawingToolPanel from './components/tool-panels/DrawingToolPanel.svelte';
	import HighlightToolPanel from './components/tool-panels/HighlightToolPanel.svelte';
	import EraserToolPanel from './components/tool-panels/EraserToolPanel.svelte';
	import ZoomToolPanel from './components/tool-panels/ZoomToolPanel.svelte';
	import TextToolPanel from './components/tool-panels/TextToolPanel.svelte';
	import LineToolPanel from './components/tool-panels/LineToolPanel.svelte';
	import SelectedLineToolPanel from './components/tool-panels/SelectedLineToolPanel.svelte';
	import TeacherMarkToolPanel from './components/tool-panels/TeacherMarkToolPanel.svelte';

	// Overlay components
	import PenModeNotification from './components/overlays/PenModeNotification.svelte';
	import SelectionToolbar from './components/overlays/SelectionToolbar.svelte';
	import MinimapZoomControl from './components/overlays/MinimapZoomControl.svelte';

	// Context and composables
	import {
		setPDFEditorContext,
		type RenderQualityMode,
		type SaveState
	} from './context/pdfEditorContext.svelte';
	import { usePDFModes } from './composables/usePDFModes';
	import { useZoomAndPan } from './composables/useZoomAndPan';
	import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts';
	import { useAutoSave } from './composables/useAutoSave.svelte';
	import {
		getAnnotationCanvasBackingScale,
		getAnnotationCanvasMaxBackingScale,
		getCappedDevicePixelRatio,
		shouldUseAnnotationVectorRendering
	} from './utils/annotationRendering';
	import { clampPdfZoom, SOFT_MIN_PDF_ZOOM } from './utils/zoomLimits';
	import { resolvePdfEditorPlugins, type PdfEditorPlugin, type PdfEditorToolId } from './plugins';

	// Command interface for undo/redo
	interface Command {
		undo(): void;
		redo(): void;
	}

	// History manager for undo/redo
	class HistoryManager {
		undoStack: Command[] = $state([]);
		redoStack: Command[] = $state([]);
		maxSize = 100;

		push(command: Command) {
			this.undoStack.push(command);
			if (this.undoStack.length > this.maxSize) {
				this.undoStack.shift();
			}
			this.redoStack = [];
		}

		undo() {
			const command = this.undoStack.pop();
			if (command) {
				this.redoStack.push(command);
				command.undo();
			}
		}

		redo() {
			const command = this.redoStack.pop();
			if (command) {
				this.undoStack.push(command);
				command.redo();
			}
		}

		canUndo() {
			return this.undoStack.length > 0;
		}

		canRedo() {
			return this.redoStack.length > 0;
		}

		rebindAllObjects(allObjects: any[]) {
			const rebind = (command: Command) => {
				if ('allObjects' in command) {
					(command as Command & { allObjects: any[] }).allObjects = allObjects;
				}
			};

			this.undoStack.forEach(rebind);
			this.redoStack.forEach(rebind);
		}
	}

	// Drag command - tracks multiple objects being dragged
	class DragCommand implements Command {
		objectIds: string[];
		oldPositions: Map<string, { x: number; y: number }>;
		newPositions: Map<string, { x: number; y: number }>;
		allObjects: any[];
		onUpdate: () => void;

		constructor(
			objectIds: string[],
			oldPositions: Map<string, { x: number; y: number }>,
			newPositions: Map<string, { x: number; y: number }>,
			allObjects: any[],
			onUpdate: () => void
		) {
			this.objectIds = objectIds;
			this.oldPositions = oldPositions;
			this.newPositions = newPositions;
			this.allObjects = allObjects;
			this.onUpdate = onUpdate;
		}

		undo() {
			this.objectIds.forEach((id) => {
				const index = this.allObjects.findIndex((o) => o.id === id);
				const oldPos = this.oldPositions.get(id);
				if (index !== -1 && oldPos) {
					this.allObjects[index] = { ...this.allObjects[index], ...oldPos };
				}
			});
			this.onUpdate();
		}

		redo() {
			this.objectIds.forEach((id) => {
				const index = this.allObjects.findIndex((o) => o.id === id);
				const newPos = this.newPositions.get(id);
				if (index !== -1 && newPos) {
					this.allObjects[index] = { ...this.allObjects[index], ...newPos };
				}
			});
			this.onUpdate();
		}
	}

	// Update object command - tracks property changes
	class UpdateObjectCommand implements Command {
		objectId: string;
		oldState: any;
		newState: any;
		allObjects: any[];
		onUpdate: () => void;

		constructor(
			objectId: string,
			oldState: any,
			newState: any,
			allObjects: any[],
			onUpdate: () => void
		) {
			this.objectId = objectId;
			this.oldState = oldState;
			this.newState = newState;
			this.allObjects = allObjects;
			this.onUpdate = onUpdate;
		}

		undo() {
			const index = this.allObjects.findIndex((o) => o.id === this.objectId);
			if (index !== -1) {
				this.allObjects[index] = { ...this.allObjects[index], ...this.oldState };
				this.onUpdate();
			}
		}

		redo() {
			const index = this.allObjects.findIndex((o) => o.id === this.objectId);
			if (index !== -1) {
				this.allObjects[index] = { ...this.allObjects[index], ...this.newState };
				this.onUpdate();
			}
		}
	}

	class BatchUpdateObjectsCommand implements Command {
		updates: Array<{ objectId: string; oldState: any; newState: any }>;
		allObjects: any[];
		onUpdate: () => void;

		constructor(
			updates: Array<{ objectId: string; oldState: any; newState: any }>,
			allObjects: any[],
			onUpdate: () => void
		) {
			this.updates = updates;
			this.allObjects = allObjects;
			this.onUpdate = onUpdate;
		}

		undo() {
			this.updates.forEach(({ objectId, oldState }) => {
				const index = this.allObjects.findIndex((o) => o.id === objectId);
				if (index !== -1) {
					this.allObjects[index] = { ...this.allObjects[index], ...oldState };
				}
			});
			this.onUpdate();
		}

		redo() {
			this.updates.forEach(({ objectId, newState }) => {
				const index = this.allObjects.findIndex((o) => o.id === objectId);
				if (index !== -1) {
					this.allObjects[index] = { ...this.allObjects[index], ...newState };
				}
			});
			this.onUpdate();
		}
	}

	// Add object command - tracks object creation
	class AddObjectCommand implements Command {
		object: any;
		allObjects: any[];
		onUpdate: () => void;

		constructor(object: any, allObjects: any[], onUpdate: () => void) {
			this.object = object;
			this.allObjects = allObjects;
			this.onUpdate = onUpdate;
		}

		undo() {
			const index = this.allObjects.findIndex((o) => o.id === this.object.id);
			if (index !== -1) {
				this.allObjects.splice(index, 1);
				this.onUpdate();
			}
		}

		redo() {
			this.allObjects.push(this.object);
			// Re-sort if necessary
			this.allObjects.sort((a, b) => {
				const TYPE_ORDER: Record<string, number> = {
					drawing: 1,
					highlight: 1,
					line: 2,
					text: 3,
					'teacher-mark': 4
				};
				const orderA = TYPE_ORDER[a.type] || 0;
				const orderB = TYPE_ORDER[b.type] || 0;
				if (orderA !== orderB) return orderA - orderB;
				return 0;
			});
			this.onUpdate();
		}
	}

	// Delete object command - tracks object deletion
	class DeleteObjectCommand implements Command {
		object: any;
		index: number;
		allObjects: any[];
		onUpdate: () => void;

		constructor(object: any, index: number, allObjects: any[], onUpdate: () => void) {
			this.object = object;
			this.index = index;
			this.allObjects = allObjects;
			this.onUpdate = onUpdate;
		}

		undo() {
			this.allObjects.splice(this.index, 0, this.object);
			this.onUpdate();
		}

		redo() {
			const currentIndex = this.allObjects.findIndex((o) => o.id === this.object.id);
			if (currentIndex !== -1) {
				this.allObjects.splice(currentIndex, 1);
				this.onUpdate();
			}
		}
	}

	// Batch delete command - tracks deletion of multiple objects at once
	class BatchDeleteCommand implements Command {
		deletedObjects: Array<{ object: any; index: number }>;
		allObjects: any[];
		onUpdate: () => void;

		constructor(
			deletedObjects: Array<{ object: any; index: number }>,
			allObjects: any[],
			onUpdate: () => void
		) {
			this.deletedObjects = deletedObjects;
			this.allObjects = allObjects;
			this.onUpdate = onUpdate;
		}

		undo() {
			// Restore all objects in reverse order to maintain correct indices
			const sorted = [...this.deletedObjects].sort((a, b) => a.index - b.index);
			sorted.forEach(({ object, index }) => {
				this.allObjects.splice(index, 0, object);
			});
			this.onUpdate();
		}

		redo() {
			// Delete all objects (in reverse order to maintain indices)
			const sorted = [...this.deletedObjects].sort((a, b) => b.index - a.index);
			sorted.forEach(({ object }) => {
				const currentIndex = this.allObjects.findIndex((o) => o.id === object.id);
				if (currentIndex !== -1) {
					this.allObjects.splice(currentIndex, 1);
				}
			});
			this.onUpdate();
		}
	}

	// Utils
	import { save } from './utils/PDF.js';
	import HomeworkInfoModal from './components/HomeworkInfoModal.svelte';
	import {
		findDrawingsAtPoint,
		getPathGeometry,
		getTransformedDrawingBBox,
	} from './utils/hitTest';
	import { createObjectSpatialIndex } from './utils/spatialIndex';

	let {
		allObjects = $bindable([]),
		currentPage,
		pdfBlob,
		allowPrinting = false,
		user,
		onAnnotationChange = undefined,
		flushLocalDraft = undefined,
		saveState = $bindable<SaveState>({
			status: 'idle',
			hasUnsavedChanges: false
		}),
		homework_info,
		disabled_pages = [{ from_page: 0, to_page: 0 }],
		disabled = false,
		handleComplete,
		handleSave,
		retryFailedSave,
		handlePageChange,
		adjacentPageAnnotations = {},
		onAdjacentPageVisible = undefined,
		isPageLoading = false,
		autoSaveEnabled = undefined,
		allowTeacherMark = false,
		teacherMarkName = 'Teacher',
		wasmUrl = '/vendor/embedpdf/pdfium.wasm?v=2.14.4',
		plugins = undefined,
		getAllPageAnnotations = undefined
	} = $props();

	// Initialize context with current state (allObjects is managed externally as prop)
	const ctx = setPDFEditorContext({
		user,
		currentPage,
		saveState,
		homework_info,
		disabled_pages,
		allowPrinting,
		autoSaveEnabled,
		allowTeacherMark,
		teacherMarkName,
		isPageLoading
	});

	// Initialize composables
	const modes = usePDFModes();
	const resolvedPlugins = $derived(resolvePdfEditorPlugins(plugins as PdfEditorPlugin[] | undefined));
	const enabledTools = $derived(resolvedPlugins.enabledTools);
	const enabledToolMap = $derived(resolvedPlugins.enabledToolMap);
	const embedPdfPluginRegistrations = $derived(resolvedPlugins.embedPdfRegistrations);

	function hasTool(tool: PdfEditorToolId) {
		return enabledTools.has(tool);
	}
	const genID = () => Date.now().toString();
	let editorScrollRoot: HTMLDivElement | undefined = $state();
	const zoomPan = useZoomAndPan(() => editorScrollRoot);
	const autoSave = useAutoSave(async () => await handleSaveFirst(), 5000); // 5 second debounce
	const history = new HistoryManager();
	let strokeInteractionResumeTimer: ReturnType<typeof setTimeout> | null = null;

	function handleZoomToFit() {
		if (typeof window === 'undefined') return;

		const viewport = getEditorViewportMetrics();
		const availableWidth = Math.max(120, viewport.width - 64);
		const availableHeight = Math.max(120, viewport.height - 144);
		const fitZoom = clampPdfZoom(
			Math.min(availableWidth / currentPageWidth, availableHeight / currentPageHeight),
			SOFT_MIN_PDF_ZOOM
		);

		zoomPan.zoomAtPoint(fitZoom, undefined, undefined, true);
		tick().then(() => requestAnimationFrame(centerEditablePageInViewport));
	}

	function handleResetView() {
		zoomPan.handleResetZoom();
		tick().then(() => requestAnimationFrame(centerEditablePageInViewport));
	}

	// Sync props to context
	$effect(() => {
		ctx.state.user = user;
		ctx.state.currentPage = currentPage;
		ctx.state.saveState = saveState;
		ctx.state.homework_info = homework_info;
		ctx.state.disabled_pages = disabled_pages;
		ctx.state.allowPrinting = allowPrinting;
		if (autoSaveEnabled !== undefined && ctx.state.autoSaveEnabled !== autoSaveEnabled) {
			ctx.state.autoSaveEnabled = autoSaveEnabled;
		}
		ctx.state.isPageLoading = isPageLoading;
		ctx.state.allowTeacherMark = allowTeacherMark;
		ctx.state.teacherMarkName = teacherMarkName;
	});

	let objectLookup = $derived.by(() => {
		const byId = new Map<string, any>();
		const indexById = new Map<string, number>();

		for (let index = 0; index < allObjects.length; index += 1) {
			const object = allObjects[index];
			if (!object?.id) continue;

			const id = String(object.id);
			byId.set(id, object);
			indexById.set(id, index);
		}

		return { byId, indexById };
	});
	let objectById = $derived.by(() => objectLookup.byId);
	let objectIndexById = $derived.by(() => objectLookup.indexById);
	let objectSpatialIndex = $derived.by(() => createObjectSpatialIndex(allObjects || []));
	let selectedObjectIdSet = $derived.by(() => new Set(ctx.state.selectedObjectIds));

	function getObjectById<T = any>(id: string | null | undefined): T | undefined {
		return id ? objectById.get(id) : undefined;
	}

	function getObjectIndexById(id: string | null | undefined) {
		return id ? (objectIndexById.get(id) ?? -1) : -1;
	}

	function isSelectedObjectId(id: string | null | undefined) {
		return id ? selectedObjectIdSet.has(id) : false;
	}

	function findObjectsAtPoint(point: { x: number; y: number }) {
		const candidates = objectSpatialIndex.queryPoint(
			point.x,
			point.y,
			6 / Math.max(ctx.state.zoom || 1, 0.1)
		);
		return findDrawingsAtPoint(point, allObjects, ctx.state.zoom, candidates);
	}

	// internalPage is synced FROM currentPage (not TO it)
	let internalPage = $state(currentPage);
	let inputValue = $derived(internalPage.toString());
	let toolPanelIsMinimized = $state(false);
	let isCompleting = $state(false);
	const COMPLETION_FEEDBACK_MS = 800;

	const handleDone = async () => {
		if (isCompleting || saveState.status === 'saving') return;

		isCompleting = true;
		const feedbackDelay = new Promise<void>((resolve) => {
			setTimeout(resolve, COMPLETION_FEEDBACK_MS);
		});

		try {
			await Promise.all([Promise.resolve(handleComplete(allObjects)), feedbackDelay]);
		} finally {
			isCompleting = false;
		}
	};

	function refreshAllObjectsReference() {
		allObjects = [...allObjects];
		history.rebindAllObjects(allObjects);
	}

	function handleTransientAnnotationStateChange() {
		refreshAllObjectsReference();
	}

	// Wrapper for annotation changes that triggers both the callback and auto-save
	const handleAnnotationChange = () => {
		refreshAllObjectsReference();
		onAnnotationChange?.(allObjects);
		autoSave.markChange();
	};

	function beginStrokeInteraction() {
		if (strokeInteractionResumeTimer) {
			clearTimeout(strokeInteractionResumeTimer);
			strokeInteractionResumeTimer = null;
		}

		autoSave.pause();
		zoomPan.cancelLowPriorityMotion();
		ctx.state.activeInteraction = 'drawing';
		ctx.state.isDrawingStroke = true;
		ctx.state.deferAnnotationRedraw = true;
	}

	function endStrokeInteraction() {
		ctx.state.isDrawingStroke = false;
		ctx.state.deferAnnotationRedraw = false;
		if (ctx.state.activeInteraction === 'drawing') {
			ctx.state.activeInteraction = 'idle';
		}
		void Promise.resolve(flushLocalDraft?.()).catch((error) => {
			console.warn('Failed to flush the local editor draft after a stroke:', error);
		});

		strokeInteractionResumeTimer = setTimeout(() => {
			strokeInteractionResumeTimer = null;
			autoSave.resume();
		}, 120);
	}

	function cancelStrokeInteraction() {
		ctx.state.isDrawingStroke = false;
		ctx.state.deferAnnotationRedraw = false;
		if (ctx.state.activeInteraction === 'drawing') {
			ctx.state.activeInteraction = 'idle';
		}
		autoSave.resume();
	}

	function persistDrawingSettings() {
		if (typeof localStorage === 'undefined' || !ctx.state.rememberDrawingSettings) return;

		localStorage.setItem('pdf-editor-drawing-brush-size', String(ctx.state.brushSize));
		localStorage.setItem('pdf-editor-drawing-brush-color', ctx.state.brushColor);
	}

	function handleDrawingBrushSizeChange(size: number) {
		ctx.state.brushSize = size;
		persistDrawingSettings();
	}

	function handleDrawingBrushColorChange(color: string) {
		ctx.state.brushColor = color;
		persistDrawingSettings();
	}

	onDestroy(() => {
		cleanupSelectionResize();
		cleanupSelectionRotation();
		keyboardShortcuts.detach();
		exitFullScreen();
		autoSave.cleanup();
		if (strokeInteractionResumeTimer) {
			clearTimeout(strokeInteractionResumeTimer);
			strokeInteractionResumeTimer = null;
		}
		if (cameraRestoreFrame !== null) {
			cancelAnimationFrame(cameraRestoreFrame);
			cameraRestoreFrame = null;
		}
		if (initialCenterFrame !== null) {
			cancelAnimationFrame(initialCenterFrame);
			initialCenterFrame = null;
		}
		if (pageRenderVisibilityFrame !== null) {
			cancelAnimationFrame(pageRenderVisibilityFrame);
			pageRenderVisibilityFrame = null;
		}
	});

	const handleSaveFirst = async () => {
		if (ctx.state.isDrawingStroke) {
			autoSave.markChange();
			return;
		}

		// allObjects binding is already synced - just trigger save
		autoSave.cancelAutoSave();
		ctx.state.activeInteraction = 'saving';
		try {
			await handleSave();
		} finally {
			if (ctx.state.activeInteraction === 'saving') {
				ctx.state.activeInteraction = 'idle';
			}
		}
	};

	const pdfEngine = usePdfiumEngine({ wasmUrl, worker: false });

	let pdfFile: File | undefined = $state();
	let pdfName = '';
	let pdfDocumentId = $state('pdf-editor-document');
	let pdfBuffer: ArrayBuffer | null = $state(null);
	let pages: number[] = $state([]);
	let PDFReady = $state(false);
	let currentPageWidth = $state(595); // Default A4 width
	let currentPageHeight = $state(842); // Default A4 height
	let settledRenderZoom = $state(ctx.state.zoom);
	let settledRenderQualityMode = $state<RenderQualityMode>(ctx.state.renderQualityMode);
	let useVisibleObjectRendering = $state(true);
	let minimapAnnotationsEnabled = $state(true);
	let adjacentPagePreviewEnabled = $state(false);
	let adjacentPagePreviewCount = $state(2);
	let adjacentPagePreviewLayout = $state<'row' | 'column'>('row');
	let scaledPagePreviewWidth = $derived(currentPageWidth * ctx.state.zoom);
	let useCompactPageTabs = $derived(
		ctx.state.zoom <= 0.75 ||
			scaledPagePreviewWidth <= 280 ||
			(adjacentPagePreviewEnabled && adjacentPagePreviewLayout === 'column')
	);
	let useMinimalPageTabs = $derived(ctx.state.zoom <= 0.45 || scaledPagePreviewWidth <= 170);
	let columnPageTabWidth = $derived(
		adjacentPagePreviewEnabled && adjacentPagePreviewLayout === 'column'
			? useMinimalPageTabs
				? 112
				: 152
			: 0
	);
	let pageStackWidth = $derived(scaledPagePreviewWidth + columnPageTabWidth);
	let visiblePageRect = $state({ x: 0, y: 0, width: currentPageWidth, height: currentPageHeight });
	let visiblePageRectFrame: number | null = null;
	let cameraRestoreFrame: number | null = null;
	let initialCenterFrame: number | null = null;
	let hasCenteredInitialPage = $state(false);
	let initialCenterAttempts = 0;
	let pendingPageCamera: {
		targetPage: number;
		pageX: number;
		pageY: number;
		viewportX: number;
		viewportY: number;
		attempts: number;
	} | null = $state(null);
	let cameraIsLive = $derived(ctx.state.isPanning || ctx.state.isZooming);
	let annotationRenderZoom = $derived(
		cameraIsLive || ctx.state.isDrawingStroke ? settledRenderZoom : ctx.state.zoom
	);
	let drawingInputActive = $derived(
		ctx.state.addingDrawing ||
			ctx.state.isHighlighting ||
			ctx.state.isErasing ||
			ctx.state.isPointerMode ||
			ctx.state.isAddingLine ||
			ctx.state.isDrawingStroke
	);
	let scrollRootTouchAction = $derived(
		ctx.state.isHandMode || drawingInputActive ? 'none' : 'pan-x pan-y'
	);
	let workspaceTouchAction = $derived(
		ctx.state.isHandMode || drawingInputActive ? 'none' : 'auto'
	);

	$effect(() => {
		ctx.state.zoom;
		ctx.state.renderQualityMode;
		ctx.state.cameraRevision;
		cameraIsLive;
		ctx.state.isDrawingStroke;

		if (!cameraIsLive && !ctx.state.isDrawingStroke) {
			settledRenderZoom = ctx.state.zoom;
			settledRenderQualityMode = ctx.state.renderQualityMode;
		}
	});
	const ADJACENT_PAGE_GAP_PX = 32;
	const VISIBLE_OBJECT_BUFFER_PX = 320;
	const SIDE_PAGE_RENDER_MARGIN_PX = 640;
	const objectVisualBoxCache = new Map<string, { key: string; box: any }>();
	let editablePageFrame: HTMLElement | undefined = $state();
	let visibleAdjacentPreviewPages = $state(new Set<number>());
	let pageRenderDeferUpdates = $derived(cameraIsLive || ctx.state.isDrawingStroke);
	let pageRenderVisibilityRevision = $state(0);
	let pageRenderVisibilityViewport = $state({ left: 0, top: 0, right: 0, bottom: 0 });
	let pageRenderVisibilityFrame: number | null = null;

	function invalidateObjectVisualBoxCache(objectId?: string) {
		if (objectId) {
			objectVisualBoxCache.delete(objectId);
			return;
		}

		objectVisualBoxCache.clear();
	}

	const embedPdfPlugins = $derived(
		pdfBuffer
			? [
					createPluginRegistration(DocumentManagerPluginPackage, {
						maxDocuments: 1
					}),
					createPluginRegistration(RenderPluginPackage, {
						withForms: true,
						withAnnotations: false
					}),
					...embedPdfPluginRegistrations
				]
			: []
	);

	// Pagination
	let maxPage = $state(1);
	let minPage = $state(1);
	const itemsPerPage = 1;
	let isPagePreviewOpen = $state(false);

	// Homework info modal
	let view_homework_info = $state();

	async function nextPage() {
		if (saveState.hasUnsavedChanges) {
			await handleSaveFirst();
		}

		if (internalPage < Math.ceil(maxPage / itemsPerPage)) {
			const nextPage = internalPage + 1;
			capturePageCamera(nextPage);
			internalPage = nextPage;
		}
	}

	async function prevPage() {
		if (saveState.hasUnsavedChanges) {
			await handleSaveFirst();
		}

		if (internalPage > minPage) {
			const nextPage = internalPage - 1;
			capturePageCamera(nextPage);
			internalPage = nextPage;
		}
	}

	async function goToPage(page: number) {
		const nextPage = Math.max(minPage, Math.min(page, maxPage));

		if (nextPage === internalPage) {
			return;
		}

		if (saveState.hasUnsavedChanges) {
			await handleSaveFirst();
		}

		capturePageCamera(nextPage);
		internalPage = nextPage;
	}

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let isChangingPage = $state(false);

	// Touch double-click tracking for selected objects
	let lastTouchedObjectId: string | null = $state(null);
	let lastTouchTime = $state(0);
	let lastTouchPosition = $state({ x: 0, y: 0 });
	const TOUCH_DOUBLE_CLICK_TIME_THRESHOLD = 400; // milliseconds
	const TOUCH_DOUBLE_CLICK_POSITION_THRESHOLD = 15; // pixels

	// When internalPage changes (via UI), call handlePageChange
	$effect(() => {
		if (internalPage !== currentPage) {
			if (pendingPageCamera?.targetPage !== internalPage) {
				capturePageCamera(internalPage);
			}

			isChangingPage = true;

			// clear any previous debounce
			if (debounceTimer) clearTimeout(debounceTimer);

			// set new debounce - call handlePageChange with the NEW page
			debounceTimer = setTimeout(() => {
				capturePageCamera(internalPage);
				handlePageChange?.(internalPage);
				isChangingPage = false;
			}, 500);
		}
	});

	// Effect to ensure isAddingLine is false when a line is selected
	$effect(() => {
		if (ctx.state.selectedLineId) {
			ctx.state.isAddingLine = false;
		}
	});

	// Fullscreen stuff
	function exitFullScreen() {
		if (document.fullscreenElement) {
			document.exitFullscreen().catch((err) => {
				toast.push(`Error exiting fullscreen: ${err.message}`, { theme: TOAST_ERROR });
			});
		}
	}

	let isFullscreen = $state(false);

	function toggleFullScreen() {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen();
			isFullscreen = true;
		} else {
			if (document.exitFullscreen) {
				document.exitFullscreen();
				isFullscreen = false;
			}
		}
	}

	function getEditorViewportMetrics() {
		if (editorScrollRoot) {
			const rect = editorScrollRoot.getBoundingClientRect();

			return {
				left: rect.left,
				top: rect.top,
				right: rect.left + editorScrollRoot.clientWidth,
				bottom: rect.top + editorScrollRoot.clientHeight,
				width: editorScrollRoot.clientWidth,
				height: editorScrollRoot.clientHeight,
				scrollLeft: editorScrollRoot.scrollLeft,
				scrollTop: editorScrollRoot.scrollTop
			};
		}

		return {
			left: 0,
			top: 0,
			right: window.innerWidth,
			bottom: window.innerHeight,
			width: window.innerWidth,
			height: window.innerHeight,
			scrollLeft: window.scrollX,
			scrollTop: window.scrollY
		};
	}

	function updateVisiblePageRect() {
		if (typeof window === 'undefined' || !pageContentLayer) {
			visiblePageRect = { x: 0, y: 0, width: currentPageWidth, height: currentPageHeight };
			return;
		}

		const rect = pageContentLayer.getBoundingClientRect();
		const viewport = getEditorViewportMetrics();
		const zoom = Math.max(ctx.state.zoom || 1, 0.1);
		const buffer = VISIBLE_OBJECT_BUFFER_PX / zoom;
		const left = Math.max(0, (viewport.left - rect.left) / zoom - buffer);
		const top = Math.max(0, (viewport.top - rect.top) / zoom - buffer);
		const right = Math.min(currentPageWidth, (viewport.right - rect.left) / zoom + buffer);
		const bottom = Math.min(currentPageHeight, (viewport.bottom - rect.top) / zoom + buffer);

		visiblePageRect = {
			x: left,
			y: top,
			width: Math.max(0, right - left),
			height: Math.max(0, bottom - top)
		};
	}

	function updatePageRenderVisibility() {
		if (typeof window === 'undefined') return;

		const viewport = getEditorViewportMetrics();
		const nextViewport = {
			left: viewport.left,
			top: viewport.top,
			right: viewport.right,
			bottom: viewport.bottom
		};

		if (
			pageRenderVisibilityViewport.left !== nextViewport.left ||
			pageRenderVisibilityViewport.top !== nextViewport.top ||
			pageRenderVisibilityViewport.right !== nextViewport.right ||
			pageRenderVisibilityViewport.bottom !== nextViewport.bottom
		) {
			pageRenderVisibilityViewport = nextViewport;
		}

		pageRenderVisibilityRevision += 1;
	}

	function schedulePageRenderVisibilityUpdate() {
		if (typeof requestAnimationFrame === 'undefined') {
			updatePageRenderVisibility();
			return;
		}

		if (pageRenderVisibilityFrame !== null) return;
		pageRenderVisibilityFrame = requestAnimationFrame(() => {
			pageRenderVisibilityFrame = null;
			updatePageRenderVisibility();
		});
	}

	function scheduleVisiblePageRectUpdate() {
		schedulePageRenderVisibilityUpdate();

		if (typeof requestAnimationFrame === 'undefined') {
			updateVisiblePageRect();
			return;
		}

		if (visiblePageRectFrame !== null) return;
		visiblePageRectFrame = requestAnimationFrame(() => {
			visiblePageRectFrame = null;
			updateVisiblePageRect();
		});
	}

	function getDocumentMaxScroll() {
		if (editorScrollRoot) {
			return {
				x: Math.max(0, editorScrollRoot.scrollWidth - editorScrollRoot.clientWidth),
				y: Math.max(0, editorScrollRoot.scrollHeight - editorScrollRoot.clientHeight)
			};
		}

		return {
			x: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
			y: Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
		};
	}

	function scrollEditorTo(left: number, top: number, behavior: ScrollBehavior = 'auto') {
		if (editorScrollRoot) {
			editorScrollRoot.scrollTo({ left, top, behavior });
			return;
		}

		window.scrollTo({ left, top, behavior });
	}

	function scrollEditorBy(left: number, top: number, behavior: ScrollBehavior = 'auto') {
		if (editorScrollRoot) {
			scrollEditorTo(editorScrollRoot.scrollLeft + left, editorScrollRoot.scrollTop + top, behavior);
			return;
		}

		window.scrollBy({ left, top, behavior });
	}

	function capturePageCamera(targetPage: number) {
		if (typeof window === 'undefined') return;

		const viewport = getEditorViewportMetrics();
		const viewportX = viewport.left + viewport.width / 2;
		const viewportY = viewport.top + viewport.height / 2;
		const zoom = Math.max(ctx.state.zoom || 1, 0.1);
		const rect = editablePageFrame?.getBoundingClientRect();
		const pageX =
			rect && rect.width > 0
				? clampNumber((viewportX - rect.left) / zoom, 0, currentPageWidth)
				: currentPageWidth / 2;
		const pageY =
			rect && rect.height > 0
				? clampNumber((viewportY - rect.top) / zoom, 0, currentPageHeight)
				: currentPageHeight / 2;

		pendingPageCamera = {
			targetPage,
			pageX,
			pageY,
			viewportX,
			viewportY,
			attempts: 0
		};
	}

	function restorePageCamera() {
		if (typeof window === 'undefined' || !pendingPageCamera || !editablePageFrame) return false;

		const rect = editablePageFrame.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return false;

		const zoom = Math.max(ctx.state.zoom || 1, 0.1);
		const pageX = clampNumber(pendingPageCamera.pageX, 0, currentPageWidth);
		const pageY = clampNumber(pendingPageCamera.pageY, 0, currentPageHeight);
		const targetX = rect.left + pageX * zoom;
		const targetY = rect.top + pageY * zoom;
		const maxScroll = getDocumentMaxScroll();
		const viewport = getEditorViewportMetrics();

		scrollEditorTo(
			clampNumber(viewport.scrollLeft + targetX - pendingPageCamera.viewportX, 0, maxScroll.x),
			clampNumber(viewport.scrollTop + targetY - pendingPageCamera.viewportY, 0, maxScroll.y),
			'instant' as ScrollBehavior
		);

		pendingPageCamera = null;
		scheduleVisiblePageRectUpdate();
		return true;
	}

	function schedulePageCameraRestore() {
		if (typeof requestAnimationFrame === 'undefined') {
			restorePageCamera();
			return;
		}

		if (cameraRestoreFrame !== null) return;

		cameraRestoreFrame = requestAnimationFrame(() => {
			cameraRestoreFrame = null;

			if (!pendingPageCamera) return;
			if (restorePageCamera()) return;

			const retryCamera = {
				...pendingPageCamera,
				attempts: pendingPageCamera.attempts + 1
			};
			pendingPageCamera = retryCamera;

			if (retryCamera.attempts < 8) {
				schedulePageCameraRestore();
			}
		});
	}

	function centerEditablePageInViewport() {
		if (typeof window === 'undefined' || !editablePageFrame) return;

		const rect = editablePageFrame.getBoundingClientRect();
		const viewport = getEditorViewportMetrics();
		const horizontalDelta = rect.left + rect.width / 2 - (viewport.left + viewport.width / 2);
		const toolbarOffset = 104;
		let verticalDelta = 0;

		if (rect.top < viewport.top + toolbarOffset) {
			verticalDelta = rect.top - (viewport.top + toolbarOffset);
		} else if (
			rect.bottom < viewport.top + toolbarOffset + 160 ||
			rect.top > viewport.bottom - 160
		) {
			verticalDelta = rect.top - (viewport.top + toolbarOffset);
		}

		scrollEditorBy(horizontalDelta, verticalDelta, 'instant' as ScrollBehavior);
	}

	function scheduleInitialPageCenter() {
		if (typeof requestAnimationFrame === 'undefined') {
			centerEditablePageInViewport();
			hasCenteredInitialPage = true;
			scheduleVisiblePageRectUpdate();
			return;
		}

		if (initialCenterFrame !== null) return;

		initialCenterFrame = requestAnimationFrame(() => {
			initialCenterFrame = null;

			if (!editablePageFrame) return;
			if (pendingPageCamera) return;

			centerEditablePageInViewport();
			scheduleVisiblePageRectUpdate();

			const rect = editablePageFrame.getBoundingClientRect();
			const viewport = getEditorViewportMetrics();
			const isHorizontallyCentered =
				Math.abs(rect.left + rect.width / 2 - (viewport.left + viewport.width / 2)) < 2;
			const canRetry = initialCenterAttempts < 8;
			initialCenterAttempts += 1;

			if (isHorizontallyCentered || !canRetry) {
				hasCenteredInitialPage = true;
				return;
			}

			scheduleInitialPageCenter();
		});
	}

	function isElementNearViewport(node: HTMLElement, margin = 240) {
		if (typeof window === 'undefined') return false;

		const rect = node.getBoundingClientRect();
		const viewport = getEditorViewportMetrics();
		return (
			rect.right >= viewport.left - margin &&
			rect.left <= viewport.right + margin &&
			rect.bottom >= viewport.top - margin &&
			rect.top <= viewport.bottom + margin
		);
	}

	function setAdjacentPagePreviewVisible(pageNo: number, isVisible: boolean) {
		if (!pageNo) return;
		if (visibleAdjacentPreviewPages.has(pageNo) === isVisible) return;

		const next = new Set(visibleAdjacentPreviewPages);

		if (isVisible) {
			next.add(pageNo);
		} else {
			next.delete(pageNo);
		}

		visibleAdjacentPreviewPages = next;
	}

	function isAdjacentPagePreviewVisible(pageNo: number) {
		return visibleAdjacentPreviewPages.has(pageNo);
	}

	function observeAdjacentPage(node: HTMLElement, pageNo: number) {
		let observedPage = pageNo;
		let hasNotified = false;

		const notifyVisible = () => {
			if (hasNotified || !observedPage) return;
			hasNotified = true;
			Promise.resolve(onAdjacentPageVisible?.(observedPage)).catch((error) => {
				toast.push(
					`Failed to load adjacent page annotations: ${error instanceof Error ? error.message : String(error)}`,
					{ theme: TOAST_ERROR }
				);
			});
		};

		if (typeof IntersectionObserver === 'undefined') {
			setAdjacentPagePreviewVisible(observedPage, true);
			notifyVisible();
			return {
				update(pageNo: number) {
					if (pageNo === observedPage) return;
					setAdjacentPagePreviewVisible(observedPage, false);
					observedPage = pageNo;
					hasNotified = false;
					setAdjacentPagePreviewVisible(observedPage, true);
					notifyVisible();
				},
				destroy() {
					setAdjacentPagePreviewVisible(observedPage, false);
				}
			};
		}

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const isVisible = entry.isIntersecting;
					setAdjacentPagePreviewVisible(observedPage, isVisible);

					if (isVisible) {
						notifyVisible();
					}
				}
			},
			{
				root: null,
				rootMargin: `${SIDE_PAGE_RENDER_MARGIN_PX}px`,
				threshold: 0.01
			}
		);

		observer.observe(node);

		if (isElementNearViewport(node, SIDE_PAGE_RENDER_MARGIN_PX)) {
			setAdjacentPagePreviewVisible(observedPage, true);
			notifyVisible();
		}

		return {
			update(pageNo: number) {
				if (pageNo === observedPage) return;
				setAdjacentPagePreviewVisible(observedPage, false);
				observedPage = pageNo;
				hasNotified = false;
				if (isElementNearViewport(node, SIDE_PAGE_RENDER_MARGIN_PX)) {
					setAdjacentPagePreviewVisible(observedPage, true);
					notifyVisible();
				}
			},
			destroy() {
				observer.disconnect();
				setAdjacentPagePreviewVisible(observedPage, false);
			}
		};
	}

	$effect(() => {
		pageContentLayer;
		currentPage;
		currentPageWidth;
		currentPageHeight;
		ctx.state.zoom;
		scheduleVisiblePageRectUpdate();
	});

	$effect(() => {
		pendingPageCamera;
		editablePageFrame;
		currentPage;
		currentPageWidth;
		currentPageHeight;
		ctx.state.zoom;
		PDFReady;
		isPageLoading;
		pdfEngine.isLoading;
		pdfEngine.engine;
		embedPdfPlugins.length;

		if (
			pendingPageCamera &&
			pendingPageCamera.targetPage === currentPage &&
			PDFReady &&
			!isPageLoading &&
			!pdfEngine.isLoading &&
			pdfEngine.engine &&
			embedPdfPlugins.length
		) {
			tick().then(schedulePageCameraRestore);
		}
	});

	$effect(() => {
		editablePageFrame;
		currentPageWidth;
		currentPageHeight;
		ctx.state.zoom;
		PDFReady;
		isPageLoading;
		pdfEngine.isLoading;
		pdfEngine.engine;
		embedPdfPlugins.length;

		if (
			!hasCenteredInitialPage &&
			!pendingPageCamera &&
			editablePageFrame &&
			PDFReady &&
			!isPageLoading &&
			!pdfEngine.isLoading &&
			pdfEngine.engine &&
			embedPdfPlugins.length
		) {
			tick().then(scheduleInitialPageCenter);
		}
	});

	$effect(() => {
		pageContentLayer;
		editablePageFrame;
		currentPage;
		adjacentPagePreviewEnabled;
		adjacentPagePreviewLayout;
		adjacentPagePreviewCount;
		minPage;
		maxPage;
		PDFReady;
		isPageLoading;

		tick().then(() => {
			requestAnimationFrame(scheduleVisiblePageRectUpdate);
		});
	});

	// For test purpose
	onMount(() => {
		let disposed = false;

		const savedVisibleObjectRendering = localStorage.getItem(
			'pdf-editor-visible-object-rendering-enabled'
		);
		if (savedVisibleObjectRendering !== null) {
			useVisibleObjectRendering = savedVisibleObjectRendering === 'true';
		}

		const savedMinimapAnnotations = localStorage.getItem(
			'pdf-editor-minimap-annotations-enabled'
		);
		if (savedMinimapAnnotations !== null) {
			minimapAnnotationsEnabled = savedMinimapAnnotations === 'true';
		}

		const savedAdjacentPagePreview = localStorage.getItem(
			'pdf-editor-adjacent-page-preview-enabled'
		);
		if (savedAdjacentPagePreview !== null) {
			adjacentPagePreviewEnabled = savedAdjacentPagePreview === 'true';
		}

		const savedAdjacentPagePreviewCount = Number(
			localStorage.getItem('pdf-editor-adjacent-page-preview-count') || ''
		);
		if (!Number.isNaN(savedAdjacentPagePreviewCount)) {
			adjacentPagePreviewCount = clampAdjacentPagePreviewCount(savedAdjacentPagePreviewCount);
		}

		const savedAdjacentPagePreviewLayout = localStorage.getItem(
			'pdf-editor-adjacent-page-preview-layout'
		);
		if (
			savedAdjacentPagePreviewLayout === 'row' ||
			savedAdjacentPagePreviewLayout === 'column'
		) {
			adjacentPagePreviewLayout = savedAdjacentPagePreviewLayout;
		} else if (savedAdjacentPagePreviewLayout === 'grid') {
			adjacentPagePreviewLayout = 'column';
		}

		document.documentElement.classList.add('pdf-editor-active');
		document.body.classList.add('pdf-editor-active');

		const updateViewport = () => scheduleVisiblePageRectUpdate();
		const scrollRoot = editorScrollRoot;
		window.addEventListener('resize', updateViewport);
		if (scrollRoot) {
			scrollRoot.addEventListener('scroll', updateViewport, { passive: true });
		} else {
			window.addEventListener('scroll', updateViewport, true);
		}
		scheduleVisiblePageRectUpdate();

		(async () => {
			try {
				await addPDF(pdfBlob);
				if (disposed) return;
				keyboardShortcuts.attach();
				scheduleVisiblePageRectUpdate();
			} catch (e) {
				toast.push(e instanceof Error ? e.message : String(e), { theme: TOAST_ERROR });
			}
		})();

		return () => {
			disposed = true;
			document.documentElement.classList.remove('pdf-editor-active');
			document.body.classList.remove('pdf-editor-active');
			window.removeEventListener('resize', updateViewport);
			if (scrollRoot) {
				scrollRoot.removeEventListener('scroll', updateViewport);
			} else {
				window.removeEventListener('scroll', updateViewport, true);
			}
			if (visiblePageRectFrame !== null) {
				cancelAnimationFrame(visiblePageRectFrame);
				visiblePageRectFrame = null;
			}
			if (pageRenderVisibilityFrame !== null) {
				cancelAnimationFrame(pageRenderVisibilityFrame);
				pageRenderVisibilityFrame = null;
			}
		};
	});

	async function addPDF(file: any) {
		try {
			pdfName = file?.name || 'document.pdf';
			const blob = file instanceof Blob ? file : new Blob([file], { type: 'application/pdf' });
			pdfFile = blob instanceof File ? blob : new File([blob], pdfName, { type: 'application/pdf' });
			pdfBuffer = await blob.arrayBuffer();
			pdfDocumentId = `pdf-editor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
			internalPage = currentPage;
			if (homework_info) {
				internalPage = parseInt(homework_info.from_page);
				minPage = parseInt(homework_info.from_page);
				maxPage = parseInt(homework_info.to_page);
			}
			hasCenteredInitialPage = false;
			initialCenterAttempts = 0;
			PDFReady = true;
		} catch (e) {
			toast.push('Failed to add PDF.', { theme: TOAST_ERROR });
			throw e;
		}
	}

	function syncEmbedPDFDocumentState(document: any) {
		if (!document) return false;

		const totalPages = document.pageCount || 1;
		if (pages.length !== totalPages) {
			pages = Array.from({ length: totalPages }, (_, index) => index + 1);
		}

		if (homework_info) {
			const fromPage = parseInt(homework_info.from_page);
			const toPage = parseInt(homework_info.to_page);
			const nextMaxPage = Math.max(1, Math.min(toPage, totalPages));
			const nextMinPage = Math.max(1, Math.min(fromPage, nextMaxPage));
			if (minPage !== nextMinPage) minPage = nextMinPage;
			if (maxPage !== nextMaxPage) maxPage = nextMaxPage;
		} else {
			if (minPage !== 1) minPage = 1;
			if (maxPage !== totalPages) maxPage = totalPages;
		}

		const nextPage = Math.max(minPage, Math.min(currentPage, maxPage));
		if (nextPage !== currentPage) {
			internalPage = nextPage;
			handlePageChange?.(nextPage);
		}

		const page = document.pages?.[Math.max(0, Math.min(nextPage - 1, totalPages - 1))];
		if (page?.size) {
			if (currentPageWidth !== page.size.width) currentPageWidth = page.size.width;
			if (currentPageHeight !== page.size.height) currentPageHeight = page.size.height;
		}

		return true;
	}

	// ADDING TEXT FUNCTIONS
	function addTextField(x: number, y: number) {
		if (!hasTool('text')) return;
		const id = genID();
		const object = confineObjectToPage({
			id,
			owner: user,
			type: 'text',
			size: 16,
			width: 0,
			lineHeight: 1,
			fontFamily: ctx.state.currentFont,
			fontColor: ctx.state._textColor,
			x: x,
			y: y - 15,
			lines: ['']
		});

		allObjects.push(object);

		// Add to history
		const command = new AddObjectCommand(object, allObjects, handleAnnotationChange);
		history.push(command);

		handleAnnotationChange();
	}

	function capitalizeFirstLetter(value: string) {
		const trimmed = String(value || '').trim();
		if (!trimmed) return 'Teacher';
		return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
	}

	function addTeacherMark() {
		if (!allowTeacherMark || isEditorDisabled) return;

		const width = 60;
		const height = 40;
		const visibleCenter =
			visiblePageRect?.width > 0 && visiblePageRect?.height > 0
				? {
						x: visiblePageRect.x + visiblePageRect.width / 2,
						y: visiblePageRect.y + visiblePageRect.height / 2
					}
				: { x: currentPageWidth / 2, y: currentPageHeight / 2 };

		const object = confineObjectToPage({
			id: genID(),
			owner: user,
			type: 'teacher-mark',
			x: visibleCenter.x - width / 2,
			y: visibleCenter.y - height / 2,
			width,
			height,
			markedBy: capitalizeFirstLetter(teacherMarkName),
			markedAt: new Date().toISOString(),
			label: 'Marked correct',
			stampColor: 'green',
			stampIcon: 'none',
			fontSize: 8
		});

		allObjects.push(object);
		allObjects.sort((a, b) => {
			const TYPE_ORDER: Record<string, number> = {
				drawing: 1,
				highlight: 1,
				line: 2,
				text: 3,
				'teacher-mark': 4
			};
			const orderA = TYPE_ORDER[a.type] || 0;
			const orderB = TYPE_ORDER[b.type] || 0;
			if (orderA !== orderB) return orderA - orderB;
			return 0;
		});

		history.push(new AddObjectCommand(object, allObjects, handleAnnotationChange));
		ctx.state.selectedObjectIds = [object.id];
		ctx.state.selectedTextId = null;
		ctx.state.selectedLineId = null;
		ctx.state.addingDrawing = false;
		ctx.state.isErasing = false;
		ctx.state.isHighlighting = false;
		ctx.state.isAddingLine = false;
		ctx.state.isPointerMode = false;
		ctx.state.isHandMode = false;
		ctx.state.isAddingText = false;
		ctx.state.isCursorMode = false;
		ctx.state.showingAddingText = false;
		ctx.state.isSelectionMode = true;
		handleAnnotationChange();
	}

	// ADDING DRAWINGS
	async function addDrawing(
		originWidth: number,
		originHeight: number,
		path: string,
		scale = 1,
		brushSize: number,
		brushColor: string,
		brushOpacity: number,
		type: 'drawing' | 'highlight' = 'drawing'
	) {
		if ((type === 'highlight' && !hasTool('highlighter')) || (type === 'drawing' && !hasTool('pen'))) return;
		const id = genID();
		const safePath = clampPathToPage(path, Math.max(brushSize || 1, 1) / 2);
		const opacity = Number(brushOpacity);
		const object = confineObjectToPage({
			id,
			owner: user,
			path: safePath,
			type,
			x: 0,
			y: 0,
			originWidth,
			originHeight,
			width: originWidth * scale,
			scale,
			rotation: 0,
			brushSize,
			brushColor,
			opacity: Number.isFinite(opacity) ? Math.max(0, Math.min(opacity, 1)) : type === 'highlight' ? 0.5 : 1
		});

		allObjects.push(object);
		allObjects.sort((a, b) => {
			const TYPE_ORDER: Record<string, number> = {
				drawing: 1,
				highlight: 1,
				line: 2,
				text: 3,
				'teacher-mark': 4
			};
			const orderA = TYPE_ORDER[a.type] || 0;
			const orderB = TYPE_ORDER[b.type] || 0;
			if (orderA !== orderB) return orderA - orderB;
			return 0;
		});

		// Add to history
		const command = new AddObjectCommand(object, allObjects, handleAnnotationChange);
		history.push(command);

		handleAnnotationChange();
	}

	// DELETE OBJECT BY ID
	const deleteObjectById = (id: string) => {
		const index = getObjectIndexById(id);
		if (index === -1) return;

		const foundObject = allObjects[index];
		if (foundObject.owner !== user) return;

		const removedObject = allObjects.splice(index, 1)[0];
		invalidateObjectVisualBoxCache(id);

		// Add to history
		const command = new DeleteObjectCommand(
			removedObject,
			index,
			allObjects,
			handleAnnotationChange
		);
		history.push(command);

		handleAnnotationChange();
	};

	// UPDATE OBJECT
	function updateObject(objectId: string, payload: Record<string, any>, skipHistory = false) {
		if (isEditorDisabled) return;
		const index = getObjectIndexById(objectId);
		if (index !== -1) {
			// Capture old state for undo
			const oldObject = allObjects[index];
			const nextObject = confineObjectToPage({ ...oldObject, ...payload });
			const oldState: Record<string, any> = {};
			const newState: Record<string, any> = {};
			const trackedKeys = new Set([
				...Object.keys(payload),
				'x',
				'y',
				'width',
				'height',
				'scale',
				'size',
				'rotation'
			]);

			// Only track the properties that are being changed
			trackedKeys.forEach((key) => {
				if (oldObject[key] !== nextObject[key]) {
					oldState[key] = oldObject[key];
					newState[key] = nextObject[key];
				}
			});

			if (Object.keys(newState).length === 0) return;

			// Update the object
			invalidateObjectVisualBoxCache(objectId);
			allObjects[index] = nextObject;

			// Add to history (unless explicitly skipped, e.g., during undo/redo)
			if (!skipHistory) {
				const command = new UpdateObjectCommand(
					objectId,
					oldState,
					newState,
					allObjects,
					handleAnnotationChange
				);
				history.push(command);
			}

			handleAnnotationChange();
		}
	}

	function deleteObject(objectId: string) {
		if (isEditorDisabled) return;
		const index = getObjectIndexById(objectId);
		if (index !== -1) {
			const removedObject = allObjects.splice(index, 1)[0];
			invalidateObjectVisualBoxCache(objectId);

			// Add to history
			const command = new DeleteObjectCommand(
				removedObject,
				index,
				allObjects,
				handleAnnotationChange
			);
			history.push(command);

			handleAnnotationChange();
		}
	}

	// SAVE PDF
	let saving = $state(false);
	async function savePDF() {
		if (!pdfFile || saving || !pages.length) return;
		saving = true;
		try {
			const exportObjects = getAllPageAnnotations?.(allObjects, internalPage) ?? allObjects;
			await save(pdfFile, exportObjects, pdfName, { currentPage: internalPage });
		} catch (e) {
			toast.push(e instanceof Error ? e.message : String(e), { theme: TOAST_ERROR });
		} finally {
			saving = false;
		}
	}

	// UNDO/REDO - Now using command-based history
	const handleUndo = () => {
		if (history.canUndo()) {
			history.undo();
			// handleAnnotationChange is called by the command's undo method
		}
	};

	const handleRedo = () => {
		if (history.canRedo()) {
			history.redo();
			// handleAnnotationChange is called by the command's redo method
		}
	};

	// Initialize keyboard shortcuts with actions
	const keyboardShortcuts = useKeyboardShortcuts(
		modes,
		{
			onUndo: handleUndo,
			onRedo: handleRedo,
			onSave: handleSaveFirst
		},
		ctx
	);

	async function handlePageInput(event) {
		const value = event.target.value;

		if (value === '') {
			inputValue = '';
			return;
		}

		const numValue = parseInt(value, 10);
		inputValue = value;

		if (!isNaN(numValue)) {
			const nextPage = Math.max(minPage, Math.min(numValue, maxPage));

			if (nextPage === internalPage) {
				return;
			}

			if (saveState.hasUnsavedChanges) {
				try {
					await handleSaveFirst();
				} catch {
					inputValue = internalPage.toString();
					return;
				}
			}

			internalPage = nextPage;
		}
	}

	function handleBlur() {
		inputValue = internalPage.toString();
	}

	// Page Index for AllObjects
	let selectedPageIndex = $derived(currentPage - 1);

	// Check page disabled
	function isPageDisdabledFunction(disabled_pages, currentPage) {
		return disabled_pages.some(
			(range) => currentPage >= range.from_page && currentPage <= range.to_page
		);
	}

	let isPageDisabled = $derived(isPageDisdabledFunction(disabled_pages, currentPage));

	// Global disabled state (combines global disabled prop with page-specific disabled)
	let isEditorDisabled = $derived(disabled || isPageDisabled);

	$effect(() => {
		ctx.state.isPageDisabled = isEditorDisabled;
	});

	let pageContentLayer: HTMLElement | undefined = $state();
	let selectionResizeState: any = $state(null);
	let selectionRotationState: any = $state(null);
	let isLassoSelecting = $state(false);
	let dragOriginalBoxes = new Map<string, any>();
	let previewedSelectionObjectId: string | null = $state(null);

	function isObjectEditable(obj) {
		return obj?.owner === user || obj?.owner === `global-${user}`;
	}

	function getDrawingPathBBox(obj) {
		return getPathGeometry(obj.path || '').bbox;
	}

	function getDrawingVisualBox(obj) {
		const pathBBox = getDrawingPathBBox(obj);
		if (!pathBBox) return null;

		const scale = obj.scale ?? obj.width / obj.originWidth ?? 1;
		const box = getTransformedDrawingBBox(obj, pathBBox, scale, obj.rotation || 0);
		const strokePadding = Math.max((obj.brushSize || 1) * Math.abs(scale), 1) / 2;

		return {
			x: box.x - strokePadding,
			y: box.y - strokePadding,
			width: box.width + strokePadding * 2,
			height: box.height + strokePadding * 2,
			pathBBox
		};
	}

	function getObjectVisualBoxCacheKey(obj) {
		if (obj.type === 'drawing') {
			return [
				obj.type,
				obj.path,
				obj.x,
				obj.y,
				obj.width,
				obj.scale,
				obj.rotation,
				obj.brushSize,
				obj.originWidth,
				obj.originHeight
			].join('|');
		}

		if (obj.type === 'line') {
			return [obj.type, obj.x, obj.y, obj.width, obj.height, obj.strokeWidth].join('|');
		}

		if (obj.type === 'text') {
			return [
				obj.type,
				obj.x,
				obj.y,
				obj.width,
				obj.size,
				obj.lineHeight,
				obj.lines?.length
			].join('|');
		}

		if (obj.type === 'teacher-mark') {
			return [
				obj.type,
				obj.x,
				obj.y,
				obj.width,
				obj.height,
				obj.markedBy,
				obj.markedAt,
				obj.label,
				obj.stampColor,
				obj.stampIcon,
				obj.fontSize
			].join('|');
		}

		return [obj.type, obj.x, obj.y, obj.width, obj.height].join('|');
	}

	function getObjectVisualBox(obj) {
		if (!obj) return null;

		const cacheKey = getObjectVisualBoxCacheKey(obj);
		if (obj.id) {
			const cached = objectVisualBoxCache.get(obj.id);
			if (cached?.key === cacheKey) return cached.box;
		}

		let box = null;

		if (obj.type === 'drawing') {
			box = getDrawingVisualBox(obj);
		} else if (obj.type === 'line') {
			const strokePadding = Math.max((obj.strokeWidth || 2) / 2, 1);
			const x1 = obj.x;
			const y1 = obj.y;
			const x2 = obj.x + obj.width;
			const y2 = obj.y + obj.height;

			box = {
				x: Math.min(x1, x2) - strokePadding,
				y: Math.min(y1, y2) - strokePadding,
				width: Math.abs(x2 - x1) + strokePadding * 2,
				height: Math.abs(y2 - y1) + strokePadding * 2
			};
		} else if (obj.type === 'text') {
			box = {
				x: obj.x - 4,
				y: obj.y - 4,
				width: (obj.width || 100) + 8,
				height: (obj.lines?.length || 1) * (obj.size || 16) * (obj.lineHeight || 1.2) + 8
			};
		} else if (obj.type === 'teacher-mark') {
			box = {
				x: obj.x - 4,
				y: obj.y - 4,
				width: (obj.width || 60) + 4,
				height: (obj.height || 40) + 4
			};
		}

		if (obj.id) {
			objectVisualBoxCache.set(obj.id, { key: cacheKey, box });
		}

		return box;
	}

	function boxesIntersect(a, b) {
		return (
			a.x <= b.x + b.width &&
			a.x + a.width >= b.x &&
			a.y <= b.y + b.height &&
			a.y + a.height >= b.y
		);
	}

	function clampNumber(value, min, max) {
		const safeValue = Number.isFinite(value) ? value : min;
		if (min > max) return (min + max) / 2;
		return Math.max(min, Math.min(safeValue, max));
	}

	function roundPageValue(value) {
		const rounded = Math.round(value * 100) / 100;
		return Object.is(rounded, -0) ? 0 : rounded;
	}

	function clampPathToPage(path: string, padding = 0) {
		const minX = Math.min(padding, currentPageWidth / 2);
		const minY = Math.min(padding, currentPageHeight / 2);
		const maxX = Math.max(currentPageWidth - padding, minX);
		const maxY = Math.max(currentPageHeight - padding, minY);

		return path.replace(/([ML])(-?\d*\.?\d+),(-?\d*\.?\d+)/gi, (_match, command, x, y) => {
			return `${command}${roundPageValue(clampNumber(parseFloat(x), minX, maxX))},${roundPageValue(
				clampNumber(parseFloat(y), minY, maxY)
			)}`;
		});
	}

	function getFallbackObjectBox(obj) {
		if (!obj) return null;

		const width = Math.abs(obj.width ?? obj.originWidth ?? 1);
		const height = Math.abs(obj.height ?? obj.originHeight ?? obj.size ?? 1);

		return {
			x: Math.min(obj.x ?? 0, (obj.x ?? 0) + (obj.width ?? width)),
			y: Math.min(obj.y ?? 0, (obj.y ?? 0) + (obj.height ?? height)),
			width,
			height
		};
	}

	function getObjectBoundaryBox(obj) {
		return getObjectVisualBox(obj) || getFallbackObjectBox(obj);
	}

	function getBoxConfinementDelta(box) {
		if (!box) return { x: 0, y: 0 };

		const targetX =
			box.width > currentPageWidth
				? (currentPageWidth - box.width) / 2
				: clampNumber(box.x, 0, currentPageWidth - box.width);
		const targetY =
			box.height > currentPageHeight
				? (currentPageHeight - box.height) / 2
				: clampNumber(box.y, 0, currentPageHeight - box.height);

		return {
			x: targetX - box.x,
			y: targetY - box.y
		};
	}

	function getBoxesConfinementDelta(boxes) {
		const combinedBox = combineBoxes(boxes.filter(Boolean));
		return getBoxConfinementDelta(combinedBox);
	}

	function getClampedMoveDelta(boxes, dx, dy) {
		const movedBoxes = boxes.map((box) => ({
			...box,
			x: box.x + dx,
			y: box.y + dy
		}));
		const correction = getBoxesConfinementDelta(movedBoxes);

		return {
			x: dx + correction.x,
			y: dy + correction.y
		};
	}

	function limitObjectSizeToPage(obj) {
		const candidate = { ...obj };
		const box = getObjectBoundaryBox(candidate);
		if (!box || (box.width <= currentPageWidth && box.height <= currentPageHeight)) {
			return candidate;
		}

		const fitScale = Math.min(
			1,
			box.width > 0 ? currentPageWidth / box.width : 1,
			box.height > 0 ? currentPageHeight / box.height : 1
		);

		if (fitScale >= 1) return candidate;

		if (candidate.type === 'drawing') {
			const currentScale =
				candidate.scale ?? candidate.width / candidate.originWidth ?? 1;
			const nextScale = Math.max(0.01, currentScale * fitScale);
			candidate.scale = nextScale;
			candidate.width = candidate.originWidth * nextScale;
		} else if (candidate.type === 'line') {
			candidate.width = (candidate.width || 0) * fitScale;
			candidate.height = (candidate.height || 0) * fitScale;
		} else if (candidate.type === 'text') {
			candidate.width = Math.max(1, (candidate.width || 100) * fitScale);
			candidate.size = normalizeFontSize((candidate.size || 16) * fitScale);
		} else if (candidate.type === 'teacher-mark') {
			candidate.width = Math.max(48, (candidate.width || 60) * fitScale);
			candidate.height = candidate.height || 40;
		}

		return candidate;
	}

	function confineObjectToPage(obj) {
		const candidate = limitObjectSizeToPage(obj);
		const box = getObjectBoundaryBox(candidate);
		const delta = getBoxConfinementDelta(box);

		return {
			...candidate,
			x: roundPageValue((candidate.x || 0) + delta.x),
			y: roundPageValue((candidate.y || 0) + delta.y)
		};
	}

	function getTeacherMarkDisplayDate(value: string) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value || '';

		return date.toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getTeacherMarkContentSize(object, fontSize: number) {
		const label = String(object?.label || 'Marked correct').toUpperCase();
		const markedBy = `Stamped by ${capitalizeFirstLetter(object?.markedBy || 'Teacher')}`;
		const markedAt = getTeacherMarkDisplayDate(object?.markedAt || object?.updatedAt || new Date().toISOString());
		const metaFontSize = fontSize * 0.68;
		const labelWidth = label.length * fontSize * 0.62;
		const nameWidth = markedBy.length * metaFontSize * 0.5;
		const timeWidth = markedAt.length * metaFontSize * 0.5;
		const iconWidth = object?.stampIcon && object.stampIcon !== 'none' ? fontSize * 1.8 + 2 : 0;
		const width = Math.max(30, Math.ceil(Math.max(labelWidth, nameWidth, timeWidth) + iconWidth + 8));
		const height = Math.max(16, Math.ceil(fontSize + metaFontSize * 2.1 + 4));

		return { width, height };
	}

	function getTeacherMarkUpdatePayload(object, payload: Record<string, any>) {
		const hasFontSize = Object.prototype.hasOwnProperty.call(payload, 'fontSize');
		const hasStampIcon = Object.prototype.hasOwnProperty.call(payload, 'stampIcon');
		if (!hasFontSize && !hasStampIcon) return payload;

		const currentFontSize = Math.max(4, Math.min(Number(object?.fontSize || 8), 24));
		const nextFontSize = Math.max(4, Math.min(Math.round(Number(payload.fontSize) || 8), 24));
		if (hasFontSize && !hasStampIcon && nextFontSize === currentFontSize) {
			return { ...payload, fontSize: nextFontSize };
		}

		const currentWidth = object.width || 60;
		const currentHeight = object.height || 40;

		if (hasStampIcon && !hasFontSize) {
			const currentHasIcon = Boolean(object?.stampIcon && object.stampIcon !== 'none');
			const nextHasIcon = Boolean(payload.stampIcon && payload.stampIcon !== 'none');
			if (currentHasIcon === nextHasIcon) return payload;

			const iconWidth = currentFontSize * 1.8 + 2;
			const nextWidth = Math.max(48, currentWidth + (nextHasIcon ? iconWidth : -iconWidth));

			return {
				...payload,
				x: roundPageValue((object.x || 0) + (currentWidth - nextWidth) / 2),
				width: roundPageValue(nextWidth)
			};
		}

		const contentSize = getTeacherMarkContentSize({ ...object, ...payload }, nextFontSize);
		const defaultScale = nextFontSize / 8;
		const nextWidth = Math.max(contentSize.width, Math.round(60 * defaultScale));
		const nextHeight = contentSize.height;

		return {
			...payload,
			fontSize: nextFontSize,
			x: roundPageValue((object.x || 0) + (currentWidth - nextWidth) / 2),
			y: roundPageValue((object.y || 0) + (currentHeight - nextHeight) / 2),
			width: roundPageValue(nextWidth),
			height: roundPageValue(nextHeight)
		};
	}

	function updateTeacherMark(object, payload: Record<string, any>) {
		updateObject(object.id, getTeacherMarkUpdatePayload(object, payload));
	}

	function shouldAlwaysRenderObject(obj) {
		return (
			isSelectedObjectId(obj.id) ||
			previewedSelectionObjectId === obj.id ||
			ctx.state.selectedTextId === obj.id ||
			ctx.state.editingTextId === obj.id ||
			ctx.state.selectedLineId === obj.id
		);
	}

	function isObjectVisible(obj) {
		if (shouldAlwaysRenderObject(obj)) return true;

		const box = getObjectVisualBox(obj);
		if (!box) return true;

		return boxesIntersect(box, visiblePageRect);
	}

	let currentPageObjects = $derived(allObjects);

	function isAnnotationCanvasBackingScaleCapped() {
		if (shouldUseAnnotationVectorRendering(annotationRenderZoom)) return true;

		const dpr = getCappedDevicePixelRatio();
		const targetScale = dpr * Math.max(annotationRenderZoom || 1, 0.1);
		const maxBackingScale = getAnnotationCanvasMaxBackingScale();
		const backingScale = getAnnotationCanvasBackingScale(
			currentPageWidth,
			currentPageHeight,
			annotationRenderZoom,
			dpr
		);

		return backingScale < Math.min(targetScale, maxBackingScale) * 0.9;
	}

	function shouldRenderObjectOnCanvas(object, backingScaleCapped = isAnnotationCanvasBackingScaleCapped()) {
		if (object.type !== 'drawing' && object.type !== 'highlight') return false;
		if (object._eraserHighlight) return false;
		if (backingScaleCapped) return false;
		if (isSelectedObjectId(object.id) || isObjectPreviewed(object.id)) return false;
		return true;
	}

	function shouldRenderObjectOnScreen(object) {
		if (object.type !== 'drawing' && object.type !== 'highlight') return false;
		return shouldUseAnnotationVectorRendering(annotationRenderZoom);
	}

	let visibleObjectGroups = $derived.by(() => {
		const visibleObjects = useVisibleObjectRendering
			? currentPageObjects.filter(isObjectVisible)
			: currentPageObjects;
		const canvasObjects: any[] = [];
		const interactiveObjects: any[] = [];
		const screenObjects: any[] = [];
		const backingScaleCapped = isAnnotationCanvasBackingScaleCapped();

		for (const object of visibleObjects) {
			if (shouldRenderObjectOnScreen(object)) {
				screenObjects.push(object);
			} else if (shouldRenderObjectOnCanvas(object, backingScaleCapped)) {
				canvasObjects.push(object);
			} else {
				interactiveObjects.push(object);
			}
		}

		return { visibleObjects, canvasObjects, interactiveObjects, screenObjects };
	});
	let visibleCurrentPageObjects = $derived(visibleObjectGroups.visibleObjects);
	let canvasDrawableObjects = $derived(visibleObjectGroups.canvasObjects);
	let interactiveCurrentPageObjects = $derived(visibleObjectGroups.interactiveObjects);
	let screenCurrentPageObjects = $derived(visibleObjectGroups.screenObjects);

	function getAdjacentPageObjects(pageNo: number) {
		const annotations = adjacentPageAnnotations?.[pageNo];
		if (Array.isArray(annotations)) return annotations;
		return annotations?.merged || [];
	}

	function clampAdjacentPagePreviewCount(value: number) {
		return Math.min(6, Math.max(1, Math.round(value)));
	}

	function getAdjacentPreviewSlots() {
		const availableLeft = Math.max(0, currentPage - minPage);
		const availableRight = Math.max(0, maxPage - currentPage);

		if (adjacentPagePreviewCount === 1) {
			return {
				left: Math.min(availableLeft, 1),
				right: 0
			};
		}

		const desiredLeft = Math.floor(adjacentPagePreviewCount / 2);
		const desiredRight = adjacentPagePreviewCount - desiredLeft;
		const missingLeft = Math.max(0, desiredLeft - availableLeft);
		const missingRight = Math.max(0, desiredRight - availableRight);

		return {
			left: Math.min(availableLeft, desiredLeft + missingRight),
			right: Math.min(availableRight, desiredRight + missingLeft)
		};
	}

	let leftAdjacentPreviewPages = $derived.by(() => {
		if (!adjacentPagePreviewEnabled) return [];

		const { left } = getAdjacentPreviewSlots();
		const pageNumbers: number[] = [];

		for (let offset = left; offset >= 1; offset -= 1) {
			pageNumbers.push(currentPage - offset);
		}

		return pageNumbers;
	});

	let rightAdjacentPreviewPages = $derived.by(() => {
		if (!adjacentPagePreviewEnabled) return [];

		const { right } = getAdjacentPreviewSlots();
		const pageNumbers: number[] = [];

		for (let offset = 1; offset <= right; offset += 1) {
			pageNumbers.push(currentPage + offset);
		}

		return pageNumbers;
	});

	let minimapPageObjects = $derived.by(() => {
		if (!minimapAnnotationsEnabled) return {};

		const objectsByPage: Record<number, any[]> = {
			[currentPage]: allObjects
		};

		for (const pageNo of [...leftAdjacentPreviewPages, ...rightAdjacentPreviewPages]) {
			objectsByPage[pageNo] = getAdjacentPageObjects(pageNo);
		}

		return objectsByPage;
	});

	function handleAdjacentPagePreviewCountChange(value: number) {
		adjacentPagePreviewCount = clampAdjacentPagePreviewCount(value);
		localStorage.setItem(
			'pdf-editor-adjacent-page-preview-count',
			String(adjacentPagePreviewCount)
		);
		scheduleVisiblePageRectUpdate();
		if (adjacentPagePreviewLayout === 'column') {
			tick().then(() => requestAnimationFrame(centerEditablePageInViewport));
		}
	}

	function handleAdjacentPagePreviewLayoutChange(value: 'row' | 'column') {
		adjacentPagePreviewLayout = value;
		localStorage.setItem('pdf-editor-adjacent-page-preview-layout', value);
		scheduleVisiblePageRectUpdate();
		tick().then(() => requestAnimationFrame(centerEditablePageInViewport));
	}

	function handleToggleVisibleObjectRendering() {
		useVisibleObjectRendering = !useVisibleObjectRendering;
		localStorage.setItem(
			'pdf-editor-visible-object-rendering-enabled',
			String(useVisibleObjectRendering)
		);
		scheduleVisiblePageRectUpdate();
	}

	function handleToggleMinimapAnnotations() {
		minimapAnnotationsEnabled = !minimapAnnotationsEnabled;
		localStorage.setItem(
			'pdf-editor-minimap-annotations-enabled',
			String(minimapAnnotationsEnabled)
		);
	}

	async function handleToggleAdjacentPagePreview() {
		const hadLeftPreview = adjacentPagePreviewEnabled && currentPage > minPage;
		const nextEnabled = !adjacentPagePreviewEnabled;
		const willHaveLeftPreview = nextEnabled && currentPage > minPage;

		adjacentPagePreviewEnabled = nextEnabled;
		localStorage.setItem(
			'pdf-editor-adjacent-page-preview-enabled',
			String(adjacentPagePreviewEnabled)
		);

		await tick();

		if (
			typeof window !== 'undefined' &&
			adjacentPagePreviewLayout === 'row' &&
			hadLeftPreview !== willHaveLeftPreview
		) {
			const direction = willHaveLeftPreview ? 1 : -1;
			scrollEditorBy(
				direction * (currentPageWidth * ctx.state.zoom + ADJACENT_PAGE_GAP_PX),
				0,
				'instant' as ScrollBehavior
			);
		}

		if (adjacentPagePreviewLayout === 'column') {
			requestAnimationFrame(centerEditablePageInViewport);
		}

		scheduleVisiblePageRectUpdate();
	}

	function isWorkspacePanIgnoredTarget(target: EventTarget | null) {
		if (typeof Element === 'undefined' || !(target instanceof Element)) return false;

		return Boolean(
			target.closest(
				'button, a, input, textarea, select, [role="button"], [contenteditable="true"], [data-pan-ignore="true"]'
			)
		);
	}

	function handleWorkspaceMouseDown(event: MouseEvent) {
		if (drawingInputActive) {
			event.preventDefault();
			return;
		}
		if (!ctx.state.isHandMode || event.defaultPrevented || event.button !== 0) return;
		if (isWorkspacePanIgnoredTarget(event.target)) return;

		event.preventDefault();
		zoomPan.startPanning(event);
	}

	function handleWorkspaceTouchStart(event: TouchEvent) {
		if (drawingInputActive && !ctx.state.isHandMode) {
			if (event.touches.length < 2 && event.cancelable) event.preventDefault();
			return;
		}

		if (!ctx.state.isHandMode || event.defaultPrevented) return;
		if (isWorkspacePanIgnoredTarget(event.target)) return;

		zoomPan.onDoubleTap(event);
		zoomPan.startPanningTouch(event);
	}

	function handleWorkspaceTouchMove(event: TouchEvent) {
		if (event.defaultPrevented) return;

		if (drawingInputActive && !ctx.state.isHandMode && event.touches.length !== 2) {
			if (event.cancelable) event.preventDefault();
			return;
		}

		if (ctx.state.isHandMode && event.touches.length === 1) {
			if (event.cancelable) event.preventDefault();
			zoomPan.handlePanningTouch(event);
			return;
		}

		if (event.touches.length === 2) {
			zoomPan.onTouchMove(event);
		}
	}

	function nonpassiveTouchMove(node: HTMLElement, handler: (event: TouchEvent) => void) {
		node.addEventListener('touchmove', handler, { passive: false });

		return {
			update(nextHandler: (event: TouchEvent) => void) {
				if (nextHandler === handler) return;

				node.removeEventListener('touchmove', handler);
				handler = nextHandler;
				node.addEventListener('touchmove', handler, { passive: false });
			},
			destroy() {
				node.removeEventListener('touchmove', handler);
			}
		};
	}

	function nonpassiveTouchStart(node: HTMLElement, handler: (event: TouchEvent) => void) {
		node.addEventListener('touchstart', handler, { passive: false });

		return {
			update(nextHandler: (event: TouchEvent) => void) {
				if (nextHandler === handler) return;

				node.removeEventListener('touchstart', handler);
				handler = nextHandler;
				node.addEventListener('touchstart', handler, { passive: false });
			},
			destroy() {
				node.removeEventListener('touchstart', handler);
			}
		};
	}

	function combineBoxes(boxes) {
		if (boxes.length === 0) return null;

		const left = Math.min(...boxes.map((box) => box.x));
		const top = Math.min(...boxes.map((box) => box.y));
		const right = Math.max(...boxes.map((box) => box.x + box.width));
		const bottom = Math.max(...boxes.map((box) => box.y + box.height));

		return {
			x: left,
			y: top,
			width: right - left,
			height: bottom - top
		};
	}

	let resizableSelectedObjects = $derived.by(() =>
		ctx.state.selectedObjectIds
			.map((id) => getObjectById(id))
			.filter(
				(obj) =>
					obj &&
					isObjectEditable(obj) &&
					['drawing', 'line', 'text', 'teacher-mark'].includes(obj.type)
			)
	);

	let rotatableSelectedDrawingObjects = $derived.by(() =>
		ctx.state.selectedObjectIds
			.map((id) => getObjectById(id))
			.filter((obj) => obj && isObjectEditable(obj) && obj.type === 'drawing')
	);

	let selectionToolbarObjects = $derived.by(() =>
		ctx.state.selectedObjectIds
			.map((id) => getObjectById(id))
			.filter(Boolean)
			.map((obj) => ({
				id: obj.id,
				type: obj.type,
				canDelete: obj.owner === user
			}))
	);

	let selectedTeacherMark = $derived.by(() => {
		if (!allowTeacherMark || ctx.state.selectedObjectIds.length !== 1) return null;
		const object = getObjectById(ctx.state.selectedObjectIds[0]);
		return object?.type === 'teacher-mark' && isObjectEditable(object) ? object : null;
	});

	$effect(() => {
		if (
			previewedSelectionObjectId &&
			!isSelectedObjectId(previewedSelectionObjectId)
		) {
			previewedSelectionObjectId = null;
		}
	});

	let selectionResizeBox = $derived.by(() => {
		if (
			!ctx.state.isSelectionMode ||
			isLassoSelecting ||
			resizableSelectedObjects.length === 0
		)
			return null;
		return combineBoxes(resizableSelectedObjects.map(getObjectVisualBox).filter(Boolean));
	});

	function getPagePoint(event) {
		if (!pageContentLayer) return null;

		const rect = pageContentLayer.getBoundingClientRect();
		return {
			x: (event.clientX - rect.left) / ctx.state.zoom,
			y: (event.clientY - rect.top) / ctx.state.zoom
		};
	}

	function clampSelectionScale(value) {
		return Math.max(0.1, Math.min(value, 10));
	}

	function normalizeFontSize(value) {
		return Math.max(1, Math.round(Number(value) || 16));
	}

	function snapshotResizableObject(obj) {
		return {
			id: obj.id,
			type: obj.type,
			object: { ...obj },
			bounds: getObjectVisualBox(obj)
		};
	}

	const defaultResizeHandleConfigs = [
		{ anchor: 'top-left', cursor: 'nwse-resize', x: 0, y: 0 },
		{ anchor: 'top-right', cursor: 'nesw-resize', x: 1, y: 0 },
		{ anchor: 'bottom-left', cursor: 'nesw-resize', x: 0, y: 1 },
		{ anchor: 'bottom-right', cursor: 'nwse-resize', x: 1, y: 1 }
	];

	const horizontalResizeHandleConfigs = [
		{ anchor: 'left', cursor: 'ew-resize', x: 0, y: 0.5 },
		{ anchor: 'right', cursor: 'ew-resize', x: 1, y: 0.5 }
	];

	let resizeHandleConfigs = $derived(
		selectedTeacherMark ? horizontalResizeHandleConfigs : defaultResizeHandleConfigs
	);

	function getResizeHandlePoint(box, anchor) {
		const x = anchor.includes('right') ? box.x + box.width : box.x;
		const y =
			anchor === 'left' || anchor === 'right'
				? box.y + box.height / 2
				: anchor.includes('bottom')
					? box.y + box.height
					: box.y;
		return { x, y };
	}

	function getOppositeResizeAnchor(anchor) {
		return anchor
			.replace('top', 'temporary')
			.replace('bottom', 'top')
			.replace('temporary', 'bottom')
			.replace('left', 'temporary')
			.replace('right', 'left')
			.replace('temporary', 'right');
	}

	function getResizeScale(point, state) {
		const fixedPoint = state.fixedPoint;
		if (state.anchor === 'left' || state.anchor === 'right') {
			const startDistance = Math.max(Math.abs(state.startPoint.x - fixedPoint.x), 1);
			const currentDistance = Math.max(Math.abs(point.x - fixedPoint.x), 1);
			return clampSelectionScale(currentDistance / startDistance);
		}

		const startDistance = Math.max(
			Math.hypot(state.startPoint.x - fixedPoint.x, state.startPoint.y - fixedPoint.y),
			1
		);
		const currentDistance = Math.max(Math.hypot(point.x - fixedPoint.x, point.y - fixedPoint.y), 1);
		return clampSelectionScale(currentDistance / startDistance);
	}

	function getScaledPoint(value, origin, scale) {
		return origin + (value - origin) * scale;
	}

	function getScaledBoxFromFixedPoint(box, fixedPoint, scale) {
		const x1 = getScaledPoint(box.x, fixedPoint.x, scale);
		const y1 = getScaledPoint(box.y, fixedPoint.y, scale);
		const x2 = getScaledPoint(box.x + box.width, fixedPoint.x, scale);
		const y2 = getScaledPoint(box.y + box.height, fixedPoint.y, scale);

		return {
			x: Math.min(x1, x2),
			y: Math.min(y1, y2),
			width: Math.abs(x2 - x1),
			height: Math.abs(y2 - y1)
		};
	}

	function getHorizontallyScaledBoxFromFixedPoint(box, fixedPoint, scale) {
		const x1 = getScaledPoint(box.x, fixedPoint.x, scale);
		const x2 = getScaledPoint(box.x + box.width, fixedPoint.x, scale);

		return {
			x: Math.min(x1, x2),
			y: box.y,
			width: Math.abs(x2 - x1),
			height: box.height
		};
	}

	function doesBoxFitPage(box) {
		return (
			box.x >= 0 &&
			box.y >= 0 &&
			box.x + box.width <= currentPageWidth &&
			box.y + box.height <= currentPageHeight
		);
	}

	function clampResizeScaleToPage(scale, state) {
		if (!state?.box || !state?.fixedPoint) return scale;

		const isHorizontalResize = state.anchor === 'left' || state.anchor === 'right';
		const targetBox = isHorizontalResize
			? getHorizontallyScaledBoxFromFixedPoint(state.box, state.fixedPoint, scale)
			: getScaledBoxFromFixedPoint(state.box, state.fixedPoint, scale);
		if (doesBoxFitPage(targetBox)) return scale;

		let low = 0.1;
		let high = Math.max(scale, low);

		for (let i = 0; i < 12; i += 1) {
			const mid = (low + high) / 2;
			const midBox = isHorizontalResize
				? getHorizontallyScaledBoxFromFixedPoint(state.box, state.fixedPoint, mid)
				: getScaledBoxFromFixedPoint(state.box, state.fixedPoint, mid);

			if (doesBoxFitPage(midBox)) {
				low = mid;
			} else {
				high = mid;
			}
		}

		return low;
	}

	function applySelectionResize(scale) {
		if (!selectionResizeState) return;

		scale = clampResizeScaleToPage(scale, selectionResizeState);
		const { objects, fixedPoint } = selectionResizeState;
		let didResize = false;
		const candidates: Array<{ index: number; object: any }> = [];

		objects.forEach((entry) => {
			const index = getObjectIndexById(entry.id);
			if (index === -1 || !entry.bounds) return;

			const original = entry.object;
			const bounds = entry.bounds;

			if (original.type === 'drawing') {
				const pathBBox = getDrawingPathBBox(original);
				if (!pathBBox) return;

				const originalScale = original.scale ?? original.width / original.originWidth ?? 1;
				const nextScale = originalScale * scale;
				const localBox = getTransformedDrawingBBox(
					{ ...original, x: 0, y: 0, scale: nextScale },
					pathBBox,
					nextScale,
					original.rotation || 0
				);
				const nextVisualX = getScaledPoint(bounds.x, fixedPoint.x, scale);
				const nextVisualY = getScaledPoint(bounds.y, fixedPoint.y, scale);

				const candidate = limitObjectSizeToPage({
					...allObjects[index],
					x: nextVisualX - localBox.x,
					y: nextVisualY - localBox.y,
					scale: nextScale,
					width: original.originWidth * nextScale
				});
				candidates.push({ index, object: candidate });
				didResize = true;
			} else if (original.type === 'line') {
				const candidate = limitObjectSizeToPage({
					...allObjects[index],
					x: getScaledPoint(original.x, fixedPoint.x, scale),
					y: getScaledPoint(original.y, fixedPoint.y, scale),
					width: original.width * scale,
					height: original.height * scale
				});
				candidates.push({ index, object: candidate });
				didResize = true;
			} else if (original.type === 'text') {
				const nextSize = normalizeFontSize((original.size || 16) * scale);
				const candidate = limitObjectSizeToPage({
					...allObjects[index],
					x: getScaledPoint(original.x, fixedPoint.x, scale),
					y: getScaledPoint(original.y, fixedPoint.y, scale),
					width: (original.width || 100) * scale,
					size: nextSize
				});
				candidates.push({ index, object: candidate });
				if (ctx.state.selectedObjectIds.length === 1 && ctx.state.selectedObjectIds[0] === original.id) {
					ctx.state._size = candidate.size;
				}
				didResize = true;
			} else if (original.type === 'teacher-mark') {
				const candidate = limitObjectSizeToPage({
					...allObjects[index],
					x: getScaledPoint(original.x, fixedPoint.x, scale),
					y: original.y,
					width: Math.max(48, (original.width || 60) * scale),
					height: original.height || 40
				});
				candidates.push({ index, object: candidate });
				didResize = true;
			}
		});

		if (didResize) {
			const delta = getBoxesConfinementDelta(
				candidates.map(({ object }) => getObjectBoundaryBox(object))
			);

			candidates.forEach(({ index, object }) => {
				invalidateObjectVisualBoxCache(object.id);
				allObjects[index] = {
					...object,
					x: roundPageValue((object.x || 0) + delta.x),
					y: roundPageValue((object.y || 0) + delta.y)
				};
			});
			allObjects = [...allObjects];
		}
	}

	function restoreSelectionResizeOriginals() {
		if (!selectionResizeState) return;

		let didRestore = false;
		selectionResizeState.objects.forEach((entry) => {
			const index = getObjectIndexById(entry.id);
			if (index !== -1) {
				invalidateObjectVisualBoxCache(entry.id);
				allObjects[index] = { ...entry.object };
				didRestore = true;
			}
		});

		if (didRestore) {
			allObjects = [...allObjects];
		}
	}

	function getResizeTrackedKeys(type) {
		if (type === 'drawing') return ['x', 'y', 'scale', 'width', 'rotation'];
		if (type === 'line') return ['x', 'y', 'width', 'height'];
		if (type === 'text') return ['x', 'y', 'width', 'size'];
		if (type === 'teacher-mark') return ['x', 'width'];
		return [];
	}

	function commitSelectionResize() {
		if (!selectionResizeState) return;

		const updates: any[] = [];

		selectionResizeState.objects.forEach((entry) => {
			const current = getObjectById(entry.id);
			if (!current) return;

			const oldState: Record<string, any> = {};
			const newState: Record<string, any> = {};

			getResizeTrackedKeys(entry.type).forEach((key) => {
				if (entry.object[key] !== current[key]) {
					oldState[key] = entry.object[key];
					newState[key] = current[key];
				}
			});

			if (Object.keys(newState).length > 0) {
				updates.push({ objectId: entry.id, oldState, newState });
			}
		});

		if (updates.length > 0) {
			history.push(new BatchUpdateObjectsCommand(updates, allObjects, handleAnnotationChange));
			handleAnnotationChange();
		}
	}

	function handleSelectionInteractionAbort() {
		if (selectionResizeState) {
			restoreSelectionResizeOriginals();
			cleanupSelectionResize();
		}

		if (selectionRotationState) {
			restoreSelectionRotationOriginals();
			cleanupSelectionRotation();
		}
	}

	function handleSelectionInteractionVisibilityChange() {
		if (typeof document !== 'undefined' && document.hidden) {
			handleSelectionInteractionAbort();
		}
	}

	$effect(() => {
		if (!selectionResizeState && !selectionRotationState) return;
		if (ctx.state.isSelectionMode && ctx.state.selectedObjectIds.length > 0 && !isEditorDisabled) {
			return;
		}

		handleSelectionInteractionAbort();
	});

	function cleanupSelectionResize() {
		const activeResize = selectionResizeState;
		selectionResizeState = null;
		try {
			activeResize?.pointerTarget?.releasePointerCapture?.(activeResize.pointerId);
		} catch {}
		activeResize?.pointerTarget?.removeEventListener?.('pointerup', handleSelectionResizeEnd);
		activeResize?.pointerTarget?.removeEventListener?.('pointercancel', handleSelectionResizeCancel);
		activeResize?.pointerTarget?.removeEventListener?.(
			'lostpointercapture',
			handleSelectionResizeLostCapture
		);
		if (typeof document === 'undefined') return;
		document.removeEventListener('pointermove', handleSelectionResizeMove);
		document.removeEventListener('pointerup', handleSelectionResizeEnd);
		document.removeEventListener('pointercancel', handleSelectionResizeCancel);
		document.removeEventListener('visibilitychange', handleSelectionInteractionVisibilityChange);
		if (typeof window !== 'undefined') {
			window.removeEventListener('blur', handleSelectionInteractionAbort);
		}
	}

	function normalizeRotation(value) {
		const normalized = value % 360;
		return normalized < 0 ? normalized + 360 : normalized;
	}

	function getAngleFromCenter(point, center) {
		return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
	}

	function rotatePointAroundCenter(point, center, rotation) {
		const angle = (rotation * Math.PI) / 180;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const dx = point.x - center.x;
		const dy = point.y - center.y;

		return {
			x: center.x + dx * cos - dy * sin,
			y: center.y + dx * sin + dy * cos
		};
	}

	function snapshotRotatableObject(obj) {
		const pathBBox = getDrawingPathBBox(obj);
		if (!pathBBox) return null;

		const anchor = {
			x: pathBBox.x + pathBBox.width / 2,
			y: pathBBox.y + pathBBox.height / 2
		};

		return {
			id: obj.id,
			type: obj.type,
			object: { ...obj },
			anchor,
			center: {
				x: obj.x + anchor.x,
				y: obj.y + anchor.y
			}
		};
	}

	function applySelectionRotation(deltaRotation) {
		if (!selectionRotationState) return;

		let didRotate = false;
		const candidates: Array<{ index: number; object: any }> = [];
		selectionRotationState.objects.forEach((entry) => {
			const index = getObjectIndexById(entry.id);
			if (index === -1) return;

			const originalRotation = Number(entry.object.rotation || 0);
			const nextCenter = rotatePointAroundCenter(
				entry.center,
				selectionRotationState.center,
				deltaRotation
			);

			const candidate = limitObjectSizeToPage({
				...allObjects[index],
				x: nextCenter.x - entry.anchor.x,
				y: nextCenter.y - entry.anchor.y,
				rotation: normalizeRotation(originalRotation + deltaRotation)
			});
			candidates.push({ index, object: candidate });
			didRotate = true;
		});

		if (didRotate) {
			const delta = getBoxesConfinementDelta(
				candidates.map(({ object }) => getObjectBoundaryBox(object))
			);

			candidates.forEach(({ index, object }) => {
				invalidateObjectVisualBoxCache(object.id);
				allObjects[index] = {
					...object,
					x: roundPageValue((object.x || 0) + delta.x),
					y: roundPageValue((object.y || 0) + delta.y)
				};
			});
			allObjects = [...allObjects];
		}
	}

	function restoreSelectionRotationOriginals() {
		if (!selectionRotationState) return;

		let didRestore = false;
		selectionRotationState.objects.forEach((entry) => {
			const index = getObjectIndexById(entry.id);
			if (index !== -1) {
				invalidateObjectVisualBoxCache(entry.id);
				allObjects[index] = { ...entry.object };
				didRestore = true;
			}
		});

		if (didRestore) {
			allObjects = [...allObjects];
		}
	}

	function commitSelectionRotation() {
		if (!selectionRotationState) return;

		const updates: any[] = [];
		selectionRotationState.objects.forEach((entry) => {
			const current = getObjectById(entry.id);
			if (!current) return;

			const oldState: Record<string, any> = {};
			const newState: Record<string, any> = {};

			['x', 'y', 'rotation'].forEach((key) => {
				if (entry.object[key] !== current[key]) {
					oldState[key] = entry.object[key];
					newState[key] = current[key];
				}
			});

			if (Object.keys(newState).length > 0) {
				updates.push({ objectId: entry.id, oldState, newState });
			}
		});

		if (updates.length > 0) {
			history.push(new BatchUpdateObjectsCommand(updates, allObjects, handleAnnotationChange));
			handleAnnotationChange();
		}
	}

	function cleanupSelectionRotation() {
		const activeRotation = selectionRotationState;
		selectionRotationState = null;
		try {
			activeRotation?.pointerTarget?.releasePointerCapture?.(activeRotation.pointerId);
		} catch {}
		activeRotation?.pointerTarget?.removeEventListener?.('pointerup', handleSelectionRotationEnd);
		activeRotation?.pointerTarget?.removeEventListener?.(
			'pointercancel',
			handleSelectionRotationCancel
		);
		activeRotation?.pointerTarget?.removeEventListener?.(
			'lostpointercapture',
			handleSelectionRotationLostCapture
		);
		if (typeof document === 'undefined') return;
		document.removeEventListener('pointermove', handleSelectionRotationMove);
		document.removeEventListener('pointerup', handleSelectionRotationEnd);
		document.removeEventListener('pointercancel', handleSelectionRotationCancel);
		document.removeEventListener('visibilitychange', handleSelectionInteractionVisibilityChange);
		if (typeof window !== 'undefined') {
			window.removeEventListener('blur', handleSelectionInteractionAbort);
		}
	}

	function handleSelectionResizeStart(event, anchor = 'bottom-right') {
		if (
			!selectionResizeBox ||
			resizableSelectedObjects.length === 0 ||
			isEditorDisabled ||
			selectionResizeState ||
			selectionRotationState ||
			ctx.state.isDraggingSelection
		)
			return;

		event.preventDefault();
		event.stopPropagation();

		const point = getPagePoint(event);
		if (!point) return;
		const fixedPoint = getResizeHandlePoint(
			selectionResizeBox,
			getOppositeResizeAnchor(anchor)
		);
		const pointerTarget = event.currentTarget;

		selectionResizeState = {
			pointerId: event.pointerId,
			pointerTarget,
			startPoint: point,
			box: { ...selectionResizeBox },
			anchor,
			fixedPoint,
			objects: resizableSelectedObjects.map(snapshotResizableObject).filter((entry) => entry.bounds)
		};

		pointerTarget.setPointerCapture?.(event.pointerId);
		pointerTarget.addEventListener?.('pointerup', handleSelectionResizeEnd);
		pointerTarget.addEventListener?.('pointercancel', handleSelectionResizeCancel);
		pointerTarget.addEventListener?.('lostpointercapture', handleSelectionResizeLostCapture);
		document.addEventListener('pointermove', handleSelectionResizeMove);
		document.addEventListener('pointerup', handleSelectionResizeEnd);
		document.addEventListener('pointercancel', handleSelectionResizeCancel);
		document.addEventListener('visibilitychange', handleSelectionInteractionVisibilityChange);
		window.addEventListener('blur', handleSelectionInteractionAbort);
	}

	function handleSelectionResizeMove(event) {
		if (!selectionResizeState || event.pointerId !== selectionResizeState.pointerId) return;

		event.preventDefault();
		event.stopPropagation();
		const point = getPagePoint(event);
		if (!point) return;

		applySelectionResize(getResizeScale(point, selectionResizeState));
	}

	function handleSelectionResizeEnd(event) {
		if (!selectionResizeState || event.pointerId !== selectionResizeState.pointerId) return;

		event.preventDefault();
		event.stopPropagation();
		commitSelectionResize();
		cleanupSelectionResize();
	}

	function handleSelectionResizeCancel(event) {
		if (!selectionResizeState || event.pointerId !== selectionResizeState.pointerId) return;

		event.preventDefault();
		event.stopPropagation();
		restoreSelectionResizeOriginals();
		cleanupSelectionResize();
	}

	function handleSelectionResizeLostCapture(event) {
		if (!selectionResizeState || event.pointerId !== selectionResizeState.pointerId) return;

		commitSelectionResize();
		cleanupSelectionResize();
	}

	function handleSelectionRotationStart(event) {
		if (
			rotatableSelectedDrawingObjects.length === 0 ||
			isEditorDisabled ||
			selectionResizeState ||
			selectionRotationState ||
			ctx.state.isDraggingSelection
		)
			return;

		event.preventDefault();
		event.stopPropagation();

		const point = getPagePoint(event);
		if (!point) return;

		const rotatableObjects = [...rotatableSelectedDrawingObjects];
		const rotationBox = combineBoxes(rotatableObjects.map(getObjectVisualBox).filter(Boolean));
		if (!rotationBox) return;

		ctx.state.selectedObjectIds = rotatableObjects.map((obj) => obj.id);
		ctx.state.selectedLineId = null;
		ctx.state.selectedTextId = null;

		const center = {
			x: rotationBox.x + rotationBox.width / 2,
			y: rotationBox.y + rotationBox.height / 2
		};
		const objects = rotatableObjects.map(snapshotRotatableObject).filter(Boolean);
		if (objects.length === 0) return;
		const pointerTarget = event.currentTarget;

		selectionRotationState = {
			pointerId: event.pointerId,
			pointerTarget,
			startAngle: getAngleFromCenter(point, center),
			center,
			objects
		};

		pointerTarget.setPointerCapture?.(event.pointerId);
		pointerTarget.addEventListener?.('pointerup', handleSelectionRotationEnd);
		pointerTarget.addEventListener?.('pointercancel', handleSelectionRotationCancel);
		pointerTarget.addEventListener?.('lostpointercapture', handleSelectionRotationLostCapture);
		document.addEventListener('pointermove', handleSelectionRotationMove);
		document.addEventListener('pointerup', handleSelectionRotationEnd);
		document.addEventListener('pointercancel', handleSelectionRotationCancel);
		document.addEventListener('visibilitychange', handleSelectionInteractionVisibilityChange);
		window.addEventListener('blur', handleSelectionInteractionAbort);
	}

	function handleSelectionRotationMove(event) {
		if (!selectionRotationState || event.pointerId !== selectionRotationState.pointerId) return;

		event.preventDefault();
		event.stopPropagation();
		const point = getPagePoint(event);
		if (!point) return;

		const currentAngle = getAngleFromCenter(point, selectionRotationState.center);
		applySelectionRotation(currentAngle - selectionRotationState.startAngle);
	}

	function handleSelectionRotationEnd(event) {
		if (!selectionRotationState || event.pointerId !== selectionRotationState.pointerId) return;

		event.preventDefault();
		event.stopPropagation();
		commitSelectionRotation();
		cleanupSelectionRotation();
	}

	function handleSelectionRotationCancel(event) {
		if (!selectionRotationState || event.pointerId !== selectionRotationState.pointerId) return;

		event.preventDefault();
		event.stopPropagation();
		restoreSelectionRotationOriginals();
		cleanupSelectionRotation();
	}

	function handleSelectionRotationLostCapture(event) {
		if (!selectionRotationState || event.pointerId !== selectionRotationState.pointerId) return;

		commitSelectionRotation();
		cleanupSelectionRotation();
	}

	// Text handling - detect selected text objects for batch editing
	let selectedTextObjects = $derived(
		ctx.state.selectedObjectIds
			.map((id) => getObjectById(id))
			.filter((obj) => obj && obj.type === 'text' && isObjectEditable(obj) && !isEditorDisabled)
	);

	let selectedTextStyleObject = $derived(selectedTextObjects[0] ?? null);

	$effect(() => {
		if (!ctx.state.isSelectionMode || !selectedTextStyleObject || ctx.state.showingAddingText) return;

		ctx.state._size = normalizeFontSize(selectedTextStyleObject.size);
		ctx.state._lineHeight = selectedTextStyleObject.lineHeight || 1;
		ctx.state._fontFamily = selectedTextStyleObject.fontFamily || ctx.state._fontFamily;
		ctx.state._textColor = selectedTextStyleObject.fontColor || '#000000';
	});

	const onChangeFontText = () => {
		if (selectedTextObjects.length > 0) {
			// Batch update all selected text objects
			selectedTextObjects.forEach((obj) => {
				updateObject(obj.id, { fontFamily: ctx.state._fontFamily });
			});
		} else if (ctx.state.selectedTextId) {
			updateObject(ctx.state.selectedTextId, { fontFamily: ctx.state._fontFamily });
		}
	};

	const onDeleteText = () => {
		if (selectedTextObjects.length > 0) {
			// Batch delete all selected text objects
			selectedTextObjects.forEach((obj) => {
				deleteObject(obj.id);
			});
			ctx.state.selectedObjectIds = [];
			ctx.state.showingAddingText = false;
		} else if (ctx.state.selectedTextId) {
			deleteObject(ctx.state.selectedTextId);
			ctx.state.showingAddingText = false;
		}
	};

	const onUpdateLineHeightText = () => {
		if (selectedTextObjects.length > 0) {
			selectedTextObjects.forEach((obj) => {
				updateObject(obj.id, { lineHeight: ctx.state._lineHeight });
			});
		} else if (ctx.state.selectedTextId) {
			updateObject(ctx.state.selectedTextId, { lineHeight: ctx.state._lineHeight });
		}
	};

	const onUpdateSizeText = () => {
		const size = normalizeFontSize(ctx.state._size);
		ctx.state._size = size;

		if (selectedTextObjects.length > 0) {
			selectedTextObjects.forEach((obj) => {
				updateObject(obj.id, { size });
			});
		} else if (ctx.state.selectedTextId) {
			updateObject(ctx.state.selectedTextId, { size });
		}
	};

	const onUpdateTextColor = () => {
		if (selectedTextObjects.length > 0) {
			selectedTextObjects.forEach((obj) => {
				updateObject(obj.id, { fontColor: ctx.state._textColor });
			});
		} else if (ctx.state.selectedTextId) {
			updateObject(ctx.state.selectedTextId, { fontColor: ctx.state._textColor });
		}
	};

	// Line handling
	function addLine(lineData) {
		if (!hasTool('line')) return;
		const id = genID();
		const object = confineObjectToPage({
			id,
			owner: user,
			type: 'line',
			x: lineData.x,
			y: lineData.y,
			width: lineData.width,
			height: lineData.height,
			strokeColor: lineData.strokeColor,
			strokeWidth: lineData.strokeWidth,
			lineType: lineData.lineType || 'solid',
			originWidth: lineData.originWidth,
			originHeight: lineData.originHeight
		});

		allObjects.push(object);
		allObjects.sort((a, b) => {
			const TYPE_ORDER = { drawing: 1, highlight: 1, line: 2, text: 3, 'teacher-mark': 4 };
			const orderA = TYPE_ORDER[a.type] || 0;
			const orderB = TYPE_ORDER[b.type] || 0;
			if (orderA !== orderB) return orderA - orderB;
			return 0;
		});

		// Add to history
		const command = new AddObjectCommand(object, allObjects, handleAnnotationChange);
		history.push(command);

		handleAnnotationChange();

		// Return to selection mode after adding line
		ctx.state.isAddingLine = false;
		ctx.state.selectedLineId = id;
		ctx.state.selectedObjectIds = [id];
	}

	function selectLine(lineId) {
		const line = getObjectById(lineId);
		if (line && line.owner !== user) return;

		ctx.state.isPenMode = false;
		ctx.state.selectedLineId = lineId;

		if (lineId !== null) {
			ctx.state.isAddingLine = false;
			ctx.state.addingDrawing = false;
			ctx.state.isErasing = false;
			ctx.state.isHighlighting = false;
			ctx.state.isPointerMode = false;
			ctx.state.isAddingText = false;
			ctx.state.isCursorMode = false;
			ctx.state.showingZoom = false;
			ctx.state.showingAddingText = false;
			ctx.state.selectedTextId = null;
		} else {
			ctx.state.isSelectionMode = true;
		}
	}

	function updateLine(lineId, updates) {
		const index = getObjectIndexById(lineId);
		if (index !== -1 && allObjects[index]?.type === 'line') {
			// Capture old state for undo
			const oldObject = allObjects[index];
			const nextObject = confineObjectToPage({ ...oldObject, ...updates });
			const oldState = {};
			const newState = {};
			const trackedKeys = new Set([
				...Object.keys(updates),
				'x',
				'y',
				'width',
				'height',
				'strokeWidth'
			]);

			// Only track the properties that are being changed
			trackedKeys.forEach((key) => {
				if (oldObject[key] !== nextObject[key]) {
					oldState[key] = oldObject[key];
					newState[key] = nextObject[key];
				}
			});

			if (Object.keys(newState).length === 0) return;

			// Update the object
			allObjects[index] = nextObject;

			// Add to history
			const command = new UpdateObjectCommand(
				lineId,
				oldState,
				newState,
				allObjects,
				handleAnnotationChange
			);
			history.push(command);

			handleAnnotationChange();
		}
	}

	function deleteLine(lineId) {
		const index = getObjectIndexById(lineId);
		if (index !== -1) {
			const removedObject = allObjects.splice(index, 1)[0];

			// Add to history
			const command = new DeleteObjectCommand(
				removedObject,
				index,
				allObjects,
				handleAnnotationChange
			);
			history.push(command);

			ctx.state.selectedLineId = null;
			ctx.state.selectedObjectIds = [];
			handleAnnotationChange();
		}
	}

	function getSelectedLine() {
		if (!ctx.state.selectedLineId) return null;
		const object = getObjectById(ctx.state.selectedLineId);
		return object?.type === 'line' ? object : null;
	}

	// Selection mode
	function isSelectableObjectForCurrentEditor(obj) {
		return obj && (allowTeacherMark || obj.type !== 'teacher-mark');
	}

	function filterSelectableObjectIds(ids: string[]) {
		if (!allowTeacherMark) {
			const topObject = getObjectById(ids[ids.length - 1]);
			if (topObject?.type === 'teacher-mark') return [];
		}

		return ids.filter((id) => isSelectableObjectForCurrentEditor(getObjectById(id)));
	}

	function handleSelectionChange(selectedIds) {
		ctx.state.selectedObjectIds = filterSelectableObjectIds(selectedIds);
		ctx.state.selectedTextId = null;
		ctx.state.showingAddingText = false;
	}

	function selectSingleSelectionObject(objectId: string) {
		const object = getObjectById(objectId);
		if (!isSelectableObjectForCurrentEditor(object)) return;

		ctx.state.isSelectionMode = true;
		ctx.state.selectedObjectIds = [objectId];
		ctx.state.selectedLineId = object.type === 'line' ? objectId : null;
		ctx.state.selectedTextId = null;
		ctx.state.showingAddingText = false;
		previewedSelectionObjectId = null;
	}

	function previewSelectionObject(objectId: string) {
		previewedSelectionObjectId = previewedSelectionObjectId === objectId ? null : objectId;
	}

	function unselectSelectionObject(objectId: string) {
		ctx.state.selectedObjectIds = ctx.state.selectedObjectIds.filter((id) => id !== objectId);

		if (previewedSelectionObjectId === objectId) {
			previewedSelectionObjectId = null;
		}

		if (ctx.state.selectedLineId === objectId) {
			ctx.state.selectedLineId = null;
		}

		if (ctx.state.selectedTextId === objectId) {
			ctx.state.selectedTextId = null;
			ctx.state.showingAddingText = false;
		}
	}

	function deleteSingleSelectionObject(objectId: string) {
		const object = getObjectById(objectId);
		if (!object || object.owner !== user || isEditorDisabled) return;

		batchDeleteObjectsByIds([objectId]);
		ctx.state.selectedObjectIds = ctx.state.selectedObjectIds.filter(
			(id) => id !== objectId && getObjectById(id)
		);

		if (ctx.state.selectedLineId === objectId) {
			ctx.state.selectedLineId = null;
		}

		if (previewedSelectionObjectId === objectId) {
			previewedSelectionObjectId = null;
		}

		if (ctx.state.selectedTextId === objectId) {
			ctx.state.selectedTextId = null;
			ctx.state.showingAddingText = false;
		}
	}

	function handleLineDoubleClick(lineId) {
		// Trigger editing for the specific line element
		ctx.state.editingLineId = lineId;
		selectLine(lineId);
		ctx.state.isSelectionMode = false;
	}

	function handleTextDoubleClick(textId) {
		// Trigger editing for the specific text element
		ctx.state.editingTextId = textId;

		// Reset after a short delay to allow the effect to trigger
		requestAnimationFrame(() => {
			ctx.state.editingTextId = null;
		});
	}

	function isSelectionControlEvent(event: Event) {
		return event.target instanceof Element && Boolean(event.target.closest('[data-selection-control]'));
	}

	function startEditingSelectedText(textId: string) {
		handleTextDoubleClick(textId);
		ctx.state.selectedObjectIds = [];
		ctx.state.selectedLineId = null;
		ctx.state.showingAddingText = false;
		ctx.state.selectedTextId = null;
	}

	function handleSelectionClick(event) {
		if (!ctx.state.isSelectionMode) return;

		if (ctx.state.justFinishedDragging) {
			ctx.state.justFinishedDragging = false;
			return;
		}

		if (ctx.state.justFinishedLassoSelection) {
			ctx.state.justFinishedLassoSelection = false;
			return;
		}

		const canvasRect = event.currentTarget.getBoundingClientRect();
		const clickPoint = {
			x: (event.clientX - canvasRect.left) / ctx.state.zoom,
			y: (event.clientY - canvasRect.top) / ctx.state.zoom
		};

		const hitDrawingIds = filterSelectableObjectIds(
			findObjectsAtPoint(clickPoint)
		);

		if (hitDrawingIds.length === 0) {
			if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
				ctx.state.selectedObjectIds = [];
				ctx.state.selectedLineId = null;
				ctx.state.selectedTextId = null;
				ctx.state.showingAddingText = false;
			}
			return;
		}

		const topDrawingId = hitDrawingIds[hitDrawingIds.length - 1];

		if (event.shiftKey || event.ctrlKey || event.metaKey) {
			if (isSelectedObjectId(topDrawingId)) {
				ctx.state.selectedObjectIds = ctx.state.selectedObjectIds.filter(
					(id) => id !== topDrawingId
				);
			} else {
				ctx.state.selectedObjectIds = [...ctx.state.selectedObjectIds, topDrawingId];
			}
		} else {
			ctx.state.selectedObjectIds = [topDrawingId];
		}

		ctx.state.selectedTextId = null;
		ctx.state.showingAddingText = false;
	}

	function startDraggingSelection(event) {
		if (
			ctx.state.selectedObjectIds.length === 0 ||
			isEditorDisabled ||
			selectionResizeState ||
			selectionRotationState
		)
			return;

		const canvasRect = event.currentTarget.getBoundingClientRect();
		ctx.state.dragStartPoint = {
			x: (event.clientX - canvasRect.left) / ctx.state.zoom,
			y: (event.clientY - canvasRect.top) / ctx.state.zoom
		};

		ctx.state.originalPositions = new Map();
		dragOriginalBoxes = new Map();
		ctx.state.selectedObjectIds.forEach((id) => {
			const obj = getObjectById(id);
			if (isObjectEditable(obj)) {
				ctx.state.originalPositions.set(id, { x: obj.x, y: obj.y });
				const box = getObjectBoundaryBox(obj);
				if (box) dragOriginalBoxes.set(id, box);
			}
		});

		if (ctx.state.originalPositions.size === 0) return;

		ctx.state.isDraggingSelection = true;
	}

	function dragSelection(event) {
		if (
			!ctx.state.isDraggingSelection ||
			ctx.state.selectedObjectIds.length === 0 ||
			selectionResizeState ||
			selectionRotationState
		)
			return;

		const canvasRect = event.currentTarget.getBoundingClientRect();
		const currentX = (event.clientX - canvasRect.left) / ctx.state.zoom;
		const currentY = (event.clientY - canvasRect.top) / ctx.state.zoom;

		const dx = currentX - ctx.state.dragStartPoint.x;
		const dy = currentY - ctx.state.dragStartPoint.y;
		const boundedDelta = getClampedMoveDelta(Array.from(dragOriginalBoxes.values()), dx, dy);

		ctx.state.originalPositions.forEach((original, id) => {
			const index = getObjectIndexById(id);
			if (index !== -1) {
				invalidateObjectVisualBoxCache(id);
				allObjects[index] = {
					...allObjects[index],
					x: roundPageValue(original.x + boundedDelta.x),
					y: roundPageValue(original.y + boundedDelta.y)
				};
			}
		});
		allObjects = [...allObjects];
	}

	function stopDraggingSelection() {
		if (ctx.state.isDraggingSelection) {
			// Create new positions map from current state
			const newPositions = new Map<string, { x: number; y: number }>();
			ctx.state.originalPositions.forEach((_original, id) => {
				const obj = getObjectById(id);
				if (obj) {
					newPositions.set(id, { x: obj.x, y: obj.y });
				}
			});

			// Only add to history if objects actually moved
			let hasMoved = false;
			ctx.state.originalPositions.forEach((oldPos, id) => {
				const newPos = newPositions.get(id);
				if (newPos && (oldPos.x !== newPos.x || oldPos.y !== newPos.y)) {
					hasMoved = true;
				}
			});

			if (hasMoved) {
				const command = new DragCommand(
					Array.from(ctx.state.originalPositions.keys()),
					ctx.state.originalPositions,
					newPositions,
					allObjects,
					handleAnnotationChange
				);
				history.push(command);
				handleAnnotationChange();
			}

			ctx.state.justFinishedDragging = true;
			ctx.state.isDraggingSelection = false;
			ctx.state.originalPositions = new Map();
			dragOriginalBoxes = new Map();
			// Binding automatically syncs changes
		}
	}

	function resetActivePointerLocks() {
		if (selectionResizeState) {
			restoreSelectionResizeOriginals();
			cleanupSelectionResize();
		}

		if (selectionRotationState) {
			restoreSelectionRotationOriginals();
			cleanupSelectionRotation();
		}

		if (ctx.state.isDraggingSelection && ctx.state.originalPositions.size > 0) {
			ctx.state.originalPositions.forEach((original, id) => {
				const index = getObjectIndexById(id);
				if (index !== -1) {
					invalidateObjectVisualBoxCache(id);
					allObjects[index] = {
						...allObjects[index],
						x: original.x,
						y: original.y
					};
				}
			});
			allObjects = [...allObjects];
		}

		ctx.state.isDraggingSelection = false;
		ctx.state.isPanning = false;
		ctx.state.dragStartPoint = { x: 0, y: 0 };
		ctx.state.originalPositions = new Map();
		ctx.state.justFinishedDragging = false;
		ctx.state.justFinishedLassoSelection = false;
		ctx.state.temporaryStrokes = [];
		dragOriginalBoxes = new Map();
		zoomPan.resetPointerState();
	}

	function deleteSelectedObjects() {
		if (ctx.state.selectedObjectIds.length === 0 || isEditorDisabled) return;

		// Collect objects to delete with their indices
		const objectsToDelete: Array<{ object: any; index: number }> = [];

		ctx.state.selectedObjectIds.forEach((id) => {
			const index = getObjectIndexById(id);
			if (index !== -1) {
				const obj = allObjects[index];
				if (obj.owner === user) {
					objectsToDelete.push({ object: obj, index });
				}
			}
		});

		// If nothing to delete, return
		if (objectsToDelete.length === 0) return;

		// Delete all objects (in reverse order to maintain indices)
		const sorted = [...objectsToDelete].sort((a, b) => b.index - a.index);
		sorted.forEach(({ object, index }) => {
			invalidateObjectVisualBoxCache(object.id);
			allObjects.splice(index, 1);
		});

		// Add single batch command to history
		const command = new BatchDeleteCommand(objectsToDelete, allObjects, handleAnnotationChange);
		history.push(command);

		ctx.state.selectedObjectIds = [];
		ctx.state.selectedLineId = null;
		ctx.state.selectedTextId = null;
		ctx.state.showingAddingText = false;
		handleAnnotationChange();
	}

	// COPY (DUPLICATE) SELECTED OBJECTS
	function copySelectedObjects() {
		if (ctx.state.selectedObjectIds.length === 0 || isEditorDisabled) return;

		const newIds: string[] = [];

		ctx.state.selectedObjectIds.forEach((id) => {
			const obj = getObjectById(id);
			if (!obj || obj.owner !== user) return;

			const clone = JSON.parse(JSON.stringify(obj));
			clone.id = genID() + '-' + Math.random().toString(36).slice(2, 7);
			clone.x = (clone.x || 0) + 20;
			clone.y = (clone.y || 0) + 20;
			const constrainedClone = confineObjectToPage(clone);

			allObjects.push(constrainedClone);

			// Add to history
			const command = new AddObjectCommand(constrainedClone, allObjects, handleAnnotationChange);
			history.push(command);

			newIds.push(constrainedClone.id);
		});

		if (newIds.length > 0) {
			// Re-sort objects to maintain type ordering
			allObjects.sort((a, b) => {
				const TYPE_ORDER: Record<string, number> = {
					drawing: 1,
					highlight: 1,
					line: 2,
					text: 3,
					'teacher-mark': 4
				};
				const orderA = TYPE_ORDER[a.type] || 0;
				const orderB = TYPE_ORDER[b.type] || 0;
				if (orderA !== orderB) return orderA - orderB;
				return 0;
			});

			// Select the new clones
			ctx.state.selectedObjectIds = newIds;
			handleAnnotationChange();
		}
	}

	function isObjectSelected(objectId) {
		return isSelectedObjectId(objectId);
	}

	function isObjectPreviewed(objectId) {
		return previewedSelectionObjectId === objectId;
	}

	// Batch delete objects by IDs (used by eraser)
	function batchDeleteObjectsByIds(ids: string[]) {
		if (ids.length === 0 || isEditorDisabled) return;

		// Collect objects to delete with their indices
		const objectsToDelete: Array<{ object: any; index: number }> = [];

		ids.forEach((id) => {
			const index = getObjectIndexById(id);
			if (index !== -1) {
				const obj = allObjects[index];
				if (obj.owner === user) {
					objectsToDelete.push({ object: obj, index });
				}
			}
		});

		// If nothing to delete, return
		if (objectsToDelete.length === 0) return;

		// Delete all objects (in reverse order to maintain indices)
		const sorted = [...objectsToDelete].sort((a, b) => b.index - a.index);
		sorted.forEach(({ object, index }) => {
			invalidateObjectVisualBoxCache(object.id);
			allObjects.splice(index, 1);
		});

		// Add single batch command to history
		const command = new BatchDeleteCommand(objectsToDelete, allObjects, handleAnnotationChange);
		history.push(command);

		handleAnnotationChange();
	}

	// Pointer mode constants
	const POINTER_STROKE_WIDTH = 2;
	const POINTER_DURATION = 3000;
</script>

<svelte:head>
	<meta
		name="viewport"
		content="width=device-width, initial-scale=1.0, viewport-fit=cover"
	/>
	 <style>
    @font-face {
      font-family: "KaiTi Regular";
      src: url("/fonts/KaiTi-Regular.ttf") format("truetype");
    }
	  @font-face {
      font-family: "Noto Sans CJK";
      src: url("/fonts/NotoSansSC-Regular.ttf") format("truetype");
    }
  </style>
</svelte:head>

<!-- Top Bar -->
<TopBar
	{saveState}
	{internalPage}
	{minPage}
	{maxPage}
	{itemsPerPage}
	{isChangingPage}
	{isPagePreviewOpen}
	{homework_info}
	{allowPrinting}
	{pdfFile}
	{saving}
	{pages}
	{isFullscreen}
	stroke_visibility={ctx.state.stroke_visibility}
	zoom={ctx.state.zoom}
	zoomEnabled={ctx.state.zoomEnabled}
	doubleTapZoomEnabled={ctx.state.doubleTapZoomEnabled}
	autoSaveEnabled={ctx.state.autoSaveEnabled}
	visibleObjectRenderingEnabled={useVisibleObjectRendering}
	{minimapAnnotationsEnabled}
	adjacentPagePreviewEnabled={adjacentPagePreviewEnabled}
	adjacentPagePreviewCount={adjacentPagePreviewCount}
	adjacentPagePreviewLayout={adjacentPagePreviewLayout}
	renderQualityMode={ctx.state.renderQualityMode}
	{isPageDisabled}
	onRetryFailedSave={retryFailedSave}
	onNext={nextPage}
	onPrev={prevPage}
	onPageInput={handlePageInput}
	onBlur={handleBlur}
	onTogglePagePreview={() => (isPagePreviewOpen = !isPagePreviewOpen)}
	onViewHomeworkInfo={() => view_homework_info.showModal()}
	onPrint={savePDF}
	onToggleFullscreen={toggleFullScreen}
	onStrokeVisibilityChange={(value) => (ctx.state.stroke_visibility = value)}
	onToggleZoom={zoomPan.handleZoomToggle}
	onToggleDoubleTapZoom={() => (ctx.state.doubleTapZoomEnabled = !ctx.state.doubleTapZoomEnabled)}
	onToggleAutoSave={() => (ctx.state.autoSaveEnabled = !ctx.state.autoSaveEnabled)}
	onToggleVisibleObjectRendering={handleToggleVisibleObjectRendering}
	onToggleMinimapAnnotations={handleToggleMinimapAnnotations}
	onToggleAdjacentPagePreview={handleToggleAdjacentPagePreview}
	onAdjacentPagePreviewCountChange={handleAdjacentPagePreviewCountChange}
	onAdjacentPagePreviewLayoutChange={handleAdjacentPagePreviewLayoutChange}
	onRenderQualityModeChange={(mode) => (ctx.state.renderQualityMode = mode)}
	onSave={handleSaveFirst}
	onDone={handleDone}
	{isCompleting}
/>

<!-- Bottom Toolbar -->
<BottomToolbar
	isAddingText={ctx.state.isAddingText}
	addingDrawing={ctx.state.addingDrawing}
	isErasing={ctx.state.isErasing}
	isAddingLine={ctx.state.isAddingLine}
	isHighlighting={ctx.state.isHighlighting}
	isPointerMode={ctx.state.isPointerMode}
	isSelectionMode={ctx.state.isSelectionMode}
	isHandMode={ctx.state.isHandMode}
	{allowTeacherMark}
	{selectedPageIndex}
	{isPageDisabled}
	disabled={isEditorDisabled}
	isAddingDisabled={ctx.state.isAddingDisabled}
	onAddTextField={() => hasTool('text') && modes.onAddTextField(ctx.state.isAddingText)}
	onAddDrawing={() => modes.onAddDrawing(ctx.state.addingDrawing)}
	onErasing={() => modes.onErasing(ctx.state.isErasing)}
	activateLineMode={() => hasTool('line') && modes.activateLineMode(ctx.state.isAddingLine)}
	onHighlighting={() => hasTool('highlighter') && modes.onHighlighting(ctx.state.isHighlighting)}
	onPointerMode={() => modes.onPointerMode(ctx.state.isPointerMode)}
	onSelectionMode={() => modes.onSelectionMode(ctx.state.isSelectionMode)}
	onHandMode={() => modes.onHandMode(ctx.state.isHandMode)}
	onTeacherMark={addTeacherMark}
	{handleUndo}
	{handleRedo}
	{enabledToolMap}
/>

<!-- Tool Panels (now fixed in top-right) -->
{#if ctx.state.addingDrawing}
	<DrawingToolPanel
		bind:isMinimized={toolPanelIsMinimized}
		brushSize={ctx.state.brushSize}
		brushColor={ctx.state.brushColor}
		onClose={() => (ctx.state.addingDrawing = false)}
		onBrushSizeChange={handleDrawingBrushSizeChange}
		onColorChange={handleDrawingBrushColorChange}
	/>
{/if}

{#if ctx.state.isHighlighting && hasTool('highlighter')}
	<HighlightToolPanel
		bind:isMinimized={toolPanelIsMinimized}
		highlightSize={ctx.state.highlightSize}
		highlightColor={ctx.state.highlightColor}
		onClose={() => (ctx.state.isHighlighting = false)}
		onSizeChange={(size) => (ctx.state.highlightSize = size)}
		onColorChange={(color) => (ctx.state.highlightColor = color)}
	/>
{/if}

{#if ctx.state.isErasing}
	<EraserToolPanel
		bind:isMinimized={toolPanelIsMinimized}
		{user}
		erasingBrushSize={ctx.state.ErasingBrushSize}
		onClose={() => (ctx.state.isErasing = false)}
		onSizeChange={(size) => (ctx.state.ErasingBrushSize = size)}
	/>
{/if}

{#if ctx.state.showingZoom}
	<ZoomToolPanel
		bind:isMinimized={toolPanelIsMinimized}
		zoom={ctx.state.zoom}
		zoomEnabled={ctx.state.zoomEnabled}
		{isPageDisabled}
		onClose={() => (ctx.state.showingZoom = false)}
		onZoomIn={zoomPan.handleZoomIn}
		onZoomOut={zoomPan.handleZoomOut}
		onResetZoom={zoomPan.handleResetZoom}
		onToggleZoom={zoomPan.handleZoomToggle}
	/>
{/if}

{#if ctx.state.showingAddingText && selectedTextObjects.length === 0 && hasTool('text')}
	<TextToolPanel
		bind:isMinimized={toolPanelIsMinimized}
		_size={ctx.state._size}
		_textColor={ctx.state._textColor}
		_lineHeight={ctx.state._lineHeight}
		_fontFamily={ctx.state._fontFamily}
		selectedCount={selectedTextObjects.length || (ctx.state.selectedTextId ? 1 : 0)}
		onClose={() => {
			ctx.state.showingAddingText = false;
			ctx.state.selectedTextId = null;
		}}
		onUpdateSize={(size) => {
			ctx.state._size = normalizeFontSize(size);
			onUpdateSizeText();
		}}
		onUpdateColor={(color) => {
			ctx.state._textColor = color;
			onUpdateTextColor();
		}}
		onUpdateLineHeight={(lineHeight) => {
			ctx.state._lineHeight = lineHeight;
			onUpdateLineHeightText();
		}}
		onUpdateFontFamily={(family) => {
			ctx.state._fontFamily = family;
			onChangeFontText();
		}}
		onDelete={onDeleteText}
	/>
{/if}

{#if ctx.state.isAddingLine && hasTool('line')}
	<LineToolPanel
		bind:isMinimized={toolPanelIsMinimized}
		lineStrokeWidth={ctx.state.lineStrokeWidth}
		lineStrokeColor={ctx.state.lineStrokeColor}
		lineType={ctx.state.lineType}
		onClose={() => {
			ctx.state.isAddingLine = false;
			ctx.state.isSelectionMode = true;
		}}
		onStrokeWidthChange={(width) => (ctx.state.lineStrokeWidth = width)}
		onStrokeColorChange={(color) => (ctx.state.lineStrokeColor = color)}
		onLineTypeChange={(type) => (ctx.state.lineType = type)}
	/>
{/if}

{#if ctx.state.selectedLineId}
	<SelectedLineToolPanel
		bind:isMinimized={toolPanelIsMinimized}
		selectedLine={getSelectedLine()}
		onClose={() => {
			ctx.state.selectedLineId = null;
			ctx.state.selectedObjectIds = [];
			ctx.state.isSelectionMode = true;
		}}
		onStrokeWidthChange={(width) => {
			if (ctx.state.selectedLineId) {
				updateLine(ctx.state.selectedLineId, { strokeWidth: width });
			}
		}}
		onStrokeColorChange={(color) => {
			if (ctx.state.selectedLineId) {
				updateLine(ctx.state.selectedLineId, { strokeColor: color });
			}
		}}
		onLineTypeChange={(type) => {
			if (ctx.state.selectedLineId) {
				updateLine(ctx.state.selectedLineId, { lineType: type });
			}
		}}
		onDelete={() => {
			if (ctx.state.selectedLineId) {
				deleteLine(ctx.state.selectedLineId);
			}
		}}
	/>
{/if}

{#if selectedTeacherMark}
	<TeacherMarkToolPanel
		object={selectedTeacherMark}
		onClose={() => {
			ctx.state.selectedObjectIds = [];
		}}
		onUpdate={(payload) => updateTeacherMark(selectedTeacherMark, payload)}
		onDelete={() => {
			deleteObjectById(selectedTeacherMark.id);
			ctx.state.selectedObjectIds = [];
		}}
	/>
{/if}

<!-- Overlays -->
<PenModeNotification
	isPenMode={ctx.state.isPenMode}
	onClose={() => (ctx.state.isPenMode = false)}
/>

{#if !selectedTeacherMark}
	<SelectionToolbar
		isSelectionMode={ctx.state.isSelectionMode}
		selectedObjectIds={ctx.state.selectedObjectIds}
		selectedObjects={selectionToolbarObjects}
		previewedObjectId={previewedSelectionObjectId}
		selectedTextCount={selectedTextObjects.length}
		textSize={ctx.state._size}
		textColor={ctx.state._textColor}
		textLineHeight={ctx.state._lineHeight}
		textFontFamily={ctx.state._fontFamily}
		onDelete={deleteSelectedObjects}
		onDuplicate={copySelectedObjects}
		onSelectObject={selectSingleSelectionObject}
		onPreviewObject={previewSelectionObject}
		onUnselectObject={unselectSelectionObject}
		onDeleteObject={deleteSingleSelectionObject}
		onEditText={() => {
			if (selectedTextObjects.length === 1) {
				startEditingSelectedText(selectedTextObjects[0].id);
			}
		}}
		onUpdateTextSize={(size) => {
			ctx.state._size = normalizeFontSize(size);
			onUpdateSizeText();
		}}
		onUpdateTextColor={(color) => {
			ctx.state._textColor = color;
			onUpdateTextColor();
		}}
		onUpdateTextLineHeight={(lineHeight) => {
			ctx.state._lineHeight = lineHeight;
			onUpdateLineHeightText();
		}}
		onUpdateTextFontFamily={(family) => {
			ctx.state._fontFamily = family;
			onChangeFontText();
		}}
		onClearSelection={() => {
			ctx.state.selectedObjectIds = [];
			ctx.state.selectedLineId = null;
			ctx.state.selectedTextId = null;
			ctx.state.showingAddingText = false;
			previewedSelectionObjectId = null;
		}}
	/>
{/if}

<!-- Minimap Zoom Control -->
<MinimapZoomControl
	zoom={ctx.state.zoom}
	{currentPage}
	{maxPage}
	pageWidth={currentPageWidth}
	pageHeight={currentPageHeight}
	pageObjectsByPage={minimapPageObjects}
	layoutKey={`${adjacentPagePreviewEnabled}-${adjacentPagePreviewLayout}-${adjacentPagePreviewCount}-${leftAdjacentPreviewPages.join(',')}-${rightAdjacentPreviewPages.join(',')}`}
	scrollRoot={editorScrollRoot}
	onZoomIn={zoomPan.handleZoomIn}
	onZoomOut={zoomPan.handleZoomOut}
	onResetZoom={handleResetView}
	onZoomToFit={handleZoomToFit}
	onSetZoom={(zoom) => zoomPan.zoomAtPoint(zoom, undefined, undefined, true)}
/>

<!-- Main content area -->
<div
	bind:this={editorScrollRoot}
	class="pdf-editor-scroll-root flex flex-col"
	class:pdf-drawing-input-active={drawingInputActive}
	style="touch-action: {scrollRootTouchAction};"
>
	<!-- Spacer to account for fixed toolbar height -->
	<div class="h-24 shrink-0"></div>

	<!-- Scrollable content area -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		role="list"
		class:cursor-grab={ctx.state.isHandMode && !ctx.state.isPanning}
		class:cursor-grabbing={ctx.state.isHandMode && ctx.state.isPanning}
		onmousedown={handleWorkspaceMouseDown}
		use:nonpassiveTouchStart={handleWorkspaceTouchStart}
		use:nonpassiveTouchMove={handleWorkspaceTouchMove}
		ontouchend={(e) => {
			if (drawingInputActive && !ctx.state.isHandMode) {
				zoomPan.onTouchEnd(e);
				return;
			}
			// Clean up gesture state
			zoomPan.onTouchEnd(e);
			if (ctx.state.isHandMode) {
				zoomPan.stopPanning();
			}
		}}
		ontouchcancel={(e) => {
			if (drawingInputActive && !ctx.state.isHandMode) {
				zoomPan.onTouchEnd(e);
				return;
			}
			zoomPan.onTouchEnd(e);
			resetActivePointerLocks();
		}}
		onwheel={(e) => zoomPan.handleWheelZoom(e)}
		style="-webkit-overflow-scrolling: auto; overscroll-behavior: contain; touch-action: {workspaceTouchAction};"
	>
		<div class="pdf-workspace-shell w-fit">
			{#if PDFReady && !pdfEngine.isLoading && pdfEngine.engine && embedPdfPlugins.length}
				<EmbedPDF engine={pdfEngine.engine} plugins={embedPdfPlugins}>
					{#snippet children()}
						<PDFDocumentLoader
							documentId={pdfDocumentId}
							buffer={pdfBuffer}
							name={pdfName || 'document.pdf'}
						>
								{#snippet children(documentContent)}
									{#if documentContent.isLoaded && documentContent.documentState.document}
										<PDFDocumentSync
											document={documentContent.documentState.document}
											{currentPage}
											onSync={syncEmbedPDFDocumentState}
										/>
										{#if isPagePreviewOpen}
											<PagePreviewMenu
												documentId={pdfDocumentId}
												currentPage={internalPage}
												{minPage}
												{maxPage}
												pageWidth={currentPageWidth}
												pageHeight={currentPageHeight}
												renderQualityMode={ctx.state.renderQualityMode}
												visibilityRevision={pageRenderVisibilityRevision}
												visibilityViewport={pageRenderVisibilityViewport}
												currentPageObjects={allObjects}
												onClose={() => (isPagePreviewOpen = false)}
												onSelectPage={goToPage}
											/>
										{/if}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="pdf-workspace scroll-m-14"
							class:pdf-workspace--side-pages-off={!adjacentPagePreviewEnabled}
							class:pdf-workspace--row={adjacentPagePreviewLayout === 'row'}
							class:pdf-workspace--column={adjacentPagePreviewLayout === 'column'}
						>
							<div
								class="pdf-page-layout"
								class:pdf-page-layout--row={adjacentPagePreviewLayout === 'row'}
								class:pdf-page-layout--column={adjacentPagePreviewLayout === 'column'}
							>
								{#each leftAdjacentPreviewPages as pageNo (pageNo)}
									<div
										use:observeAdjacentPage={pageNo}
										class="pdf-page-stack pdf-page-stack--preview shrink-0"
										class:pdf-page-stack--compact={useCompactPageTabs}
										class:pdf-page-stack--minimal={useMinimalPageTabs}
										style="width: {pageStackWidth}px;"
									>
										<div class="pdf-page-tab pdf-page-tab--preview">
											{#if useCompactPageTabs}
												<div class="pdf-page-tab-copy pdf-page-tab-copy--compact">
													<div class="pdf-page-tab-title">Page {pageNo}</div>
													<div class="pdf-page-tab-status">
														<span class="pdf-page-tab-dot"></span>
														<span>Preview</span>
													</div>
												</div>
											{:else}
												<div class="pdf-page-tab-copy">
													<div class="pdf-page-tab-kicker">Preview only</div>
													<div class="pdf-page-tab-title">Page {pageNo}</div>
													<div class="pdf-page-tab-note">Switch to this page to edit</div>
												</div>
											{/if}
											{#if !useMinimalPageTabs}
												<button
													type="button"
													class="pdf-page-tab-open"
													aria-label={`Open page ${pageNo}`}
													onclick={() => goToPage(pageNo)}
												>
													{#if !useCompactPageTabs}
														<span>Open</span>
													{/if}
													<LucideArrowRight size={useCompactPageTabs ? 16 : 14} strokeWidth={2.4} />
												</button>
											{/if}
										</div>

										<div
											class="pdf-side-page pointer-events-none relative overflow-hidden rounded-sm bg-white shadow-md ring-1 ring-black/10"
											data-minimap-page={pageNo}
											style="width: {currentPageWidth * ctx.state.zoom}px; height: {currentPageHeight * ctx.state.zoom}px;"
											aria-hidden="true"
										>
											{#if isAdjacentPagePreviewVisible(pageNo)}
												<div
													class="absolute top-0 left-0 origin-top-left"
													class:smooth-zoom={zoomPan.smoothTransition}
													style="width: {currentPageWidth}px; height: {currentPageHeight}px; transform: scale({ctx.state.zoom});"
												>
													{#key `${pdfDocumentId}-side-left-${pageNo}`}
														<PDFPage
															documentId={pdfDocumentId}
															pageIndex={pageNo - 1}
															zoom={settledRenderZoom}
															width={currentPageWidth}
															height={currentPageHeight}
															isPanning={cameraIsLive}
															renderQualityMode={settledRenderQualityMode}
															deferUpdates={pageRenderDeferUpdates}
															visibilityRevision={pageRenderVisibilityRevision}
															visibilityViewport={pageRenderVisibilityViewport}
														/>
													{/key}
													<div class="absolute top-0 left-0 z-10 h-full w-full">
														{#each getAdjacentPageObjects(pageNo) as object (object.id)}
															{#if object.type === 'text'}
																<Text
																	isPenMode={false}
																	isSelectionMode={false}
																	isSelected={false}
																	width={object.width}
																	onUpdateText={() => {}}
																	viewOnly={true}
																	lines={object.lines}
																	x={object.x}
																	y={object.y}
																	size={object.size}
																	lineHeight={object.lineHeight}
																	fontFamily={object.fontFamily}
																	fontColor={object.fontColor}
																	onTextSelected={() => {}}
																	onTextUnselected={() => {}}
																	pageScale={ctx.state.zoom}
																/>
															{:else if object.type === 'drawing' || object.type === 'highlight'}
																<Drawing
																	{object}
																	{user}
																	bind:stroke_visibility={ctx.state.stroke_visibility}
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
																	pageScale={ctx.state.zoom}
																/>
															{:else if object.type === 'line'}
																<Line
																	{object}
																	{user}
																	isPenMode={false}
																	isAddingLine={false}
																	x={object.x}
																	y={object.y}
																	shapeWidth={object.width}
																	shapeHeight={object.height}
																	strokeColor={object.strokeColor}
																	strokeWidth={object.strokeWidth}
																	lineType={object.lineType || 'solid'}
																	originWidth={object.originWidth}
																	originHeight={object.originHeight}
																	pageScale={ctx.state.zoom}
																	isSelected={false}
																	isObjectSelected={false}
																/>
															{:else if object.type === 'teacher-mark'}
																<TeacherMark
																	{object}
																	x={object.x}
																	y={object.y}
																	width={object.width}
																	height={object.height}
																	isSelected={false}
																	isPreviewed={false}
																/>
															{/if}
														{/each}
													</div>
												</div>
											{/if}
										</div>
									</div>
								{/each}
							<div
								class="pdf-page-stack pdf-page-stack--active shrink-0"
								class:pdf-page-stack--compact={useCompactPageTabs}
								class:pdf-page-stack--minimal={useMinimalPageTabs}
								style="width: {pageStackWidth}px;"
							>
								{#if adjacentPagePreviewEnabled}
									<div class="pdf-page-tab pdf-page-tab--active">
										{#if useCompactPageTabs}
											<div class="pdf-page-tab-copy pdf-page-tab-copy--compact">
												<div class="pdf-page-tab-title">Page {currentPage}</div>
												<div class="pdf-page-tab-status">
													<span class="pdf-page-tab-dot"></span>
													<span>Editing</span>
												</div>
											</div>
										{:else}
											<div class="pdf-page-tab-kicker">Editing</div>
											<div class="pdf-page-tab-title">Page {currentPage}</div>
											<div class="pdf-page-tab-note">Current page</div>
										{/if}
									</div>
								{/if}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div
								bind:this={editablePageFrame}
								class="pdf-canvas relative shadow-lg ring-2 ring-amber-400/80"
								class:pdf-canvas--compact-active={useCompactPageTabs}
								data-minimap-page={currentPage}
								data-minimap-current="true"
								class:cursor-crosshair={ctx.state.isAddingText}
								class:cursor-move={ctx.state.isDraggingSelection}
								class:cursor-grab={ctx.state.isHandMode}
								class:page-transition={isChangingPage}
								style="width: {currentPageWidth * ctx.state.zoom}px; height: {currentPageHeight * ctx.state.zoom}px;"
								ontouchstart={(e) => {
									if (isSelectionControlEvent(e)) return;

									if (
										ctx.state.isSelectionMode &&
										e.touches.length === 1 &&
										ctx.state.selectedObjectIds.length > 0
									) {
										const touch = e.touches[0];
										const canvasRect = e.currentTarget.getBoundingClientRect();
										const clickPoint = {
											x: (touch.clientX - canvasRect.left) / ctx.state.zoom,
											y: (touch.clientY - canvasRect.top) / ctx.state.zoom
										};

										const hitDrawingIds = filterSelectableObjectIds(
											findObjectsAtPoint(clickPoint)
										);
										const clickedOnSelected = hitDrawingIds.some((id) =>
											isSelectedObjectId(id)
										);

										if (clickedOnSelected) {
											// Find the top-most selected object that was touched
											const topSelectedId = hitDrawingIds
												.reverse()
												.find((id) => isSelectedObjectId(id));

											if (topSelectedId) {
												const currentTime = Date.now();
												const timeDiff = currentTime - lastTouchTime;
												const distance = Math.sqrt(
													(clickPoint.x - lastTouchPosition.x) ** 2 +
														(clickPoint.y - lastTouchPosition.y) ** 2
												);

												// Check if this is a double-touch
												const isSameObject = lastTouchedObjectId === topSelectedId;
												const isWithinTimeThreshold = timeDiff <= TOUCH_DOUBLE_CLICK_TIME_THRESHOLD;
												const isWithinPositionThreshold =
													distance <= TOUCH_DOUBLE_CLICK_POSITION_THRESHOLD;

												if (isSameObject && isWithinTimeThreshold && isWithinPositionThreshold) {
													// Trigger double-click handler based on object type
													const obj = getObjectById(topSelectedId);
													if (obj) {
														if (obj.type === 'text') {
															handleTextDoubleClick(topSelectedId);
														} else if (obj.type === 'line') {
															handleLineDoubleClick(topSelectedId);
														}
													}
													// Reset tracking to prevent drag
													lastTouchedObjectId = null;
													lastTouchTime = 0;
													lastTouchPosition = { x: 0, y: 0 };
												} else {
													// Not a double-touch, start dragging
													const fakeEvent = {
														currentTarget: e.currentTarget,
														clientX: touch.clientX,
														clientY: touch.clientY
													};
													startDraggingSelection(fakeEvent);

													// Update tracking state
													lastTouchedObjectId = topSelectedId;
													lastTouchTime = currentTime;
													lastTouchPosition = clickPoint;
												}
											}
										}
									}
								}}
								ontouchmove={(e) => {
									if (
										ctx.state.isSelectionMode &&
										e.touches.length === 1 &&
										ctx.state.isDraggingSelection
									) {
										const touch = e.touches[0];
										const fakeEvent = {
											currentTarget: e.currentTarget,
											clientX: touch.clientX,
											clientY: touch.clientY
										};
										dragSelection(fakeEvent);
									}
								}}
								ontouchend={(e) => {
									if (ctx.state.isSelectionMode && ctx.state.isDraggingSelection) {
										if (e.cancelable) e.preventDefault();
										stopDraggingSelection();
									}
								}}
								ontouchcancel={(e) => {
									if (ctx.state.isDraggingSelection) {
										if (e.cancelable) e.preventDefault();
									}
									resetActivePointerLocks();
								}}
								onclick={(e) => {
									if (isSelectionControlEvent(e)) return;

									if (ctx.state.isAddingText && !isEditorDisabled) {
										const rect = e.currentTarget.getBoundingClientRect();
										const x = (e.clientX - rect.left) / ctx.state.zoom;
										const y = (e.clientY - rect.top) / ctx.state.zoom;
										addTextField(x, y);
										// Return to selection mode after adding text
										ctx.state.isAddingText = false;
										ctx.state.isCursorMode = false;
										ctx.state.AddTextButtonField = 'Add Text';
										ctx.state.isSelectionMode = true;
									} else if (ctx.state.isSelectionMode) {
										handleSelectionClick(e);
									}
								}}
								onmousedown={(e) => {
									if (isSelectionControlEvent(e)) return;

									if (ctx.state.isSelectionMode && ctx.state.selectedObjectIds.length > 0) {
										const canvasRect = e.currentTarget.getBoundingClientRect();
										const clickPoint = {
											x: (e.clientX - canvasRect.left) / ctx.state.zoom,
											y: (e.clientY - canvasRect.top) / ctx.state.zoom
										};

										const hitDrawingIds = filterSelectableObjectIds(
											findObjectsAtPoint(clickPoint)
										);
										const clickedOnSelected = hitDrawingIds.some((id) =>
											isSelectedObjectId(id)
										);

										if (clickedOnSelected) {
											e.preventDefault();
											startDraggingSelection(e);
										}
									}
								}}
								onmousemove={(e) => {
									if (ctx.state.isSelectionMode && ctx.state.isDraggingSelection) {
										e.preventDefault();
										dragSelection(e);
									}
								}}
								onmouseup={(e) => {
									if (ctx.state.isSelectionMode && ctx.state.isDraggingSelection) {
										e.preventDefault();
										stopDraggingSelection();
									}
								}}
								onmouseleave={(e) => {
									if (ctx.state.isSelectionMode && ctx.state.isDraggingSelection) {
										e.preventDefault();
										stopDraggingSelection();
									}
								}}
							>
								<div
									bind:this={pageContentLayer}
									class="absolute top-0 left-0 origin-top-left transform"
									class:smooth-zoom={zoomPan.smoothTransition}
									style="width: {currentPageWidth}px; height: {currentPageHeight}px; transform: scale({ctx.state.zoom});"
								>
									<PDFPage
										documentId={pdfDocumentId}
										pageIndex={currentPage - 1}
										zoom={settledRenderZoom}
										width={currentPageWidth}
										height={currentPageHeight}
										isPanning={cameraIsLive}
										renderQualityMode={settledRenderQualityMode}
										deferUpdates={pageRenderDeferUpdates}
										visibilityRevision={pageRenderVisibilityRevision}
										visibilityViewport={pageRenderVisibilityViewport}
									/>

									<AnnotationCanvasLayer
										objects={canvasDrawableObjects}
										pageWidth={currentPageWidth}
										pageHeight={currentPageHeight}
										pageScale={annotationRenderZoom}
										{user}
										stroke_visibility={ctx.state.stroke_visibility}
										deferRedraw={ctx.state.deferAnnotationRedraw}
									/>

									<div class="absolute top-0 left-0 z-10 h-full w-full">
									{#each interactiveCurrentPageObjects as object (object.id)}
										{#if object.type === 'text'}
											<Text
												bind:isPenMode={ctx.state.isPenMode}
												shouldStartEditing={ctx.state.editingTextId === object.id}
												bind:isSelectionMode={ctx.state.isSelectionMode}
												isSelected={false}
												isPreviewed={isObjectPreviewed(object.id)}
												width={object.width}
												onUpdateText={(detail) => {
													if (object.owner !== user) return;
													updateObject(object.id, detail);
												}}
												viewOnly={object.owner !== user || isEditorDisabled}
												lines={object.lines}
												x={object.x}
												y={object.y}
												size={object.size}
												lineHeight={object.lineHeight}
												fontFamily={object.fontFamily}
												fontColor={object.fontColor}
												onTextSelected={({ size, lineHeight, fontFamily, fontColor }) => {
													if (object.owner !== user) return;
													ctx.state._size = normalizeFontSize(size);
													ctx.state._lineHeight = lineHeight;
													ctx.state._fontFamily = fontFamily;
													ctx.state._textColor = fontColor;
													ctx.state.showingAddingText = true;
													ctx.state.selectedTextId = object.id;
													ctx.state.selectedLineId = null;
												}}
												onTextUnselected={() => {
													ctx.state.isSelectionMode = true;
												}}
												pageScale={ctx.state.zoom}
											/>
										{:else if object.type === 'drawing' || object.type === 'highlight'}
											<Drawing
												{object}
												{user}
												bind:stroke_visibility={ctx.state.stroke_visibility}
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
												pageScale={ctx.state.zoom}
												isSelected={
													ctx.state.selectedObjectIds.length > 1 &&
													isObjectSelected(object.id) &&
													!selectionRotationState
												}
												isPreviewed={isObjectPreviewed(object.id)}
											/>
										{:else if object.type === 'line'}
											<Line
												{object}
												{user}
												bind:isPenMode={ctx.state.isPenMode}
												isAddingLine={ctx.state.isAddingLine}
												x={object.x}
												y={object.y}
												shapeWidth={object.width}
												shapeHeight={object.height}
												strokeColor={object.strokeColor}
												strokeWidth={object.strokeWidth}
												lineType={object.lineType || 'solid'}
												originWidth={object.originWidth}
												originHeight={object.originHeight}
												pageScale={ctx.state.zoom}
												isSelected={ctx.state.selectedLineId === object.id && !ctx.state.isSelectionMode}
												isObjectSelected={isObjectSelected(object.id) && !ctx.state.isSelectionMode}
												isPreviewed={isObjectPreviewed(object.id)}
												onSelect={selectLine}
												onUpdate={updateLine}
												onDelete={deleteLine}
											/>
										{:else if object.type === 'teacher-mark'}
											<TeacherMark
												{object}
												x={object.x}
												y={object.y}
												width={object.width}
												height={object.height}
												isSelected={false}
												isPreviewed={isObjectPreviewed(object.id)}
											/>
										{/if}
									{/each}

									<!-- Render temporary pointer strokes -->
									{#each ctx.state.temporaryStrokes as stroke (stroke.id)}
										<PointerStroke
											path={stroke.path}
											originWidth={stroke.originWidth}
											originHeight={stroke.originHeight}
											width={stroke.width}
											x={0}
											y={0}
											strokeColor={stroke.strokeColor}
											strokeWidth={stroke.strokeWidth}
											opacity={stroke.opacity}
											{stroke}
										/>
									{/each}
									</div>
								</div>

								{#if screenCurrentPageObjects.length > 0}
									<div
										class="pointer-events-none absolute top-0 left-0"
										style="width: {currentPageWidth * ctx.state.zoom}px; height: {currentPageHeight * ctx.state.zoom}px;"
										aria-hidden="true"
									>
										{#each screenCurrentPageObjects as object (object.id)}
											<Drawing
												{object}
												{user}
												bind:stroke_visibility={ctx.state.stroke_visibility}
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
												pageScale={ctx.state.zoom}
												screenScale={ctx.state.zoom}
												isSelected={
													ctx.state.selectedObjectIds.length > 1 &&
													isObjectSelected(object.id) &&
													!selectionRotationState
												}
												isPreviewed={isObjectPreviewed(object.id)}
											/>
										{/each}
									</div>
								{/if}

								{#if ctx.state.addingDrawing}
									<DrawingCanvas
										bind:isPenMode={ctx.state.isPenMode}
										pageScale={ctx.state.zoom}
										brushSize={ctx.state.brushSize}
										brushColor={ctx.state.brushColor}
										brushOpacity={ctx.state.brushOpacity}
										onStrokeStart={beginStrokeInteraction}
										onStrokeEnd={endStrokeInteraction}
										onStrokeCancel={cancelStrokeInteraction}
										onFinishDrawing={({
											originWidth,
											originHeight,
											path,
											brushSize,
											brushColor,
											brushOpacity
										}) => {
											if (isEditorDisabled) return;
											addDrawing(
												originWidth,
												originHeight,
												path,
												1,
												brushSize,
												brushColor,
												brushOpacity
											);
										}}
									/>
								{/if}
								{#if ctx.state.isHighlighting && hasTool('highlighter')}
									<HighlightCanvas
										bind:isPenMode={ctx.state.isPenMode}
										pageScale={ctx.state.zoom}
										highlightSize={ctx.state.highlightSize}
										highlightColor={ctx.state.highlightColor}
										onStrokeStart={beginStrokeInteraction}
										onStrokeEnd={endStrokeInteraction}
										onStrokeCancel={cancelStrokeInteraction}
										onFinishHighlight={({
											originWidth,
											originHeight,
											path,
											brushSize,
											brushColor,
											brushOpacity
										}) => {
											if (isEditorDisabled) return;
											addDrawing(
												originWidth,
												originHeight,
												path,
												1,
												brushSize,
												brushColor,
												brushOpacity,
												'highlight'
											);
											// Return to selection mode after highlighting
											ctx.state.isHighlighting = false;
											requestAnimationFrame(() => {
												ctx.state.isHighlighting = true;
											});
										}}
									/>
								{/if}
								{#if ctx.state.isErasing}
									<ErasingCanvas
										bind:isPenMode={ctx.state.isPenMode}
										{allObjects}
										pageScale={ctx.state.zoom}
										brushSize={ctx.state.ErasingBrushSize}
										brushColor={ctx.state.brushColor}
										batchDeleteObjects={batchDeleteObjectsByIds}
										onHighlightChange={handleTransientAnnotationStateChange}
										onStrokeStart={beginStrokeInteraction}
										onStrokeEnd={endStrokeInteraction}
										onStrokeCancel={cancelStrokeInteraction}
									/>
								{/if}
								{#if ctx.state.isAddingLine && hasTool('line')}
									<LineCanvas
										isAddingLine={ctx.state.isAddingLine}
										bind:isPenMode={ctx.state.isPenMode}
										pageScale={ctx.state.zoom}
										strokeColor={ctx.state.lineStrokeColor}
										strokeWidth={ctx.state.lineStrokeWidth}
										lineType={ctx.state.lineType}
										onFinishLine={(lineData) => {
											if (isEditorDisabled) return;
											addLine(lineData);
										}}
									/>
								{/if}
								{#if ctx.state.isPointerMode}
									<PointerCanvas
										bind:isPenMode={ctx.state.isPenMode}
										pageScale={ctx.state.zoom}
										onStrokeStart={beginStrokeInteraction}
										onStrokeEnd={endStrokeInteraction}
										onStrokeCancel={cancelStrokeInteraction}
										onFinishPointing={({ originWidth, originHeight, path }) => {
											if (isEditorDisabled) return;
											const id = genID();
											const stroke = {
												id,
												path,
												originWidth,
												originHeight,
												width: originWidth,
												strokeColor: '#FF0000',
												strokeWidth: POINTER_STROKE_WIDTH,
												opacity: 1,
												createdAt: Date.now()
											};

											ctx.state.temporaryStrokes = [...ctx.state.temporaryStrokes, stroke];

											const fadeStart = POINTER_DURATION - 500;
											const fadeInterval = setInterval(() => {
												const elapsed = Date.now() - stroke.createdAt;
												if (elapsed >= fadeStart) {
													const fadeProgress = (elapsed - fadeStart) / 500;
													const strokeIndex = ctx.state.temporaryStrokes.findIndex(
														(s) => s.id === id
													);
													if (strokeIndex !== -1) {
														ctx.state.temporaryStrokes[strokeIndex].opacity = Math.max(
															0,
															1 - fadeProgress
														);
														ctx.state.temporaryStrokes = [...ctx.state.temporaryStrokes];
													}
												}
											}, 50);

											setTimeout(() => {
												clearInterval(fadeInterval);
												ctx.state.temporaryStrokes = ctx.state.temporaryStrokes.filter(
													(s) => s.id !== id
												);
											}, POINTER_DURATION);
										}}
									/>
								{/if}
								{#if ctx.state.isSelectionMode}
									<SelectionCanvas
										bind:isPenMode={ctx.state.isPenMode}
										pageScale={ctx.state.zoom}
										{allObjects}
										bind:selectedObjectIds={ctx.state.selectedObjectIds}
										onSelectionChange={handleSelectionChange}
										onSelectionActiveChange={(selecting) => {
											isLassoSelecting = selecting;
										}}
										onLassoComplete={() => {
											ctx.state.justFinishedLassoSelection = true;
										}}
										onTextDoubleClick={handleTextDoubleClick}
										onLineDoubleClick={handleLineDoubleClick}
										isDraggingSelection={ctx.state.isDraggingSelection}
										{allowTeacherMark}
									/>
								{/if}
								{#if selectionResizeBox && !selectionRotationState}
									<div class="pointer-events-none absolute top-0 left-0 z-30 h-full w-full">
										<div
											class="pointer-events-none absolute border border-blue-500/40"
											style="
												left: {selectionResizeBox.x * ctx.state.zoom}px;
												top: {selectionResizeBox.y * ctx.state.zoom}px;
												width: {selectionResizeBox.width * ctx.state.zoom}px;
												height: {selectionResizeBox.height * ctx.state.zoom}px;
												border-width: 1px;
											"
										></div>
										{#if rotatableSelectedDrawingObjects.length > 0}
											<div
												class="pointer-events-none absolute bg-blue-400/50"
												style="
													left: {(selectionResizeBox.x + selectionResizeBox.width / 2) *
														ctx.state.zoom}px;
													top: {selectionResizeBox.y * ctx.state.zoom - 30}px;
													width: 1px;
													height: 24px;
												"
											></div>
											<button
												type="button"
												aria-label="Rotate selected drawings"
												title="Rotate"
												class="absolute flex items-center justify-center rounded-full border border-white bg-blue-500 text-white shadow-sm"
												style="
													left: {(selectionResizeBox.x + selectionResizeBox.width / 2) *
														ctx.state.zoom -
													10}px;
													top: {selectionResizeBox.y * ctx.state.zoom - 42}px;
													width: 20px;
													height: 20px;
													border-width: 2px;
													cursor: grab;
													pointer-events: auto;
													touch-action: none;
												"
												onpointerdown={handleSelectionRotationStart}
												onmousedown={(event) => event.stopPropagation()}
												ontouchstart={(event) => event.stopPropagation()}
												ontouchmove={(event) => event.stopPropagation()}
												ontouchend={(event) => event.stopPropagation()}
												ontouchcancel={(event) => event.stopPropagation()}
												onclick={(event) => event.stopPropagation()}
											>
												<LucideRotateCw size={12} strokeWidth={2.5} />
											</button>
										{/if}
										{#each resizeHandleConfigs as handle (handle.anchor)}
											<button
												type="button"
												aria-label={`Resize selected annotations from ${handle.anchor}`}
												title="Resize"
												class="absolute rounded-full border border-white bg-blue-500 shadow-sm"
												style="
													left: {(selectionResizeBox.x + selectionResizeBox.width * handle.x) *
														ctx.state.zoom -
													6}px;
													top: {(selectionResizeBox.y + selectionResizeBox.height * handle.y) *
														ctx.state.zoom -
													6}px;
													width: 12px;
													height: 12px;
													border-width: 2px;
													cursor: {handle.cursor};
													pointer-events: auto;
													touch-action: none;
												"
												onpointerdown={(event) => handleSelectionResizeStart(event, handle.anchor)}
												onmousedown={(event) => event.stopPropagation()}
												ontouchstart={(event) => event.stopPropagation()}
												ontouchmove={(event) => event.stopPropagation()}
												ontouchend={(event) => event.stopPropagation()}
												ontouchcancel={(event) => event.stopPropagation()}
												onclick={(event) => event.stopPropagation()}
											></button>
										{/each}
									</div>
								{/if}
							</div>
							</div>
								{#each rightAdjacentPreviewPages as pageNo (pageNo)}
									<div
										use:observeAdjacentPage={pageNo}
										class="pdf-page-stack pdf-page-stack--preview shrink-0"
										class:pdf-page-stack--compact={useCompactPageTabs}
										class:pdf-page-stack--minimal={useMinimalPageTabs}
										style="width: {pageStackWidth}px;"
									>
										<div class="pdf-page-tab pdf-page-tab--preview">
											{#if useCompactPageTabs}
												<div class="pdf-page-tab-copy pdf-page-tab-copy--compact">
													<div class="pdf-page-tab-title">Page {pageNo}</div>
													<div class="pdf-page-tab-status">
														<span class="pdf-page-tab-dot"></span>
														<span>Preview</span>
													</div>
												</div>
											{:else}
												<div class="pdf-page-tab-copy">
													<div class="pdf-page-tab-kicker">Preview only</div>
													<div class="pdf-page-tab-title">Page {pageNo}</div>
													<div class="pdf-page-tab-note">Switch to this page to edit</div>
												</div>
											{/if}
											{#if !useMinimalPageTabs}
												<button
													type="button"
													class="pdf-page-tab-open"
													aria-label={`Open page ${pageNo}`}
													onclick={() => goToPage(pageNo)}
												>
													{#if !useCompactPageTabs}
														<span>Open</span>
													{/if}
													<LucideArrowRight size={useCompactPageTabs ? 16 : 14} strokeWidth={2.4} />
												</button>
											{/if}
										</div>

										<div
											class="pdf-side-page pointer-events-none relative overflow-hidden rounded-sm bg-white shadow-md ring-1 ring-black/10"
											data-minimap-page={pageNo}
											style="width: {currentPageWidth * ctx.state.zoom}px; height: {currentPageHeight * ctx.state.zoom}px;"
											aria-hidden="true"
										>
											{#if isAdjacentPagePreviewVisible(pageNo)}
												<div
													class="absolute top-0 left-0 origin-top-left"
													class:smooth-zoom={zoomPan.smoothTransition}
													style="width: {currentPageWidth}px; height: {currentPageHeight}px; transform: scale({ctx.state.zoom});"
												>
													{#key `${pdfDocumentId}-side-right-${pageNo}`}
														<PDFPage
															documentId={pdfDocumentId}
															pageIndex={pageNo - 1}
															zoom={settledRenderZoom}
															width={currentPageWidth}
															height={currentPageHeight}
															isPanning={cameraIsLive}
															renderQualityMode={settledRenderQualityMode}
															deferUpdates={pageRenderDeferUpdates}
															visibilityRevision={pageRenderVisibilityRevision}
															visibilityViewport={pageRenderVisibilityViewport}
														/>
													{/key}
													<div class="absolute top-0 left-0 z-10 h-full w-full">
														{#each getAdjacentPageObjects(pageNo) as object (object.id)}
															{#if object.type === 'text'}
																<Text
																	isPenMode={false}
																	isSelectionMode={false}
																	isSelected={false}
																	width={object.width}
																	onUpdateText={() => {}}
																	viewOnly={true}
																	lines={object.lines}
																	x={object.x}
																	y={object.y}
																	size={object.size}
																	lineHeight={object.lineHeight}
																	fontFamily={object.fontFamily}
																	fontColor={object.fontColor}
																	onTextSelected={() => {}}
																	onTextUnselected={() => {}}
																	pageScale={ctx.state.zoom}
																/>
															{:else if object.type === 'drawing' || object.type === 'highlight'}
																<Drawing
																	{object}
																	{user}
																	bind:stroke_visibility={ctx.state.stroke_visibility}
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
																	pageScale={ctx.state.zoom}
																/>
															{:else if object.type === 'line'}
																<Line
																	{object}
																	{user}
																	isPenMode={false}
																	isAddingLine={false}
																	x={object.x}
																	y={object.y}
																	shapeWidth={object.width}
																	shapeHeight={object.height}
																	strokeColor={object.strokeColor}
																	strokeWidth={object.strokeWidth}
																	lineType={object.lineType || 'solid'}
																	originWidth={object.originWidth}
																	originHeight={object.originHeight}
																	pageScale={ctx.state.zoom}
																	isSelected={false}
																	isObjectSelected={false}
																/>
														{:else if object.type === 'teacher-mark'}
															<TeacherMark
																{object}
																x={object.x}
																y={object.y}
																width={object.width}
																height={object.height}
																isSelected={false}
																isPreviewed={false}
															/>
														{/if}
													{/each}
												</div>
											</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
									{:else if documentContent.isError}
										<div class="flex h-64 w-full items-center justify-center">
											<div
												class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
											>
												Failed to open PDF document.
											</div>
										</div>
									{:else}
										<div class="flex h-64 w-full items-center justify-center">
											<div class="flex flex-col items-center space-y-3">
												<div
													class="loading h-10 w-10 rounded-full border-4 border-amber-200 border-t-amber-500"
												></div>
												<p class="text-sm font-medium text-gray-600">Opening PDF document...</p>
											</div>
										</div>
									{/if}
								{/snippet}
						</PDFDocumentLoader>
					{/snippet}
				</EmbedPDF>
			{:else if pdfEngine.error}
				<div class="flex h-64 w-full items-center justify-center">
					<div
						class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
					>
						Failed to load PDF engine.
					</div>
				</div>
			{:else}
				<div class="flex h-64 w-full items-center justify-center">
					<div class="flex flex-col items-center space-y-4">
						<div
							class="loading h-10 w-10 rounded-full border-4 border-amber-200 border-t-amber-500"
						></div>
						<p class="text-base font-medium text-gray-600">Loading PDF...</p>
						<p class="text-xs font-medium text-gray-400">Refresh the page if it takes too long</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<HomeworkInfoModal {homework_info} bind:view_homework_info />

<style>
	:global(html.pdf-editor-active),
	:global(body.pdf-editor-active) {
		overflow: hidden;
		overscroll-behavior: none;
	}

	:global(.pdf-editor-touch-controls),
	:global(.pdf-editor-touch-controls button),
	:global(.pdf-editor-touch-controls input),
	:global(.pdf-editor-touch-controls select),
	:global(.pdf-editor-touch-controls [role='button']) {
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}

	.pdf-editor-scroll-root {
		position: fixed;
		inset: 0;
		width: 100dvw;
		height: 100dvh;
		overflow: auto;
		overscroll-behavior: contain;
		background: #f3f4f6;
		-webkit-overflow-scrolling: auto;
	}

	.pdf-canvas {
		touch-action: none;
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
		overscroll-behavior: contain;
	}

	.pdf-drawing-input-active,
	.pdf-drawing-input-active .pdf-canvas,
	.pdf-drawing-input-active .pdf-canvas * {
		touch-action: none;
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
		overscroll-behavior: contain;
	}

	.pdf-canvas--compact-active {
		--tw-ring-shadow: 0 0 0 1px rgb(251 191 36 / 0.82);
	}

	.pdf-workspace-shell {
		padding-right: 18rem;
		padding-left: 18rem;
	}

	.pdf-workspace {
		min-width: max-content;
		padding: 14rem 18rem 18rem;
	}

	.pdf-workspace--row {
		padding-top: 16rem;
		padding-bottom: 20rem;
	}

	.pdf-workspace--side-pages-off,
	.pdf-workspace--column {
		padding-right: 24rem;
		padding-left: 24rem;
	}

	.pdf-workspace--column {
		padding-top: 16rem;
		padding-bottom: 20rem;
	}

	.pdf-page-stack {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		container-type: inline-size;
	}

	.pdf-page-layout {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: 2rem;
	}

	.pdf-page-layout--row {
		flex-wrap: nowrap;
	}

	.pdf-page-layout--column {
		flex-direction: column;
		align-items: center;
	}

	.pdf-page-layout--column .pdf-page-stack {
		flex-direction: row;
		align-items: flex-start;
	}

	.pdf-page-layout--column .pdf-page-tab {
		align-self: flex-start;
		flex-direction: column;
		align-items: flex-start;
		justify-content: flex-start;
		width: 152px;
		min-width: 152px;
		max-width: 152px;
		min-height: 86px;
		margin-right: -1px;
		margin-bottom: 0;
		border-right: 0;
		border-bottom: 1px solid #dadce0;
		border-radius: 12px 0 0 12px;
		padding: 10px 12px;
	}

	.pdf-page-layout--column .pdf-page-tab--active {
		border-top: 1px solid #f9ab00;
		border-left: 3px solid #f9ab00;
	}

	.pdf-page-layout--column .pdf-page-tab-open {
		margin-top: 8px;
	}

	.pdf-page-tab {
		position: relative;
		display: flex;
		align-items: center;
		gap: 14px;
		justify-content: space-between;
		min-width: min(220px, 100%);
		max-width: 100%;
		margin-bottom: -1px;
		padding: 8px 14px 9px;
		border: 1px solid #dadce0;
		border-bottom: 0;
		border-radius: 12px 12px 0 0;
		background: #f8fafd;
		color: #5f6368;
		box-shadow: 0 -1px 2px rgba(60, 64, 67, 0.04);
		overflow: hidden;
		transition:
			padding 0.18s ease,
			gap 0.18s ease,
			box-shadow 0.18s ease,
			border-color 0.18s ease,
			background-color 0.18s ease;
	}

	.pdf-page-tab-copy {
		min-width: 0;
		overflow: hidden;
	}

	.pdf-page-tab--active {
		z-index: 1;
		background: #fff8e1;
		border-color: #f9ab00;
		border-top: 3px solid #f9ab00;
		color: #3c4043;
		box-shadow: 0 -2px 6px rgba(60, 64, 67, 0.08);
	}

	.pdf-page-tab--preview {
		background: #fffdf7;
		border-color: #ead9ad;
	}

	.pdf-page-tab-kicker {
		max-width: 100%;
		overflow: hidden;
		font-size: 0.62rem;
		font-weight: 800;
		line-height: 1;
		letter-spacing: 0.06em;
		text-overflow: ellipsis;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.pdf-page-tab--active .pdf-page-tab-kicker {
		color: #e8710a;
	}

	.pdf-page-tab-title {
		max-width: 100%;
		overflow: hidden;
		margin-top: 3px;
		font-size: 0.95rem;
		font-weight: 700;
		line-height: 1.05;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pdf-page-tab-note {
		max-width: 100%;
		overflow: hidden;
		margin-top: 3px;
		font-size: 0.66rem;
		font-weight: 600;
		line-height: 1.15;
		color: currentColor;
		opacity: 0.78;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pdf-page-tab-open {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		gap: 5px;
		height: 28px;
		border: 1px solid #f9ab00;
		border-radius: 999px;
		background: #fef7e0;
		padding: 0 10px;
		color: #b06000;
		font-size: 0.72rem;
		font-weight: 700;
		line-height: 1;
		box-shadow: 0 1px 2px rgba(60, 64, 67, 0.08);
		cursor: pointer;
	}

	.pdf-page-tab-open:hover {
		background: #feefc3;
		border-color: #f29900;
		color: #8c4a00;
	}

	.pdf-page-tab-open:focus-visible {
		outline: 2px solid #fbbc04;
		outline-offset: 2px;
	}

	.pdf-page-stack--compact .pdf-page-tab {
		gap: 8px;
		min-width: 100%;
		min-height: 44px;
		padding: 6px 8px;
		border-radius: 10px 10px 0 0;
		box-shadow: 0 -1px 2px rgba(60, 64, 67, 0.04);
	}

	.pdf-page-stack--compact .pdf-page-tab--active {
		border-top-width: 2px;
		box-shadow: 0 -1px 3px rgba(232, 113, 10, 0.12);
	}

	.pdf-page-stack--compact .pdf-page-tab-copy--compact {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 3px;
	}

	.pdf-page-stack--compact .pdf-page-tab-title,
	.pdf-page-stack--compact .pdf-page-tab-status {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pdf-page-stack--compact .pdf-page-tab-title {
		margin-top: 0;
		font-size: 0.82rem;
		line-height: 1;
	}

	.pdf-page-stack--compact .pdf-page-tab-status {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		color: #6f5b24;
		font-size: 0.68rem;
		font-weight: 700;
		line-height: 1;
	}

	.pdf-page-stack--compact .pdf-page-tab--active .pdf-page-tab-status {
		color: #c26401;
	}

	.pdf-page-tab-dot {
		width: 7px;
		height: 7px;
		flex: 0 0 7px;
		border-radius: 999px;
		background: #d0a437;
		box-shadow: 0 0 0 2px rgba(251, 188, 4, 0.12);
	}

	.pdf-page-tab--active .pdf-page-tab-dot {
		background: #e8710a;
		box-shadow: 0 0 0 2px rgba(232, 113, 10, 0.16);
	}

	.pdf-page-stack--compact .pdf-page-tab-open {
		width: 36px;
		height: 36px;
		justify-content: center;
		padding: 0;
	}

	.pdf-page-stack--minimal .pdf-page-tab {
		min-height: 34px;
		padding: 5px 7px;
	}

	.pdf-page-stack--minimal .pdf-page-tab-copy--compact {
		gap: 2px;
	}

	.pdf-page-stack--minimal .pdf-page-tab-title {
		font-size: 0.78rem;
	}

	.pdf-page-stack--minimal .pdf-page-tab-status span:last-child {
		display: none;
	}

	.pdf-page-stack--minimal .pdf-page-tab-status {
		gap: 0;
	}

	.pdf-page-layout--column .pdf-page-stack--compact .pdf-page-tab {
		width: 152px;
		min-width: 152px;
		max-width: 152px;
		min-height: 86px;
		margin-right: -1px;
		margin-bottom: 0;
		border-right: 0;
		border-bottom: 1px solid #dadce0;
		border-radius: 12px 0 0 12px;
		padding: 10px 12px;
	}

	.pdf-page-layout--column .pdf-page-stack--compact .pdf-page-tab--active {
		border-top-width: 1px;
		border-left-width: 3px;
		box-shadow: -2px 0 6px rgba(60, 64, 67, 0.08);
	}

	.pdf-page-layout--column .pdf-page-stack--compact .pdf-page-tab-open {
		width: 36px;
		height: 32px;
		margin-top: 8px;
	}

	.pdf-page-layout--column .pdf-page-stack--minimal .pdf-page-tab {
		width: 112px;
		min-width: 112px;
		max-width: 112px;
		min-height: 58px;
		padding: 7px 8px;
	}

	/* Smooth zoom transition */
	.smooth-zoom {
		transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		will-change: transform;
	}

	/* Page transition animation */
	.page-transition {
		animation: pageTransitionFade 0.3s ease-in-out;
	}

	@keyframes pageTransitionFade {
		0% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
		100% {
			opacity: 1;
		}
	}

	/* Loading spinner animation */
	.loading {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* iOS Safari specific fixes */
	@supports (-webkit-touch-callout: none) {
		/* Disable momentum scrolling on iOS during pan/zoom */
		body {
			-webkit-overflow-scrolling: auto;
			overscroll-behavior: contain;
		}
	}
</style>






