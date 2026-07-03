/**
 * usePDFModes Composable
 *
 * Manages tool mode switching logic for the PDF editor.
 * Ensures only one mode is active at a time and handles mode transitions.
 */

import { getPDFEditorContext } from '../context/pdfEditorContext.svelte';

export function usePDFModes() {
	const ctx = getPDFEditorContext();

	/**
	 * Toggle drawing mode
	 */
	function onAddDrawing(isAddingDrawing: boolean) {
		if (ctx.selectedPageIndex >= 0) {
			ctx.state.addingDrawing = !isAddingDrawing;
			ctx.state.isErasing = false;
			ctx.state.isAddingLine = false;
			ctx.state.isAddingText = false;
			ctx.state.isHighlighting = false;
			ctx.state.isPointerMode = false;
			ctx.state.isCursorMode = false;
			ctx.state.showingZoom = false;
			ctx.state.selectedLineId = null;
			ctx.state.showingAddingText = false;
			ctx.state.isSelectionMode = false;
			ctx.state.isHandMode = false;
			ctx.state.selectedObjectIds = [];
		}
	}

	/**
	 * Toggle erasing mode
	 */
	function onErasing(currentIsErasing: boolean) {
		if (ctx.selectedPageIndex >= 0) {
			ctx.state.isErasing = !currentIsErasing;
			ctx.state.addingDrawing = false;
			ctx.state.isAddingLine = false;
			ctx.state.isAddingText = false;
			ctx.state.isHighlighting = false;
			ctx.state.isPointerMode = false;
			ctx.state.isCursorMode = false;
			ctx.state.showingZoom = false;
			ctx.state.selectedLineId = null;
			ctx.state.showingAddingText = false;
			ctx.state.isSelectionMode = false;
			ctx.state.isHandMode = false;
			ctx.state.selectedObjectIds = [];
		}
	}

	/**
	 * Toggle highlighting mode
	 */
	function onHighlighting(isHighlighting: boolean) {
		if (ctx.selectedPageIndex >= 0) {
			ctx.state.isHighlighting = !isHighlighting;
			ctx.state.addingDrawing = false;
			ctx.state.isErasing = false;
			ctx.state.isPointerMode = false;
			ctx.state.isAddingLine = false;
			ctx.state.isAddingText = false;
			ctx.state.isCursorMode = false;
			ctx.state.showingZoom = false;
			ctx.state.selectedLineId = null;
			ctx.state.showingAddingText = false;
			ctx.state.isSelectionMode = false;
			ctx.state.isHandMode = false;
			ctx.state.selectedObjectIds = [];
		}
	}

	/**
	 * Toggle line drawing mode
	 */
	function activateLineMode(_isAddingLine: boolean) {
		if (ctx.selectedPageIndex >= 0) {
			ctx.state.isAddingLine = !_isAddingLine;
			ctx.state.addingDrawing = false;
			ctx.state.isErasing = false;
			ctx.state.isHighlighting = false;
			ctx.state.isPointerMode = false;
			ctx.state.isAddingText = false;
			ctx.state.isCursorMode = false;
			ctx.state.showingZoom = false;
			ctx.state.selectedLineId = null;
			ctx.state.isPenMode = false;
			ctx.state.showingAddingText = false;
			ctx.state.isSelectionMode = false;
			ctx.state.isHandMode = false;
			ctx.state.selectedObjectIds = [];
		}
	}

	/**
	 * Toggle pointer mode
	 */
	function onPointerMode(_isPointerMode: boolean) {
		if (ctx.selectedPageIndex >= 0) {
			ctx.state.isPointerMode = !_isPointerMode;
			ctx.state.addingDrawing = false;
			ctx.state.isErasing = false;
			ctx.state.isHighlighting = false;
			ctx.state.isCursorMode = false;
			ctx.state.isAddingText = false;
			ctx.state.isAddingLine = false;
			ctx.state.showingZoom = false;
			ctx.state.selectedLineId = null;
			ctx.state.showingAddingText = false;
			ctx.state.isSelectionMode = false;
			ctx.state.isHandMode = false;
			ctx.state.selectedObjectIds = [];
		}
	}

	/**
	 * Toggle selection mode
	 */
	function onSelectionMode(_isSelectionMode: boolean) {
		if (ctx.selectedPageIndex >= 0) {
			ctx.state.isSelectionMode = !_isSelectionMode;
			ctx.state.addingDrawing = false;
			ctx.state.isErasing = false;
			ctx.state.isHighlighting = false;
			ctx.state.isPointerMode = false;
			ctx.state.isAddingText = false;
			ctx.state.isAddingLine = false;
			ctx.state.isCursorMode = false;
			ctx.state.isHandMode = false;
			ctx.state.showingZoom = false;
			ctx.state.selectedLineId = null;
			ctx.state.showingAddingText = false;

			// Clear selection when exiting selection mode
			if (!ctx.state.isSelectionMode) {
				ctx.state.selectedObjectIds = [];
			}
		}
	}

	/**
	 * Toggle hand mode for panning
	 */
	function onHandMode(_isHandMode: boolean) {
		if (ctx.selectedPageIndex >= 0) {
			ctx.state.isHandMode = !_isHandMode;
			ctx.state.addingDrawing = false;
			ctx.state.isErasing = false;
			ctx.state.isHighlighting = false;
			ctx.state.isPointerMode = false;
			ctx.state.isAddingText = false;
			ctx.state.isAddingLine = false;
			ctx.state.isCursorMode = false;
			ctx.state.showingZoom = false;
			ctx.state.selectedLineId = null;
			ctx.state.showingAddingText = false;
			ctx.state.isSelectionMode = false;

			// Clear selection when entering hand mode
			ctx.state.selectedObjectIds = [];
		}
	}

	/**
	 * Toggle text adding mode
	 */
	function onAddTextField(_isAddingText: boolean) {
		if (ctx.state.isAddingDisabled) return;

		ctx.state.addingDrawing = false;
		ctx.state.isErasing = false;
		ctx.state.isAddingLine = false;
		ctx.state.isHighlighting = false;
		ctx.state.isPointerMode = false;
		ctx.state.selectedLineId = null;
		ctx.state.isHandMode = false;
		ctx.state.isSelectionMode = false;
		ctx.state.selectedObjectIds = [];

		if (_isAddingText) {
			ctx.state.AddTextButtonField = 'Add Text';
			ctx.state.isAddingText = false;
			ctx.state.isCursorMode = false;
		} else {
			ctx.state.AddTextButtonField = 'Click anywhere to add text';
			ctx.state.isAddingText = true;
			ctx.state.isCursorMode = true;
		}
	}

	/**
	 * Toggle zoom panel
	 */
	function toggleZoomPanel() {
		ctx.state.showingZoom = !ctx.state.showingZoom;
		if (ctx.state.showingZoom) {
			ctx.state.addingDrawing = false;
			ctx.state.isErasing = false;
			ctx.state.isAddingLine = false;
			ctx.state.isAddingText = false;
			ctx.state.isHighlighting = false;
			ctx.state.isPointerMode = false;
			ctx.state.isCursorMode = false;
			ctx.state.selectedLineId = null;
		}
	}

	return {
		onAddDrawing,
		onErasing,
		onHighlighting,
		activateLineMode,
		onPointerMode,
		onSelectionMode,
		onHandMode,
		onAddTextField,
		toggleZoomPanel
	};
}
