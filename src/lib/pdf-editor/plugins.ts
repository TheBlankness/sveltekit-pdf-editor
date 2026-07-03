import type { ComponentType } from 'svelte';

export type PdfEditorToolId =
	| 'select'
	| 'hand'
	| 'pen'
	| 'eraser'
	| 'highlighter'
	| 'text'
	| 'line'
	| 'pointer'
	| 'teacher-mark';

export type PdfEditorPlugin = {
	id: string;
	tool?: PdfEditorToolId;
	enabled?: boolean;
	label?: string;
	component?: ComponentType;
	embedPdfRegistration?: unknown;
};

export const selectionPlugin: PdfEditorPlugin = { id: 'select', tool: 'select', label: 'Select' };
export const handPanPlugin: PdfEditorPlugin = { id: 'hand-pan', tool: 'hand', label: 'Hand' };
export const penPlugin: PdfEditorPlugin = { id: 'pen', tool: 'pen', label: 'Pen' };
export const eraserPlugin: PdfEditorPlugin = { id: 'eraser', tool: 'eraser', label: 'Eraser' };
export const highlighterPlugin: PdfEditorPlugin = {
	id: 'highlighter',
	tool: 'highlighter',
	label: 'Highlighter'
};
export const textPlugin: PdfEditorPlugin = { id: 'text', tool: 'text', label: 'Text' };
export const linePlugin: PdfEditorPlugin = { id: 'line', tool: 'line', label: 'Line' };
export const pointerPlugin: PdfEditorPlugin = { id: 'pointer', tool: 'pointer', label: 'Pointer' };

export const defaultPdfEditorPlugins: PdfEditorPlugin[] = [
	selectionPlugin,
	handPanPlugin,
	penPlugin,
	eraserPlugin,
	highlighterPlugin,
	textPlugin,
	linePlugin,
	pointerPlugin
];

export function createPdfEditorPlugin(plugin: PdfEditorPlugin): PdfEditorPlugin {
	return plugin;
}

export function resolvePdfEditorPlugins(plugins?: PdfEditorPlugin[] | null) {
	const activePlugins = (plugins?.length ? plugins : defaultPdfEditorPlugins).filter(
		(plugin) => plugin.enabled !== false
	);
	const enabledTools = new Set<PdfEditorToolId>();
	const embedPdfRegistrations: unknown[] = [];

	for (const plugin of activePlugins) {
		if (plugin.tool) enabledTools.add(plugin.tool);
		if (plugin.embedPdfRegistration) embedPdfRegistrations.push(plugin.embedPdfRegistration);
	}

	return {
		activePlugins,
		enabledTools,
		enabledToolMap: Object.fromEntries([...enabledTools].map((tool) => [tool, true])) as Partial<
			Record<PdfEditorToolId, boolean>
		>,
		embedPdfRegistrations
	};
}
