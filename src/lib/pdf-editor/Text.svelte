<script>
	import { onMount, onDestroy } from 'svelte';
	import { tapout } from './utils/tapout.js';

	// Props
	let {
		size = $bindable(),
		lineHeight = $bindable(),
		x = $bindable(),
		y = $bindable(),
		fontFamily = $bindable(),
		fontColor = $bindable('#000000'),
		pageScale = 1,
		lines = $bindable(),
		width = 100,
		onTextSelected,
		onTextUnselected,
		onUpdateText,
		viewOnly = false,
		isPenMode = $bindable(false),
		isSelectionMode = $bindable(false),
		isSelected = false,
		isPreviewed = false,
		placeholder = 'Add text here.',
		shouldStartEditing = false
	} = $props();

	// State variables
	let editable = $state();
	let operation = $state('');
	let debounceTimer = $state();
	let showPlaceholder = $state(true);
	let isEditing = $state(false);
	let lastRenderedLinesSignature = '';

	// Calculate bounding box dimensions for selection visualization
	let textHeight = $derived((lines?.length || 1) * size * lineHeight);
	let textWidth = $derived(width || 100);

	function normalizeLines(value = lines) {
		return Array.isArray(value) ? value.map((line) => String(line ?? '')) : [];
	}

	function getLinesSignature(value = lines) {
		return JSON.stringify(normalizeLines(value));
	}

	function isEmptyLinesValue(value = lines) {
		const normalizedLines = normalizeLines(value);
		return (
			normalizedLines.length === 0 ||
			(normalizedLines.length === 1 && normalizedLines[0].trim() === '')
		);
	}

	function commitTextUpdate() {
		if (!editable || operation !== 'edit') return;

		sanitize();
		const extractedLines = extractLines();
		lastRenderedLinesSignature = getLinesSignature(extractedLines);
		onUpdateText?.({
			lines: extractedLines,
			width: editable.clientWidth || 0
		});
	}

	function clearDebounceTimer() {
		if (!debounceTimer) return;

		clearTimeout(debounceTimer);
		debounceTimer = null;
	}

	// Debounced save function
	function debouncedSave() {
		clearDebounceTimer();

		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			commitTextUpdate();
		}, 500); // 500ms delay
	}

	function onFocus() {
		// Only allow focus if we're actively editing (from double-click)
		if (!isEditing) {
			editable?.blur();
			return;
		}

		onTextSelected({
			lineHeight,
			size,
			fontFamily,
			fontColor
		});
		operation = 'edit';
		updatePlaceholderVisibility();
	}

	function startEditing() {
		if (viewOnly) return;

		isEditing = true;
		operation = 'edit';
		isSelectionMode = false;

		// Focus after a small delay to ensure state is updated
		requestAnimationFrame(() => {
			editable?.focus();
		});
	}

	function handleDoubleClick(e) {
		if (viewOnly) return;

		// Prevent the double-click from bubbling to selection handlers
		e.stopPropagation();
		startEditing();
	}

	$effect(() => {
		if (shouldStartEditing && !viewOnly) {
			startEditing();
		}
	});

	async function onBlur() {

		if (operation !== 'edit') return;

		clearDebounceTimer();

		editable?.blur();
		commitTextUpdate();
		operation = '';
		isEditing = false;
		onTextUnselected();
		updatePlaceholderVisibility();
	}

	function onInput() {
		updatePlaceholderVisibility();
		debouncedSave();
	}

	function updatePlaceholderVisibility() {
		if (!editable) return;

		const hasContent = editable.textContent && editable.textContent.trim().length > 0;

		showPlaceholder = !hasContent && isEmptyLinesValue() && operation !== 'edit';
	}

	async function onPaste(e) {
		// Prevent default paste behavior
		e.preventDefault();

		// Get text only
		const pastedText = e.clipboardData.getData('text');

		// Insert pasted text
		const selection = document.getSelection();
		const range = selection?.getRangeAt(0);
		if (range) {
			range.insertNode(document.createTextNode(pastedText));
		}

		// Sanitize the inserted text
		sanitize();
		updatePlaceholderVisibility();
		debouncedSave();
	}

	function onKeydown(e) {
		if (!editable) return;

		// Only allow Enter key to create new lines
		if (e.key === 'Enter') {
			e.preventDefault();

			const selection = window.getSelection();
			if (!selection || selection.rangeCount === 0) return;

			const range = selection.getRangeAt(0);

			// Create a line break
			const br = document.createElement('br');
			range.deleteContents();
			range.insertNode(br);

			// Position cursor after the break
			range.setStartAfter(br);
			range.setEndAfter(br);
			selection.removeAllRanges();
			selection.addRange(range);
		}

		// Trigger placeholder update and save on any key input
		requestAnimationFrame(() => {
			updatePlaceholderVisibility();
			debouncedSave();
		});
	}

	function sanitize() {
		if (!editable) return;

		let weirdNode;
		while (
			(weirdNode = Array.from(editable.childNodes).find(
				(node) => !['#text', 'BR'].includes(node.nodeName)
			))
		) {
			editable.removeChild(weirdNode);
		}
	}

	function extractLines() {
		if (!editable) return [];

		const nodes = editable.childNodes;
		const lines = [];
		let lineText = '';
		for (let index = 0; index < nodes.length; index++) {
			const node = nodes[index];
			if (node.nodeName === 'BR') {
				lines.push(lineText);
				lineText = '';
			} else {
				lineText += node.textContent || '';
			}
		}
		lines.push(lineText);
		return lines;
	}

	const renderLines = () => {
		if (!editable) return;

		const fragment = document.createDocumentFragment();
		const normalizedLines = normalizeLines();
		lastRenderedLinesSignature = getLinesSignature(normalizedLines);

		if (isEmptyLinesValue(normalizedLines)) {
			// Empty state - let placeholder show
			editable.innerHTML = '';
			updatePlaceholderVisibility();
			return;
		}

		normalizedLines.forEach((line, index) => {
			const lineText = document.createTextNode(line);
			fragment.appendChild(lineText);

			// Add a <br> element after each line except the last one
			if (index !== normalizedLines.length - 1) {
				fragment.appendChild(document.createElement('br'));
			}
		});

		// Clear the existing content before appending the new lines
		editable.innerHTML = '';

		// Append the new lines to the editable div
		editable.appendChild(fragment);
		updatePlaceholderVisibility();
	};

	$effect(() => {
		const linesSignature = getLinesSignature(lines);
		if (!editable || operation === 'edit') return;

		if (linesSignature !== lastRenderedLinesSignature) {
			renderLines();
		} else {
			updatePlaceholderVisibility();
		}
	});

	// Handle clicking outside to close toolbar
	function handleTapout() {
		onBlur();
	}

	// Cleanup debounce timer on component destroy
	function cleanup() {
		clearDebounceTimer();
		commitTextUpdate();
		operation = '';
		isEditing = false;
	}

	onMount(() => {
		renderLines();
		updatePlaceholderVisibility();

		// Auto-enable editing for new empty text fields (not in selection mode)
		if (
			!viewOnly &&
			isEmptyLinesValue()
		) {
			isEditing = true;
			operation = 'edit';
			requestAnimationFrame(() => {
				editable?.focus();
			});
		}

	});

	onDestroy(() => {
		cleanup();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	use:tapout
	ontapout={handleTapout}
	class="absolute top-0 left-0 inline-block select-none"
	style="transform: translate({x}px, {y}px);"
	ondblclick={handleDoubleClick}
>
	<!-- Selection bounding box -->
	{#if isSelected }
		<div
			class="pointer-events-none absolute -inset-1 rounded"
			style="border: {1 / pageScale}px solid rgba(59, 130, 246, 0.3); width: {textWidth +
				8}px; height: {textHeight + 8}px; left: -4px; top: -4px;"
		></div>
	{/if}

	{#if isPreviewed}
		<div
			class="preview-box pointer-events-none absolute -inset-1 rounded"
			style="border: {2 / pageScale}px solid rgba(217, 119, 6, 0.8); background: rgba(245, 158, 11, 0.08); width: {textWidth +
				8}px; height: {textHeight + 8}px; left: -4px; top: -4px;"
		></div>
	{/if}

	<!-- Placeholder -->
	{#if !viewOnly && showPlaceholder}
		<div
			class="pointer-events-none absolute inset-0 mt-1 inline-block w-25 overflow-hidden whitespace-nowrap text-gray-400 select-none"
			style="font-size: {size}px; font-family: '{fontFamily}', serif; color: {fontColor}; line-height: {lineHeight};"
		>
			{placeholder}
		</div>
	{/if}
	<!-- Text Editor -->
	<div
		aria-label="Text editor"
		role="textbox"
		tabindex="-1"
		bind:this={editable}
		onfocus={onFocus}
		onkeydown={onKeydown}
		onpaste={onPaste}
		oninput={onInput}
		contenteditable={!viewOnly && isEditing}
		spellcheck="false"
		class="relative z-10 inline-block min-w-25 whitespace-nowrap transition-colors outline-none"
		class:cursor-text={!viewOnly && isEditing}
		class:cursor-default={viewOnly || !isEditing}
		style="font-size: {size}px; font-family: '{fontFamily}', serif;color: {fontColor};line-height: {lineHeight}; -webkit-user-select: {viewOnly ||
		!isEditing
			? 'none'
			: 'text'};"
	></div>
</div>

<style>
	.preview-box {
		animation: preview-pulse 0.75s ease-in-out infinite alternate;
	}

	@keyframes preview-pulse {
		from {
			opacity: 0.65;
		}
		to {
			opacity: 1;
		}
	}
</style>
