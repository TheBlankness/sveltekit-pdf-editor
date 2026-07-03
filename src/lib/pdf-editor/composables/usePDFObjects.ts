/**
 * usePDFObjects Composable
 *
 * @deprecated This composable is no longer used in PDFEditor.svelte.
 * The PDF editor now uses a command-based undo/redo system instead.
 * See PDFEditor.svelte for the current implementation.
 *
 * Manages PDF object (annotations) CRUD operations, undo/redo, and sorting.
 * Note: allObjects is now managed externally as a prop, not in context.
 */

import { getPDFEditorContext, type PDFObject } from '../context/pdfEditorContext.svelte';
import { toast, TOAST_WARNING } from '../utils/toast';


// Type order for rendering (higher number renders on top)
const TYPE_ORDER = {
	drawing: 1,
	highlight: 1,
	line: 2,
	text: 3
};

export function usePDFObjects(allObjects: PDFObject[], genID: () => string) {
	const ctx = getPDFEditorContext();

	/**
	 * Custom sort function to maintain rendering order
	 */
	function customSort(a: PDFObject, b: PDFObject) {
		const orderA = TYPE_ORDER[a.type as keyof typeof TYPE_ORDER] || 0;
		const orderB = TYPE_ORDER[b.type as keyof typeof TYPE_ORDER] || 0;

		if (orderA !== orderB) {
			return orderA - orderB;
		}

		return 0; // Same type, maintain relative positions
	}

	/**
	 * Add a drawing object
	 */
	function addDrawing(
		originWidth: number,
		originHeight: number,
		path: string,
		scale: number,
		brushSize: number,
		brushColor: string,
		brushOpacity: number
	) {
		const id = genID();
		const object: PDFObject = {
			id,
			owner: ctx.state.user,
			path,
			type: 'drawing',
			x: 0,
			y: 0,
			originWidth,
			originHeight,
			width: originWidth * scale,
			scale,
			rotation: 0,
			brushSize,
			brushColor,
			opacity: ctx.state.isHighlighting ? 0.5 : brushOpacity
		};

		allObjects.push(object);
		allObjects.sort(customSort);
		// Binding automatically syncs changes
	}

	/**
	 * Add a text field
	 */
	function addTextField(x: number, y: number) {
		const id = genID();
		const object: PDFObject = {
			id,
			owner: ctx.state.user,
			type: 'text',
			size: 16,
			width: 0,
			lineHeight: 1,
			fontFamily: ctx.state.currentFont,
			fontColor: ctx.state._textColor,
			x: x,
			y: y - 15,
			lines: ['']
		};

		allObjects.push(object);
		// Binding automatically syncs changes
	}

	/**
	 * Add a line object
	 */
	function addLine(lineData: {
		x: number;
		y: number;
		width: number;
		height: number;
		strokeColor: string;
		strokeWidth: number;
		originWidth: number;
		originHeight: number;
	}) {
		const id = genID();
		const object: PDFObject = {
			id,
			owner: ctx.state.user,
			type: 'line',
			x: lineData.x,
			y: lineData.y,
			width: lineData.width,
			height: lineData.height,
			strokeColor: lineData.strokeColor,
			strokeWidth: lineData.strokeWidth,
			originWidth: lineData.originWidth,
			originHeight: lineData.originHeight
		};

		allObjects.push(object);
		allObjects.sort(customSort);
		// Binding automatically syncs changes

		// After adding the line, select it and exit line adding mode
		ctx.state.selectedLineId = id;
		ctx.state.isAddingLine = false;
	}

	/**
	 * Update an object
	 */
	function updateObject(objectId: string, payload: Partial<PDFObject>) {
		if (ctx.state.isPageDisabled) return;

		const index = allObjects.findIndex((o) => o.id === objectId);
		if (index !== -1) {
			allObjects[index] = { ...allObjects[index], ...payload };
			// Binding automatically syncs changes
		}
	}

	/**
	 * Delete an object
	 */
	function deleteObject(objectId: string) {
		if (ctx.state.isPageDisabled) return;

		const index = allObjects.findIndex((o) => o.id === objectId);
		if (index !== -1) {
			allObjects.splice(index, 1);
			// Binding automatically syncs changes
		}
	}

	/**
	 * Delete an object by ID
	 * @deprecated Use the command-based system in PDFEditor.svelte instead
	 */
	function deleteObjectById(id: string) {
		const index = allObjects.findIndex((o) => o.id === id);
		if (index === -1) return;

		const foundObject = allObjects[index];
		if (foundObject.owner !== ctx.state.user) return;

		allObjects.splice(index, 1);
		// Binding automatically syncs changes
	}

	/**
	 * Undo last action
	 * @deprecated Use the command-based system in PDFEditor.svelte instead
	 */
	function handleUndo() {
		toast.push('handleUndo in usePDFObjects is deprecated. Use the command-based system instead.', {
			theme: TOAST_WARNING
		});
		// No-op
	}

	/**
	 * Redo last undone action
	 * @deprecated Use the command-based system in PDFEditor.svelte instead
	 */
	function handleRedo() {
		toast.push('handleRedo in usePDFObjects is deprecated. Use the command-based system instead.', {
			theme: TOAST_WARNING
		});
		// No-op
	}

	/**
	 * Select a line
	 */
	function selectLine(lineId: string) {
		const line = allObjects.find((obj) => obj.id === lineId && obj.type === 'line');
		if (line && line.owner !== ctx.state.user) return;

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
		}
	}

	/**
	 * Update a line
	 */
	function updateLine(lineId: string, updates: Partial<PDFObject>) {
		allObjects = allObjects.map((obj) =>
			obj.id === lineId && obj.type === 'line' ? { ...obj, ...updates } : obj
		);
		// Binding automatically syncs changes
	}

	/**
	 * Delete a line
	 */
	function deleteLine(lineId: string) {
		allObjects = allObjects.filter((obj) => obj.id !== lineId);
		ctx.state.selectedLineId = null;
		// Binding automatically syncs changes
	}

	/**
	 * Get the currently selected line
	 */
	function getSelectedLine() {
		if (!ctx.state.selectedLineId) return null;
		return allObjects.find(
			(obj) => obj.id === ctx.state.selectedLineId && obj.type === 'line'
		);
	}

	/**
	 * Update selected line stroke width
	 */
	function onUpdateSelectedLineStrokeWidth(width: number) {
		if (ctx.state.selectedLineId) {
			updateLine(ctx.state.selectedLineId, { strokeWidth: width });
		}
	}

	/**
	 * Update selected line stroke color
	 */
	function onUpdateSelectedLineStrokeColor(color: string) {
		if (ctx.state.selectedLineId) {
			updateLine(ctx.state.selectedLineId, { strokeColor: color });
		}
	}

	/**
	 * Delete selected objects (in selection mode)
	 */
	function deleteSelectedObjects() {
		if (ctx.state.selectedObjectIds.length === 0 || ctx.state.isPageDisabled) return;

		// Filter out selected objects (only allow deleting own objects)
		ctx.state.selectedObjectIds.forEach((id) => {
			const obj = allObjects.find((o) => o.id === id);
			if (obj && obj.owner === ctx.state.user) {
				deleteObject(id);
			}
		});

		ctx.state.selectedObjectIds = [];
	}

	/**
	 * Check if an object is selected
	 */
	function isObjectSelected(objectId: string) {
		return ctx.state.selectedObjectIds.includes(objectId);
	}

	return {
		addDrawing,
		addTextField,
		addLine,
		updateObject,
		deleteObject,
		deleteObjectById,
		handleUndo,
		handleRedo,
		selectLine,
		updateLine,
		deleteLine,
		getSelectedLine,
		onUpdateSelectedLineStrokeWidth,
		onUpdateSelectedLineStrokeColor,
		deleteSelectedObjects,
		isObjectSelected
	};
}


