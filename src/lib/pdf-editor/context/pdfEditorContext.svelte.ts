/**
 * PDFEditor Context
 *
 * Provides centralized state management for the PDF editor using Svelte 5 context API.
 * This eliminates prop drilling and makes state accessible to all child components.
 */

import { getContext, setContext } from 'svelte';

// Context key symbol for type safety
const PDF_EDITOR_CONTEXT_KEY = Symbol('pdfEditor');

export interface SaveState {
	status: 'idle' | 'saving' | 'saved' | 'local_saved' | 'cloud_saved' | 'fail';
	hasUnsavedChanges?: boolean;
	lastLocalSave?: string;
	lastCloudSave?: string;
}

export interface AnnotationCache {
	teacher: any[];
	global: any[];
	student: any[];
	merged: any[];
	timestamp: number;
	fetchSuccess?: boolean; // Track if cloud fetch was successful
	serverAnnotationsUnknown?: boolean; // Local edits must be merged additively once cloud data returns
}

export interface ConflictResolution {
	show: boolean;
	pageNo: number;
	localData: any[];
	cloudData: any[];
	localTimestamp: number;
	cloudTimestamp: number;
	recommendLocal: boolean;
}

export interface PDFObject {
	id: string;
	owner: string;
	type: 'text' | 'drawing' | 'line' | 'image' | 'highlight' | 'teacher-mark';
	x: number;
	y: number;
	[key: string]: unknown; // Allow additional properties specific to each type
}

export type RenderQualityMode = 'performance' | 'default' | 'sharp';
export type ToolbarPosition = 'bottom' | 'left' | 'right';
export type InteractionMode = 'idle' | 'drawing' | 'panning' | 'zooming' | 'saving';

export interface PDFEditorState {
	// PDF State
	pdfFile: File | undefined;
	pdfName: string;
	pages: number[];
	zoom: number;
	currentPage: number;
	internalPage: number;
	maxPage: number;
	minPage: number;
	PDFReady: boolean;
	isPageLoading: boolean;

	// Tool Modes
	addingDrawing: boolean;
	isErasing: boolean;
	isHighlighting: boolean;
	isAddingLine: boolean;
	isAddingText: boolean;
	isPointerMode: boolean;
	isSelectionMode: boolean;
	isCursorMode: boolean;
	isPenMode: boolean;
	isHandMode: boolean;

	// Tool Settings
	brushSize: number;
	brushColor: string;
	brushOpacity: number;
	ErasingBrushSize: number;
	highlightSize: number;
	highlightColor: string;
	lineStrokeColor: string;
	lineStrokeWidth: number;
	lineType: 'solid' | 'dotted' | 'dashed';

	// Text Tool State
	isAddingDisabled: boolean;
	AddTextButtonField: string;
	selectedTextId: string | null;
	editingTextId: string | null;
	_textColor: string;
	_size: number;
	_lineHeight: number;
	_fontFamily: string;
	currentFont: string;
	showingAddingText: boolean;
	isToolbarFocused: boolean;

	// Line Tool State
	selectedLineId: string | null;

	// Selection State
	selectedObjectIds: string[];
	isDraggingSelection: boolean;
	isPanning: boolean;
	dragStartPoint: { x: number; y: number };
	originalPositions: Map<string, { x: number; y: number }>;
	justFinishedDragging: boolean;
	justFinishedLassoSelection: boolean;

	// Pointer Mode State
	temporaryStrokes: unknown[];

	// UI State
	saving: boolean;
	showingZoom: boolean;
	zoomEnabled: boolean;
	doubleTapZoomEnabled: boolean;
	autoSaveEnabled: boolean;
	renderQualityMode: RenderQualityMode;
	isFullscreen: boolean;
	stroke_visibility: 'all' | 'self' | 'others';
	smoothTransition: boolean;
	activeInteraction: InteractionMode;
	isDrawingStroke: boolean;
	isZooming: boolean;
	deferAnnotationRedraw: boolean;
	cameraRevision: number;
	toolbarPosition: ToolbarPosition;
	rememberDrawingSettings: boolean;

	// User & Permissions
	user: string;
	isPageDisabled: boolean;
	disabled_pages: Array<{ from_page: number; to_page: number }>;

	// Save State
	saveState: SaveState;

	// Homework Info
	homework_info: unknown;
	allowPrinting: boolean;
	allowTeacherMark: boolean;
	teacherMarkName: string;
}

/**
 * Creates and initializes the PDF editor context with all state and actions
 */
export function createPDFEditorContext(initialState: Partial<PDFEditorState> = {}) {
	// Initialize state with defaults
	const state = $state<PDFEditorState>({
		// PDF State
		pdfFile: initialState.pdfFile,
		pdfName: initialState.pdfName || '',
		pages: initialState.pages || [],
		zoom: initialState.zoom || 2,
		currentPage: initialState.currentPage || 1,
		internalPage: initialState.internalPage || 1,
		maxPage: initialState.maxPage || 1,
		minPage: initialState.minPage || 1,
		PDFReady: initialState.PDFReady || false,
		isPageLoading: initialState.isPageLoading || false,

		// Tool Modes
		addingDrawing: initialState.addingDrawing || false,
		isErasing: initialState.isErasing || false,
		isHighlighting: initialState.isHighlighting || false,
		isAddingLine: initialState.isAddingLine || false,
		isAddingText: initialState.isAddingText || false,
		isPointerMode: initialState.isPointerMode || false,
		isSelectionMode:
			initialState.isSelectionMode !== undefined ? initialState.isSelectionMode : false,
		isCursorMode: initialState.isCursorMode || false,
		isPenMode: initialState.isPenMode || false,
		isHandMode: initialState.isHandMode || false,

		// Tool Settings
		brushSize: initialState.brushSize || 1,
		brushColor: initialState.brushColor || '#232529',
		brushOpacity: initialState.brushOpacity || 1.0,
		ErasingBrushSize: initialState.ErasingBrushSize || 5,
		highlightSize: initialState.highlightSize || 10,
		highlightColor: initialState.highlightColor || '#F5B900',
		lineStrokeColor: initialState.lineStrokeColor || '#232529',
		lineStrokeWidth: initialState.lineStrokeWidth || 2,
		lineType: initialState.lineType || 'solid',

		// Text Tool State
		isAddingDisabled: initialState.isAddingDisabled || false,
		AddTextButtonField: initialState.AddTextButtonField || 'Add Text',
		selectedTextId: initialState.selectedTextId || null,
		editingTextId: initialState.editingTextId || null,
		_textColor: initialState._textColor || '#232529',
		_size: initialState._size || 16,
		_lineHeight: initialState._lineHeight || 1.5,
		_fontFamily: initialState._fontFamily || 'Roboto',
		currentFont: initialState.currentFont || 'Roboto',
		showingAddingText: initialState.showingAddingText || false,
		isToolbarFocused: initialState.isToolbarFocused || false,

		// Line Tool State
		selectedLineId: initialState.selectedLineId || null,

		// Selection State
		selectedObjectIds: initialState.selectedObjectIds || [],
		isDraggingSelection: initialState.isDraggingSelection || false,
		isPanning: initialState.isPanning || false,
		dragStartPoint: initialState.dragStartPoint || { x: 0, y: 0 },
		originalPositions: initialState.originalPositions || new Map(),
		justFinishedDragging: initialState.justFinishedDragging || false,
		justFinishedLassoSelection: initialState.justFinishedLassoSelection || false,

		// Pointer Mode State
		temporaryStrokes: initialState.temporaryStrokes || [],

		// UI State
		saving: initialState.saving || false,
		showingZoom: initialState.showingZoom || false,
		zoomEnabled: initialState.zoomEnabled !== undefined ? initialState.zoomEnabled : true,
		doubleTapZoomEnabled: initialState.doubleTapZoomEnabled || false,
		autoSaveEnabled:
			initialState.autoSaveEnabled !== undefined ? initialState.autoSaveEnabled : true,
		renderQualityMode: initialState.renderQualityMode || 'default',
		isFullscreen: initialState.isFullscreen || false,
		stroke_visibility: initialState.stroke_visibility || 'all',
		smoothTransition: initialState.smoothTransition || false,
		activeInteraction: initialState.activeInteraction || 'idle',
		isDrawingStroke: initialState.isDrawingStroke || false,
		isZooming: initialState.isZooming || false,
		deferAnnotationRedraw: initialState.deferAnnotationRedraw || false,
		cameraRevision: initialState.cameraRevision || 0,
		toolbarPosition: initialState.toolbarPosition || 'bottom',
		rememberDrawingSettings: initialState.rememberDrawingSettings || false,

		// User & Permissions
		user: initialState.user || '',
		isPageDisabled: initialState.isPageDisabled || false,
		disabled_pages: initialState.disabled_pages || [{ from_page: 0, to_page: 0 }],

		// Save State
		saveState: initialState.saveState || {
			status: 'idle',
			hasUnsavedChanges: false
		},

		// Homework Info
		homework_info: initialState.homework_info,
		allowPrinting: initialState.allowPrinting || false,
		allowTeacherMark: initialState.allowTeacherMark || false,
		teacherMarkName: initialState.teacherMarkName || 'Teacher'
	});

	/**
	 * Context object with state and utility functions
	 */
	const context = {
		// Direct state access for reading
		get state() {
			return state;
		},

		// State update functions
		updateState<K extends keyof PDFEditorState>(key: K, value: PDFEditorState[K]) {
			state[key] = value;
		},

		updateMultipleStates(updates: Partial<PDFEditorState>) {
			Object.assign(state, updates);
		},

		// Derived values
		get selectedPageIndex(): number {
			return state.currentPage - 1;
		},

		get inputValue(): string {
			return state.internalPage.toString();
		},

		get paginatedPages(): number[] {
			const itemsPerPage = 1;
			return state.pages.slice(
				(state.currentPage - 1) * itemsPerPage,
				state.currentPage * itemsPerPage
			);
		},

		// Utility: Reset all tool modes
		resetAllModes() {
			state.addingDrawing = false;
			state.isErasing = false;
			state.isHighlighting = false;
			state.isAddingLine = false;
			state.isAddingText = false;
			state.isPointerMode = false;
			state.isSelectionMode = false;
			state.isCursorMode = false;
			state.isHandMode = false;
			state.showingZoom = false;
			state.selectedLineId = null;
			state.showingAddingText = false;
		},

		// Utility: Activate a specific mode (deactivates others)
		activateMode(
			mode: keyof Pick<
				PDFEditorState,
				| 'addingDrawing'
				| 'isErasing'
				| 'isHighlighting'
				| 'isAddingLine'
				| 'isAddingText'
				| 'isPointerMode'
				| 'isSelectionMode'
				| 'isHandMode'
			>
		) {
			context.resetAllModes();
			state[mode] = true;
		}
	};

	return context;
}

/**
 * Sets the PDF editor context
 */
export function setPDFEditorContext(initialState?: Partial<PDFEditorState>) {
	const context = createPDFEditorContext(initialState);
	setContext(PDF_EDITOR_CONTEXT_KEY, context);
	return context;
}

/**
 * Gets the PDF editor context
 * Must be called from a component that has PDFEditor as an ancestor
 */
export function getPDFEditorContext() {
	const context = getContext<ReturnType<typeof createPDFEditorContext>>(PDF_EDITOR_CONTEXT_KEY);

	if (!context) {
		throw new Error('getPDFEditorContext must be called within a PDFEditor component tree');
	}

	return context;
}

/**
 * Type guard for checking if context is available
 */
export function hasPDFEditorContext(): boolean {
	try {
		getPDFEditorContext();
		return true;
	} catch {
		return false;
	}
}
