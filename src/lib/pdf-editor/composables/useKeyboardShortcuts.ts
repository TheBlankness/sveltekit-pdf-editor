import type { createPDFEditorContext } from '../context/pdfEditorContext.svelte';

type PDFEditorContext = ReturnType<typeof createPDFEditorContext>;

interface KeyboardShortcutModes {
	onSelectionMode: (currentState: boolean) => void;
	onAddDrawing: (currentState: boolean) => void;
	onErasing: (currentState: boolean) => void;
	onAddTextField: (currentState: boolean) => void;
	onHandMode: (currentState: boolean) => void;
	onHighlighting: (currentState: boolean) => void;
	activateLineMode: () => void;
	onPointerMode: (currentState: boolean) => void;
}

interface KeyboardShortcutActions {
	onUndo: () => void;
	onRedo: () => void;
	onSave: () => void;
}

/**
 * Helper function to check if the user is typing in an input field
 */
function isTypingInInputField(): boolean {
	const activeElement = document.activeElement;
	if (!activeElement) return false;

	const tagName = activeElement.tagName.toLowerCase();
	const isInput = tagName === 'input' || tagName === 'textarea';
	const isContentEditable =
		activeElement.getAttribute('contenteditable') === 'true' ||
		(activeElement as HTMLElement).isContentEditable;

	return isInput || isContentEditable;
}

/**
 * Composable for managing keyboard shortcuts in the PDF editor
 * @param modes - Object containing mode activation functions from usePDFModes
 * @param actions - Object containing action functions (undo, redo, save)
 * @param ctx - PDF editor context containing state
 * @returns Object with attach() and detach() methods for lifecycle management
 */
export function useKeyboardShortcuts(
	modes: KeyboardShortcutModes,
	actions: KeyboardShortcutActions,
	ctx: PDFEditorContext
) {
	// Track the previous tool state for temporary hand mode (space key)
	let previousToolState: {
		isSelectionMode?: boolean;
		addingDrawing?: boolean;
		isErasing?: boolean;
		isAddingText?: boolean;
		isHighlighting?: boolean;
		isAddingLine?: boolean;
		isPointerMode?: boolean;
	} | null = null;
	let isSpaceHeld = false;

	/**
	 * Key mapping: keyboard key -> mode activation function
	 */
	const keyMapping: Record<string, () => void> = {
		v: () => modes.onSelectionMode(ctx.state.isSelectionMode),
		V: () => modes.onSelectionMode(ctx.state.isSelectionMode),
		d: () => modes.onAddDrawing(ctx.state.addingDrawing),
		D: () => modes.onAddDrawing(ctx.state.addingDrawing),
		e: () => modes.onErasing(ctx.state.isErasing),
		E: () => modes.onErasing(ctx.state.isErasing),
		t: () => modes.onAddTextField(ctx.state.isAddingText),
		T: () => modes.onAddTextField(ctx.state.isAddingText),
		h: () => modes.onHandMode(ctx.state.isHandMode),
		H: () => modes.onHandMode(ctx.state.isHandMode)
	};

	/**
	 * Keyboard event handler
	 */
	function handleKeyDown(event: KeyboardEvent) {
		// Don't trigger shortcuts when typing in input fields
		if (isTypingInInputField()) {
			return;
		}

		const key = event.key;
		const ctrlKey = event.ctrlKey || event.metaKey; // Support both Ctrl (Windows/Linux) and Cmd (Mac)

		// Handle Ctrl/Cmd + Key shortcuts (undo, redo, save)
		if (ctrlKey) {
			// Ctrl+Z or Cmd+Z - Undo
			if (key === 'z' || key === 'Z') {
				if (!ctx.state.isPageDisabled) {
					event.preventDefault();
					actions.onUndo();
				}
				return;
			}

			// Ctrl+Y or Cmd+Y - Redo
			if (key === 'y' || key === 'Y') {
				if (!ctx.state.isPageDisabled) {
					event.preventDefault();
					actions.onRedo();
				}
				return;
			}

			// Ctrl+S or Cmd+S - Save
			if (key === 's' || key === 'S') {
				event.preventDefault();
				actions.onSave();
				return;
			}
		}

		// Don't trigger mode shortcuts when page is disabled
		if (ctx.state.isPageDisabled) {
			return;
		}

		// Handle Space key for temporary hand mode
		if (key === ' ') {
			event.preventDefault();

			// Only activate hand mode if space is not already held and we're not already in hand mode
			if (!isSpaceHeld && !ctx.state.isHandMode) {
				isSpaceHeld = true;

				// Save the current tool state
				previousToolState = {
					isSelectionMode: ctx.state.isSelectionMode,
					addingDrawing: ctx.state.addingDrawing,
					isErasing: ctx.state.isErasing,
					isAddingText: ctx.state.isAddingText,
					isHighlighting: ctx.state.isHighlighting,
					isAddingLine: ctx.state.isAddingLine,
					isPointerMode: ctx.state.isPointerMode
				};

				// Activate hand mode
				modes.onHandMode(false); // Pass false to activate it
			}
			return;
		}

		// Check if the key has a mapped action
		const action = keyMapping[key];
		if (action) {
			action();
		}
	}

	/**
	 * Keyboard key up handler - for releasing space key
	 */
	function handleKeyUp(event: KeyboardEvent) {
		// Don't trigger when typing in input fields
		if (isTypingInInputField()) {
			return;
		}

		const key = event.key;

		// Handle Space key release - restore previous tool
		if (key === ' ' && isSpaceHeld) {
			isSpaceHeld = false;
			event.preventDefault();

			// Restore the previous tool state if we have one
			if (previousToolState) {
				if (previousToolState.isSelectionMode) {
					modes.onSelectionMode(false);
				} else if (previousToolState.addingDrawing) {
					modes.onAddDrawing(false);
				} else if (previousToolState.isErasing) {
					modes.onErasing(false);
				} else if (previousToolState.isAddingText) {
					modes.onAddTextField(false);
				} else if (previousToolState.isHighlighting) {
					modes.onHighlighting(false);
				} else if (previousToolState.isAddingLine) {
					modes.activateLineMode();
				} else if (previousToolState.isPointerMode) {
					modes.onPointerMode(false);
				}

				previousToolState = null;
			}
		}
	}

	return {
		/**
		 * Attach keyboard event listeners to document
		 */
		attach() {
			document.addEventListener('keydown', handleKeyDown);
			document.addEventListener('keyup', handleKeyUp);
		},

		/**
		 * Remove keyboard event listeners from document
		 */
		detach() {
			document.removeEventListener('keydown', handleKeyDown);
			document.removeEventListener('keyup', handleKeyUp);
		}
	};
}
