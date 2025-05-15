<svelte:options immutable={true} />

<script>
	import { onMount, createEventDispatcher, afterUpdate } from 'svelte';
	import Toolbar from './Toolbar.svelte';
	import { pannable } from './utils/pannable.js';
	import { tapout } from './utils/tapout.js';
	import { timeout } from './utils/helper.js';
	import { Fonts } from './utils/prepareFonts.js';
	import { fly } from 'svelte/transition';

	export let size;

	export let lineHeight;
	export let x;
	export let y;
	export let fontFamily;
	export let pageScale = 1;
	export let lines;

	const Families = Object.keys(Fonts);
	const dispatch = createEventDispatcher();
	let startX;
	let startY;
	let editable;
	let _size = size;
	let _lineHeight = lineHeight;
	let _fontFamily = fontFamily;
	let dx = 0;
	let dy = 0;
	let operation = '';

	function handlePanMove(event) {
		dx = (event.detail.x - startX) / pageScale;
		dy = (event.detail.y - startY) / pageScale;
	}

	function handlePanEnd(event) {
		if (dx === 0 && dy === 0) {
			return editable.focus();
		}
		dispatch('update', {
			x: x + dx,
			y: y + dy
		});
		dx = 0;
		dy = 0;
		operation = '';
	}
	function handlePanStart(event) {
		startX = event.detail.x;
		startY = event.detail.y;
		operation = 'move';
	}
	function onFocus() {
		operation = 'edit';
	}
	async function onBlur() {
		if (operation !== 'edit' || operation === 'tool') return;
		editable.blur();
		sanitize();
		dispatch('update', {
			lines: extractLines(),
			width: editable.clientWidth
		});
		operation = '';
	}
	async function onPaste(e) {
		// Prevent default paste behavior
		e.preventDefault();

		// Get text only
		const pastedText = e.clipboardData.getData('text');

		// Insert pasted text
		document.getSelection()?.getRangeAt(0).insertNode(document.createTextNode(pastedText));

		// await tick() is not enough
		await timeout();

		// Sanitize the inserted text
		sanitize();
	}
	function onKeydown(e) {
		const childNodes = Array.from(editable.childNodes);
		if (e.keyCode === 13) {
			// prevent default adding div behavior
			e.preventDefault();
			const selection = window.getSelection();
			const focusNode = selection.focusNode;
			const focusOffset = selection.focusOffset;
			// the caret is at an empty line
			if (focusNode === editable) {
				editable.insertBefore(document.createElement('br'), childNodes[focusOffset]);
			} else if (focusNode instanceof HTMLBRElement) {
				editable.insertBefore(document.createElement('br'), focusNode);
			}
			// the caret is at a text line but not end
			else if (focusNode.textContent.length !== focusOffset) {
				const br = document.createElement('br');
				focusNode.parentNode.insertBefore(br, focusNode.nextSibling);
				selection.collapse(br, 0);
			}
			// the caret is at the end of a text line
			else {
				let br = focusNode.nextSibling;
				if (br) {
					editable.insertBefore(document.createElement('br'), br);
				} else {
					br = editable.appendChild(document.createElement('br'));
					br = editable.appendChild(document.createElement('br'));
				}
				// set selection to new line
				selection.collapse(br, 0);
			}
		}
	}
	function onFocusTool() {
		operation = 'tool';
	}
	async function onBlurTool() {
		if (operation !== 'tool' || operation === 'edit') return;
		dispatch('update', {
			lines: extractLines(),
			lineHeight: _lineHeight,
			size: _size,
			fontFamily: _fontFamily
		});
		operation = '';
	}
	function sanitize() {
		let weirdNode;
		while (
			(weirdNode = Array.from(editable.childNodes).find(
				(node) => !['#text', 'BR'].includes(node.nodeName)
			))
		) {
			editable.removeChild(weirdNode);
		}
	}
	function onChangeFont() {
		dispatch('selectFont', {
			name: _fontFamily
		});
	}

	function extractLines() {
		const nodes = editable.childNodes;
		const lines = [];
		let lineText = '';
		for (let index = 0; index < nodes.length; index++) {
			const node = nodes[index];
			if (node.nodeName === 'BR') {
				lines.push(lineText);
				lineText = '';
			} else {
				lineText += node.textContent;
			}
		}
		lines.push(lineText);
		return lines;
	}
	function onDelete() {
		dispatch('delete');
	}

	const renderLines = () => {
		const fragment = document.createDocumentFragment();
		lines?.forEach((line, index) => {
			const lineText = document.createTextNode(line);
			fragment.appendChild(lineText);

			// Add a <br> element after each line except the last one
			if (index !== lines.length - 1) {
				fragment.appendChild(document.createElement('br'));
			}
		});

		// Clear the existing content before appending the new lines
		editable.innerHTML = '';

		// Append the new lines to the editable div
		editable.appendChild(fragment);
	};

	onMount(() => {
		renderLines();
	});

	afterUpdate(() => {
		renderLines();
	});
</script>

{#if operation}
	<Toolbar>
		<button
			transition:fly={{ x: 0, y: -100 }}
			use:tapout
			on:tapout={onBlurTool}
			on:mousedown={onFocusTool}
			on:touchstart={onFocusTool}
			class="flex flex-row bg-white border border-gray-300 rounded-2xl p-3"
		>
			<div class="flex flex-row sm:flex">
				<svg
					class="w-6 h-6 mr-2 text-gray-800 dark:text-white"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 -960 960 960"
					><path
						d="M240-160 80-320l56-56 64 62v-332l-64 62-56-56 160-160 160 160-56 56-64-62v332l64-62 56 56-160 160Zm240-40v-80h400v80H480Zm0-240v-80h400v80H480Zm0-240v-80h400v80H480Z"
					/></svg
				>
				<div class="mr-2 flex items-center">
					<input
						type="number"
						min="1"
						max="10"
						step="0.1"
						class="border border-gray-400 h-6 w-12 text-center flex-shrink-0 rounded-sm"
						bind:value={_lineHeight}
					/>
				</div>
			</div>
			<div class="mr-2 flex items-center">
				<svg
					class="w-6 h-6 mr-1 text-gray-800 dark:text-white"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 -960 960 960"
					><path
						d="M608-180v-557H398v-43h462v43H650v557h-42Zm-382 0v-340H100v-44h293v44H267v340h-41Z"
					/></svg
				>
				<input
					type="number"
					min="12"
					max="120"
					step="1"
					class="border border-gray-400 h-6 w-12 text-center flex-shrink-0 rounded-sm"
					bind:value={_size}
				/>
			</div>
			<div class="mr-2 flex items-center">
				<svg
					class="w-6 h-6 mr-1 text-gray-800 dark:text-white"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 -960 960 960"
					><path
						d="M200.106-100q-50.677 0-75.392-20.75Q100-141.5 100-183q0-55.296 46.26-70.55 46.259-15.254 109.512-15.254H276v-53.389q0-28.291-2-48.549t-6.13-34.386q-4.131-14.128-11-21Q250-433 242-433q-9.5 0-16.375 3.364-6.875 3.363-10.625 7.303-4 3.939-5 9.17-1 5.232 1 10.939 5.455 10.626 12.727 20.77Q231-371.31 231-357.989q0 23.786-16.676 40.388Q197.647-301 173.824-301 150-301 133.5-317.494 117-333.989 117-357.552q0-25.448 11.516-41.768 11.516-16.319 31.189-25.919 19.673-9.6 45.584-13.18Q231.2-442 260.276-442 340-442 372-413t32 102.198v139.74q0 18.062 5 26.562t14.842 8.5q10.737 0 17.447-18Q448-172 450-207h11q-3.422 58.821-22.474 82.911Q419.474-100 372.806-100 331-100 308-112.5T279-151q-8.956 28.093-27.971 39.546Q232.015-100 200.106-100Zm353.981 0Q534-100 524-116.038q-10-16.039-3.673-34.136l95.645-255.27Q622-422 636.927-432q14.926-10 32.999-10 18.074 0 32.732 10.143 14.659 10.143 20.666 26.682l95.349 255.001q6.327 18.097-3.887 34.136Q804.571-100 784.839-100q-11.839 0-21.816-6.583-9.977-6.584-13.965-18.155L730.131-180H609l-19.026 55.238q-3.805 10.476-13.318 17.619Q567.143-100 554.087-100Zm-306.681-27Q260-127 268-146.96q8-19.96 8-47.474V-258q-24.8 0-35.9 14.898-11.1 14.898-11.1 48.538v10.573Q229-149 232.875-138t14.531 11ZM634-246h72l-36-108-36 108Zm-35.672-271Q554-517 526.5-548.996 499-580.991 499-634.808 499-733 560.5-796q61.5-63 161.61-63 42.89 0 65.89 8.787 23 8.788 23 22.663 0 5.55-1.786 11.05-1.785 5.5-6.5 11.333Q797-799 790.152-796.5q-6.848 2.5-14.152.5-14.221-4.2-30.765-6.6-16.544-2.4-30.331-2.4Q648-805 606.5-759.534T565-639.239Q565-619 572.273-596q7.272 23 34.727 23 9.375 0 19.188-3.5Q636-580 645-590q16.043-17.11 29.726-57.035 13.683-39.924 25.007-96.959 1.844-12.839 9.906-17.923Q717.701-767 731.928-767 749-767 758-758t4.75 23.298Q751-693 746.5-663.101t-4.5 54.192q0 19.225 5 27.567Q752-573 762-573q10.663 0 20.841-8.053Q793.02-589.105 811-609q3-4 14.143-6 6.857 0 11.357 5.647 4.5 5.647 4.5 16Q841-567 810.536-542.5T746.752-518Q722-518 704-532q-18-14-24-37-14.245 24.582-35.138 38.291Q623.969-517 598.328-517ZM138-518v-209.712Q138-783 176.712-821.5t94.5-38.5Q327-860 365.5-821.35t38.5 93.875V-518h-76v-76.259H214V-518h-76Zm76-152h114v-57.176Q328-751 311.324-767.5q-16.677-16.5-40.5-16.5Q247-784 230.5-767.375 214-750.75 214-727v57Z"
					/></svg
				>
				<div class="relative w-20 md:w-40 border border-gray-400">
					<select bind:value={_fontFamily} on:change={onChangeFont} class="font-family">
						{#each Families as family}
							<option value={family}>{family}</option>
						{/each}
					</select>
					<div
						class="pointer-events-none absolute inset-y-0 right-0 flex
            items-center px-2 text-gray-700"
					>
						<svg
							class="fill-current h-4 w-4"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
						>
							<path
								d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757
                6.586 4.343 8z"
							/>
						</svg>
					</div>
				</div>
			</div>
			<button on:click={onDelete} class=" cursor-pointer">
				<svg
					class="w-6 h-6 mr-1 text-gray-800 dark:text-white"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 -960 960 960"
					><path
						d="M222-140v-584h-40v-54h176v-36h246v36h176v54h-40v584H222Zm54-54h410v-530H276v530Zm105-81h54v-368h-54v368Zm146 0h54v-368h-54v368ZM276-724v530-530Z"
					/></svg
				>
			</button>
		</button>
	</Toolbar>
{/if}
<div
	use:tapout
	on:tapout={onBlur}
	class="absolute left-0 top-0 select-none"
	style="transform: translate({x + dx}px, {y + dy}px); max-width: 300px;"
>
	<div
		use:pannable
		on:panstart={handlePanStart}
		on:panmove={handlePanMove}
		on:panend={handlePanEnd}
		class="absolute w-full h-full cursor-grab"
		class:cursor-grab={!operation}
		class:cursor-grabbing={operation === 'move'}
		class:editing={['edit', 'tool'].includes(operation)}
	/>
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		bind:this={editable}
		on:focus={onFocus}
		on:keydown={onKeydown}
		on:paste|preventDefault={onPaste}
		contenteditable="true"
		spellcheck="false"
		class="outline-none whitespace-nowrap p-2"
		style="font-size: {_size}px; font-family: '{_fontFamily}', serif;
    line-height: {_lineHeight}; -webkit-user-select: text; width:{200}px; "
	/>
</div>

<style>
	.editing {
		pointer-events: none;
		border: 1px dashed #2d3748; /* Equivalent to border-gray-800 */
	}
	.font-family {
		display: block;
		appearance: none;
		height: 1.5rem; /* Tailwind's h-6 */
		width: 100%; /* Tailwind's w-full */
		background-color: white; /* Tailwind's bg-white */
		padding-left: 0.5rem; /* Tailwind's pl-2 */
		padding-right: 2rem; /* Tailwind's pr-8 */
		border-radius: 0.125rem; /* Tailwind's rounded-sm */
		line-height: 1.25rem; /* Tailwind's leading-tight */
	}
</style>
