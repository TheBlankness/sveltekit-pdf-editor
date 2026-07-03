<script lang="ts">
	import {
		ArrowRight,
		BookOpen,
		CheckCircle2,
		Download,
		Eraser,
		ExternalLink,
		FileText,
		Github,
		Hand,
		Highlighter,
		Layers,
		Map,
		MousePointer2,
		PenLine,
		Plug,
		Save,
		Settings,
		ShieldCheck,
		Type,
		Zap,
		ZoomIn
	} from 'lucide-svelte';

	const quickStartCode = `import { PdfEditor } from 'sveltekit-pdf-editor';

let pdfBlob: Blob | null = null;
let pageAnnotations = [];
let fileName = 'marked-document.pdf';

function handleDataUpdated(event) {
  pageAnnotations = event.detail.newData;
  localStorage.setItem('pdf-annotations', JSON.stringify(pageAnnotations));
}

<PdfEditor
  {pdfBlob}
  bind:pageAnnotations
  {fileName}
  ownerId="teacher-1"
  on:dataUpdated={handleDataUpdated}
/>`;

	const callbacksCode = `async function saveAnnotations(annotations) {
  await fetch('/api/pdf-annotations', {
    method: 'POST',
    body: JSON.stringify({ annotations })
  });
}

<PdfEditor
  {pdfBlob}
  {pageAnnotations}
  handleSave={saveAnnotations}
  onSaveAnnotations={saveAnnotations}
  handleComplete={saveAnnotations}
/>`;

	const pluginCode = `import {
  PdfEditor,
  defaultPdfEditorPlugins,
  createPdfEditorPlugin,
  penPlugin,
  textPlugin,
  linePlugin
} from 'sveltekit-pdf-editor';

const reviewOnlyPlugins = [penPlugin, textPlugin, linePlugin];

const customEmbedPdfPlugin = createPdfEditorPlugin({
  id: 'my-embedpdf-extension',
  label: 'My EmbedPDF extension',
  embedPdfRegistration: myEmbedPdfRegistration
});

const plugins = [
  ...defaultPdfEditorPlugins.filter((plugin) => plugin.tool !== 'pointer'),
  customEmbedPdfPlugin
];

<PdfEditor {pdfBlob} {pageAnnotations} {plugins} />`;

	const annotationCode = `type PageAnnotations = Annotation[][];

// pageAnnotations[0] contains annotations for page 1
// pageAnnotations[1] contains annotations for page 2
const pageAnnotations = [
  [
    {
      id: 'annotation-1',
      owner: 'teacher-1',
      type: 'drawing',
      path: 'M 12 40 L 120 40',
      x: 0,
      y: 0,
      originWidth: 595,
      originHeight: 842,
      width: 595,
      scale: 1,
      brushSize: 3,
      brushColor: '#111827'
    }
  ]
];`;

	const features = [
		{
			icon: PenLine,
			title: 'Natural annotation tools',
			description: 'Pen, highlighter, text, line, pointer, selection, and eraser tools are available as built-in plugins.'
		},
		{
			icon: Hand,
			title: 'Touch-first navigation',
			description: 'Hand panning, double-tap zoom, minimap controls, and responsive toolbar placement are built in.'
		},
		{
			icon: Layers,
			title: 'Multi-page rendering',
			description: 'The wrapper keeps per-page annotations synchronized while the core renders adjacent page previews.'
		},
		{
			icon: Download,
			title: 'Merged PDF export',
			description: 'Users can export a completed PDF with annotations merged into the original document.'
		},
		{
			icon: Save,
			title: 'Annotation-only saves',
			description: 'Persist just the annotation JSON when your application wants to store edits separately from the PDF.'
		},
		{
			icon: Plug,
			title: 'Plugin-controlled tools',
			description: 'Pass a plugin list to enable built-in tools, disable tools, or register EmbedPDF extensions.'
		}
	];

	const propRows = [
		['pdfBlob', 'Blob | File | ArrayBuffer | Uint8Array | null', 'null', 'The PDF source. When null, the component renders its slot instead of the editor.'],
		['pageAnnotations', 'any[][]', '[]', 'Annotation data grouped by page. Page 1 is index 0. Use this to restore or persist edits.'],
		['fileName', 'string', "''", 'Name used when creating File input and exporting a completed PDF.'],
		['ownerId', 'string', "'user1'", 'Default annotation owner id. Used to identify which annotations the current user can edit.'],
		['user', 'string | undefined', 'undefined', 'Overrides ownerId when you want a different active user id.'],
		['allowPrinting', 'boolean', 'true', 'Allows the editor UI to expose print/export actions when supported by the core.'],
		['disabled', 'boolean', 'false', 'Disables editing interactions for the whole document.'],
		['disabledPages', 'Array<{ from_page; to_page }>', '[]', 'Legacy prop for page ranges where editing should be disabled.'],
		['disabled_pages', 'Array<{ from_page; to_page }>', 'undefined', 'Core-style page range prop. Takes priority over disabledPages when provided.'],
		['currentPage', 'number', '1', 'Initial active page. The wrapper also emits pageChange when users navigate.'],
		['savingState', "'saving' | 'saved' | 'fail'", "'saved'", 'Legacy save state for showing saving or failure state in the toolbar.'],
		['saveState', 'SaveState | undefined', 'undefined', 'Preferred save state object. When provided, it overrides savingState.'],
		['autoSaveEnabled', 'boolean | undefined', 'undefined', 'Optional controlled auto-save toggle. Pass false for demos that should only save on explicit user action.'],
		['plugins', 'PdfEditorPlugin[]', 'defaultPdfEditorPlugins', 'Controls which built-in tools are enabled and which EmbedPDF registrations are installed.'],
		['allowTeacherMark', 'boolean', 'false', 'Enables the teacher mark/stamp workflow.'],
		['teacherMarkName', 'string', "'User'", 'Display name written into teacher mark metadata.'],
		['homework_info', 'any', 'undefined', 'Optional metadata passed to the homework info modal.'],
		['isPageLoading', 'boolean', 'false', 'Lets host apps tell the core to defer page-camera restore while external loading is active.'],
		['wasmUrl', 'string', "'/vendor/embedpdf/pdfium.wasm?v=2.14.4'", 'Location of the EmbedPDF PDFium wasm file. Keep the wasm version aligned with @embedpdf packages.'],
		['handleSave', '(annotations) => void | Promise<void>', 'undefined', 'Called when the editor save action runs. Receives all page annotations.'],
		['handleComplete', '(annotations) => void | Promise<void>', 'undefined', 'Called after save when the user completes the editing session.'],
		['onSaveAnnotations', '(annotations) => void | Promise<void>', 'undefined', 'Callback prop for persisting annotation-only JSON during save.'],
		['onAnnotationChange', '(annotations) => void', 'undefined', 'Callback prop fired whenever annotations change. Mirrors annotationsChange event data.'],
		['retryFailedSave', '() => void | Promise<void>', 'undefined', 'Called from the toolbar retry action when a save failed.']
	];

	const eventRows = [
		['dataUpdated', '{ newData, annotations, currentPage }', 'Fires whenever annotation data changes. Use detail.newData as the canonical all-page annotation payload.'],
		['annotationsChange', '{ annotations, currentPage }', 'A focused annotation-change event with the same all-page annotation payload.'],
		['save', '{ annotations, currentPage }', 'Fires after handleSave/onSaveAnnotations complete successfully.'],
		['done', '{ newData, annotations, currentPage }', 'Fires after completion save and handleComplete finish.'],
		['pageChange', '{ page, annotations }', 'Fires when the active page changes. annotations contains the destination page annotations.']
	];

	const pluginRows = [
		['select', 'Selection and object editing.'],
		['hand', 'Hand panning and drag navigation.'],
		['pen', 'Freehand drawing annotations.'],
		['eraser', 'Eraser mode and preview circle.'],
		['highlighter', 'Transparent highlight strokes.'],
		['text', 'Text annotations with font controls.'],
		['line', 'Line annotations with color, width, and style.'],
		['pointer', 'Temporary pointer strokes for review/presentation flows.'],
		['teacher-mark', 'Reserved tool id for teacher mark workflows.']
	];

	const pluginFields = [
		['id', 'Required stable plugin id.'],
		['tool', 'Optional built-in tool id. If omitted, the plugin can still carry an EmbedPDF registration.'],
		['enabled', 'Set to false to keep a plugin object in config while disabling it.'],
		['label', 'Human readable label for your own plugin management UI.'],
		['component', 'Reserved for custom UI plugins as the extension surface grows.'],
		['embedPdfRegistration', 'Optional registration object appended to the EmbedPDF plugin list.']
	];

	const stats = [
		['2.14.4', 'EmbedPDF/PDFium target'],
		['8', 'default tools'],
		['JSON', 'annotation save format']
	];
</script>

<svelte:head>
	<title>SvelteKit PDF Editor Library</title>
	<meta
		name="description"
		content="A SvelteKit PDF annotation library with modern UI, multi-page rendering, EmbedPDF support, annotation JSON saves, and a plugin-controlled tool system."
	/>
</svelte:head>

<div class="min-h-screen bg-zinc-50 text-zinc-950">
	<header class="border-b border-zinc-200 bg-white">
		<nav class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
			<a href="/" class="flex items-center gap-3 text-sm font-semibold text-zinc-950">
				<span class="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white">
					<FileText class="h-5 w-5" />
				</span>
				<span>sveltekit-pdf-editor</span>
			</a>
			<div class="hidden items-center gap-6 text-sm text-zinc-600 md:flex">
				<a class="hover:text-zinc-950" href="#features">Features</a>
				<a class="hover:text-zinc-950" href="#quick-start">Quick start</a>
				<a class="hover:text-zinc-950" href="#api">Props</a>
				<a class="hover:text-zinc-950" href="#plugins">Plugins</a>
			</div>
			<a
				href="/editor"
				class="inline-flex items-center gap-2 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
			>
				Live demo
				<ArrowRight class="h-4 w-4" />
			</a>
		</nav>
	</header>

	<main>
		<section class="border-b border-zinc-200 bg-white">
			<div class="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:px-8 lg:py-20">
				<div class="flex flex-col justify-center">
					<div class="mb-5 inline-flex w-fit items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
						<Zap class="h-4 w-4" />
						Modern EmbedPDF-powered annotation UI for SvelteKit
					</div>
					<h1 class="max-w-3xl text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
						A PDF editor library that ships the annotation workflow, not just a canvas.
					</h1>
					<p class="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
						Use one Svelte component for multi-page PDF rendering, touch-friendly zoom and panning, pen/highlighter/text/line tools, eraser preview, merged PDF export, and annotation-only persistence.
					</p>
					<div class="mt-8 flex flex-col gap-3 sm:flex-row">
						<a
							href="/editor"
							class="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-600"
						>
							Try the editor
							<ArrowRight class="h-4 w-4" />
						</a>
						<a
							href="#quick-start"
							class="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
						>
							Read the docs
							<BookOpen class="h-4 w-4" />
						</a>
						<a
							href="https://github.com/TheBlankness/sveltekit-pdf-editor"
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
						>
							GitHub
							<Github class="h-4 w-4" />
						</a>
					</div>
					<div class="mt-10 grid max-w-2xl grid-cols-3 gap-3">
						{#each stats as stat}
							<div class="border-l border-zinc-200 pl-4">
								<div class="text-2xl font-bold text-zinc-950">{stat[0]}</div>
								<div class="mt-1 text-sm text-zinc-500">{stat[1]}</div>
							</div>
						{/each}
					</div>
				</div>

				<div class="flex items-center">
					<div class="w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 shadow-sm">
						<div class="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
							<div class="flex items-center gap-2">
								<span class="h-2.5 w-2.5 rounded-full bg-red-400"></span>
								<span class="h-2.5 w-2.5 rounded-full bg-yellow-400"></span>
								<span class="h-2.5 w-2.5 rounded-full bg-green-400"></span>
							</div>
							<div class="text-xs font-medium text-zinc-500">review-pack.pdf</div>
						</div>
						<div class="grid min-h-[420px] grid-cols-[4rem_1fr] bg-zinc-100">
							<aside class="border-r border-zinc-200 bg-white px-2 py-4">
								<div class="space-y-2">
									{#each [MousePointer2, Hand, PenLine, Highlighter, Type, Eraser, ZoomIn, Map] as ToolIcon}
										<div class="flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700">
											<svelte:component this={ToolIcon} class="h-4 w-4" />
										</div>
									{/each}
								</div>
							</aside>
							<div class="relative flex items-center justify-center p-6">
								<div class="absolute right-4 top-4 grid w-20 gap-2 rounded-lg border border-zinc-200 bg-white p-2 shadow-sm">
									<div class="h-16 border border-amber-300 bg-amber-50"></div>
									<div class="h-16 border border-zinc-200 bg-white"></div>
									<div class="h-16 border border-zinc-200 bg-white"></div>
								</div>
								<div class="relative h-[340px] w-[240px] border border-zinc-200 bg-white shadow-sm">
									<div class="h-full px-8 py-9">
										<div class="mb-5 h-3 w-28 bg-zinc-900"></div>
										<div class="space-y-2">
											<div class="h-2 w-full bg-zinc-200"></div>
											<div class="h-2 w-5/6 bg-zinc-200"></div>
											<div class="h-2 w-4/6 bg-zinc-200"></div>
										</div>
										<div class="mt-8 h-16 border border-zinc-200 bg-zinc-50"></div>
										<div class="absolute left-10 top-36 h-1 w-32 rotate-[-7deg] rounded bg-amber-300 opacity-80"></div>
										<svg class="absolute left-12 top-48 h-24 w-40 overflow-visible" viewBox="0 0 160 96" aria-hidden="true">
											<path d="M4 48 C 32 10, 60 76, 94 28 S 136 38, 154 12" fill="none" stroke="#111827" stroke-width="4" stroke-linecap="round" />
											<path d="M20 78 L 122 78" fill="none" stroke="#f59e0b" stroke-width="5" stroke-linecap="round" opacity="0.65" />
										</svg>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section id="features" class="border-b border-zinc-200 bg-zinc-50 py-16">
			<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div class="max-w-3xl">
					<p class="text-sm font-semibold uppercase tracking-wide text-amber-700">Feature Set</p>
					<h2 class="mt-3 text-3xl font-bold tracking-tight text-zinc-950">Built for production review flows.</h2>
					<p class="mt-4 text-zinc-600">
						The public wrapper is meant for app developers; the copied core keeps the richer UI and rendering behavior behind it.
					</p>
				</div>
				<div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each features as feature}
						<div class="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
							<div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
								<svelte:component this={feature.icon} class="h-5 w-5" />
							</div>
							<h3 class="font-semibold text-zinc-950">{feature.title}</h3>
							<p class="mt-2 text-sm leading-6 text-zinc-600">{feature.description}</p>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<section id="quick-start" class="border-b border-zinc-200 bg-white py-16">
			<div class="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
				<div>
					<p class="text-sm font-semibold uppercase tracking-wide text-amber-700">Quick Start</p>
					<h2 class="mt-3 text-3xl font-bold tracking-tight text-zinc-950">Use the library wrapper first.</h2>
					<p class="mt-4 text-zinc-600">
						Import `PdfEditor` from the package, give it a PDF source, and store `pageAnnotations` whenever `dataUpdated` fires.
					</p>
					<div class="mt-6 space-y-3 text-sm text-zinc-700">
						<div class="flex gap-3"><CheckCircle2 class="mt-0.5 h-4 w-4 text-amber-600" /> Put `pdfium.wasm` at the configured `wasmUrl`.</div>
						<div class="flex gap-3"><CheckCircle2 class="mt-0.5 h-4 w-4 text-amber-600" /> Keep annotations as a page-indexed array.</div>
						<div class="flex gap-3"><CheckCircle2 class="mt-0.5 h-4 w-4 text-amber-600" /> Save JSON separately or export a merged PDF from the editor UI.</div>
					</div>
				</div>
				<div class="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 shadow-sm">
					<div class="border-b border-zinc-800 px-4 py-3 text-xs font-medium text-zinc-400">Basic usage</div>
					<pre class="overflow-x-auto p-5 text-sm leading-6 text-amber-100"><code>{quickStartCode}</code></pre>
				</div>
			</div>
		</section>

		<section class="border-b border-zinc-200 bg-zinc-50 py-16">
			<div class="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
				<div class="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
					<div class="mb-4 flex items-center gap-3 text-zinc-950">
						<Save class="h-5 w-5 text-amber-600" />
						<h2 class="text-xl font-bold">Annotation data model</h2>
					</div>
					<p class="mb-4 text-sm leading-6 text-zinc-600">
						`pageAnnotations` stores all annotation data without rewriting the PDF. Persist this payload when you want users to resume editing later.
					</p>
					<pre class="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-xs leading-5 text-amber-100"><code>{annotationCode}</code></pre>
				</div>
				<div class="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
					<div class="mb-4 flex items-center gap-3 text-zinc-950">
						<ShieldCheck class="h-5 w-5 text-amber-600" />
						<h2 class="text-xl font-bold">Save callbacks</h2>
					</div>
					<p class="mb-4 text-sm leading-6 text-zinc-600">
						Use callback props when you prefer direct functions over DOM events. Each save callback receives the all-page annotation array.
					</p>
					<pre class="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-xs leading-5 text-amber-100"><code>{callbacksCode}</code></pre>
				</div>
			</div>
		</section>

		<section id="api" class="border-b border-zinc-200 bg-white py-16">
			<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div class="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
					<div>
						<p class="text-sm font-semibold uppercase tracking-wide text-amber-700">API Reference</p>
						<h2 class="mt-3 text-3xl font-bold tracking-tight text-zinc-950">Props accepted by `PdfEditor`.</h2>
					</div>
					<p class="max-w-2xl text-sm leading-6 text-zinc-600">
						`PdfEditorCore` is exported for advanced integrations, but most apps should use `PdfEditor` so multi-page annotation sync, events, and legacy prop compatibility are handled for you.
					</p>
				</div>
				<div class="overflow-hidden rounded-lg border border-zinc-200">
					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-zinc-200 text-left text-sm">
							<thead class="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
								<tr>
									<th class="px-4 py-3 font-semibold">Prop</th>
									<th class="px-4 py-3 font-semibold">Type</th>
									<th class="px-4 py-3 font-semibold">Default</th>
									<th class="px-4 py-3 font-semibold">What it does</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-zinc-200 bg-white align-top">
								{#each propRows as row}
									<tr>
										<td class="whitespace-nowrap px-4 py-4 font-mono text-xs font-semibold text-zinc-950">{row[0]}</td>
										<td class="px-4 py-4 font-mono text-xs text-zinc-600">{row[1]}</td>
										<td class="px-4 py-4 font-mono text-xs text-zinc-600">{row[2]}</td>
										<td class="min-w-[20rem] px-4 py-4 text-zinc-600">{row[3]}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</section>

		<section class="border-b border-zinc-200 bg-zinc-50 py-16">
			<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div class="mb-8 max-w-3xl">
					<p class="text-sm font-semibold uppercase tracking-wide text-amber-700">Events</p>
					<h2 class="mt-3 text-3xl font-bold tracking-tight text-zinc-950">Subscribe with Svelte events or callback props.</h2>
				</div>
				<div class="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-zinc-200 text-left text-sm">
							<thead class="bg-white text-xs uppercase tracking-wide text-zinc-500">
								<tr>
									<th class="px-4 py-3 font-semibold">Event</th>
									<th class="px-4 py-3 font-semibold">Detail</th>
									<th class="px-4 py-3 font-semibold">When it fires</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-zinc-200 align-top">
								{#each eventRows as row}
									<tr>
										<td class="whitespace-nowrap px-4 py-4 font-mono text-xs font-semibold text-zinc-950">on:{row[0]}</td>
										<td class="px-4 py-4 font-mono text-xs text-zinc-600">{row[1]}</td>
										<td class="min-w-[20rem] px-4 py-4 text-zinc-600">{row[2]}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</section>

		<section id="plugins" class="border-b border-zinc-200 bg-white py-16">
			<div class="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
				<div>
					<p class="text-sm font-semibold uppercase tracking-wide text-amber-700">Plugin System</p>
					<h2 class="mt-3 text-3xl font-bold tracking-tight text-zinc-950">Install tools by passing plugins.</h2>
					<p class="mt-4 leading-7 text-zinc-600">
						The current plugin system controls the editor capabilities at runtime. A plugin can enable a built-in tool, be disabled with `enabled: false`, or attach an EmbedPDF registration that the core forwards into `&lt;EmbedPDF /&gt;`.
					</p>
					<div class="mt-6 grid gap-3 sm:grid-cols-2">
						{#each pluginRows as row}
							<div class="flex gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
								<Plug class="mt-0.5 h-4 w-4 flex-none text-amber-600" />
								<div>
									<div class="font-mono text-xs font-semibold text-zinc-950">{row[0]}</div>
									<div class="mt-1 text-xs leading-5 text-zinc-600">{row[1]}</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
				<div class="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 shadow-sm">
					<div class="border-b border-zinc-800 px-4 py-3 text-xs font-medium text-zinc-400">Plugin configuration</div>
					<pre class="overflow-x-auto p-5 text-sm leading-6 text-amber-100"><code>{pluginCode}</code></pre>
				</div>
			</div>
			<div class="mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
				<div class="overflow-hidden rounded-lg border border-zinc-200">
					<div class="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-950">PdfEditorPlugin fields</div>
					<div class="grid divide-y divide-zinc-200 bg-white md:grid-cols-2 md:divide-x md:divide-y-0">
						{#each pluginFields as field}
							<div class="p-4">
								<div class="font-mono text-xs font-semibold text-zinc-950">{field[0]}</div>
								<p class="mt-2 text-sm leading-6 text-zinc-600">{field[1]}</p>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</section>

		<section class="bg-amber-50 py-16">
			<div class="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
				<div>
					<p class="text-sm font-semibold uppercase tracking-wide text-amber-800">Ready to test</p>
					<h2 class="mt-3 text-3xl font-bold tracking-tight text-zinc-950">Open the demo and draw on a real PDF.</h2>
					<p class="mt-4 max-w-2xl text-zinc-700">
						The demo route uses the same exported `PdfEditor` wrapper documented above, so it is the best place to verify props, saves, and plugin combinations.
					</p>
				</div>
				<div class="flex flex-col gap-3 sm:flex-row">
					<a href="/editor" class="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800">
						Open live demo
						<ExternalLink class="h-4 w-4" />
					</a>
					<a href="#api" class="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-amber-100">
						Review props
						<Settings class="h-4 w-4" />
					</a>
				</div>
			</div>
		</section>
	</main>

	<footer class="border-t border-zinc-200 bg-white">
		<div class="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 py-8 text-sm text-zinc-500 sm:px-6 md:flex-row md:items-center lg:px-8">
			<div class="flex items-center gap-2">
				<FileText class="h-4 w-4 text-amber-600" />
				<span>sveltekit-pdf-editor</span>
			</div>
			<div class="flex flex-wrap gap-4">
				<a href="/editor" class="hover:text-zinc-950">Demo</a>
				<a href="#quick-start" class="hover:text-zinc-950">Quick start</a>
				<a href="#plugins" class="hover:text-zinc-950">Plugins</a>
				<a href="https://github.com/TheBlankness/sveltekit-pdf-editor" target="_blank" rel="noopener noreferrer" class="hover:text-zinc-950">GitHub</a>
			</div>
		</div>
	</footer>
</div>