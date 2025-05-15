<script lang="ts">
	// import type { PageData } from './$types';
	import { FileUp, Download, FileText, Code, Github, ArrowRight } from 'lucide-svelte';

	// export let data: PageData;
</script>

<div class="w-full min-h-screen bg-white">
	<main class="w-full max-w-7xl mx-auto">
		<!-- Hero Section -->
		<div
			class="flex flex-col items-center justify-center py-16 px-4 sm:px-6 lg:px-8 border-b border-gray-100"
		>
			<div class="max-w-3xl text-center">
				<h1 class="text-5xl font-bold text-gray-900 mb-6">
					sveltekit-pdf-editor
					<span class="bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
						Streamlined PDF Editing
					</span>
				</h1>
				<p class="mt-4 text-xl text-gray-600 mb-8">
					A lightweight, customizable PDF editor component for SvelteKit applications that makes
					working with PDF annotations simple and intuitive.
				</p>
				<div class="flex flex-wrap justify-center gap-4">
					<a
						href="#documentation"
						class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
					>
						View Documentation <ArrowRight class="ml-2 h-5 w-5" />
					</a>
					<a
						href="https://github.com/TheBlankness/sveltekit-pdf-editor"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
					>
						<Github class="mr-2 h-5 w-5" /> GitHub Repository
					</a>
				</div>
			</div>
		</div>

		<!-- Features -->
		<div class="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
			<div class="max-w-3xl mx-auto text-center">
				<h2 class="text-3xl font-bold text-gray-900 mb-8">Key Features</h2>
			</div>
			<div class="mt-12 max-w-5xl mx-auto grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
				<div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
					<div
						class="h-12 w-12 rounded-md bg-amber-100 text-amber-500 flex items-center justify-center mb-4"
					>
						<FileText class="h-6 w-6" />
					</div>
					<h3 class="text-lg font-medium text-gray-900 mb-2">PDF Annotations</h3>
					<p class="text-gray-600">
						Create, edit, and manage annotations on PDF documents with an intuitive interface.
					</p>
				</div>
				<div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
					<div
						class="h-12 w-12 rounded-md bg-amber-100 text-amber-500 flex items-center justify-center mb-4"
					>
						<FileUp class="h-6 w-6" />
					</div>
					<h3 class="text-lg font-medium text-gray-900 mb-2">Simple Integration</h3>
					<p class="text-gray-600">
						Easily integrate with SvelteKit applications with minimal configuration. Offline usage
						is supported.
					</p>
				</div>
				<div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
					<div
						class="h-12 w-12 rounded-md bg-amber-100 text-amber-500 flex items-center justify-center mb-4"
					>
						<Download class="h-6 w-6" />
					</div>
					<h3 class="text-lg font-medium text-gray-900 mb-2">Download Support</h3>
					<p class="text-gray-600">
						Optional download functionality for edited PDFs with customized file names.
					</p>
				</div>
			</div>
		</div>

		<!-- Documentation -->
		<div id="documentation" class="py-16 px-4 sm:px-6 lg:px-8">
			<div class="max-w-4xl mx-auto">
				<h2 class="text-3xl font-bold text-gray-900 mb-8">Documentation</h2>

				<!-- Installation -->
				<div class="mb-12">
					<h3 class="text-2xl font-semibold text-gray-900 mb-4">Installation</h3>
					<div class="bg-gray-800 p-4 rounded-md overflow-x-auto">
						<pre class="text-amber-300 whitespace-pre"><code>yarn add sveltekit-pdf-editor</code
							></pre>
					</div>
				</div>

				<!-- Usage -->
				<div class="mb-12">
					<h3 class="text-2xl font-semibold text-gray-900 mb-4">Basic Usage</h3>
					<p class="text-gray-600 mb-4">
						Import the component, provide a PDF blob, and handle annotations:
					</p>
					<div class="bg-gray-800 p-4 rounded-md overflow-x-auto mb-4">
						<pre class="text-amber-300 whitespace-pre"><code
								>{`<PdfEditor
  {pdfBlob}
  {pageAnnotations}
  {fileName}
  user="John"
  allowDownload={true}
  disablePages={[]}
  on:annotationChange={handleAnnotationChange}
  on:dataUpdated={handleDataUpdate}
  on:done={handleDone}
/>`}</code
							></pre>
					</div>
				</div>

				<!-- Props Reference -->
				<div class="mb-12">
					<h3 class="text-2xl font-semibold text-gray-900 mb-4">Props Reference</h3>
					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th
										class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Prop</th
									>
									<th
										class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Type</th
									>
									<th
										class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Default</th
									>
									<th
										class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Description</th
									>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								<tr>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
										>pdfBlob</td
									>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Blob</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{`{}`}</td>
									<td class="px-6 py-4 text-sm text-gray-500">The PDF file blob to edit</td>
								</tr>
								<tr>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
										>pageAnnotations</td
									>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Array</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">[]</td>
									<td class="px-6 py-4 text-sm text-gray-500"
										>Array of annotation objects for the PDF</td
									>
								</tr>
								<tr>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
										>allowDownload</td
									>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Boolean</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">false</td>
									<td class="px-6 py-4 text-sm text-gray-500"
										>Enable/disable download functionality</td
									>
								</tr>
								<tr>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
										>fileName</td
									>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">String</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">''</td>
									<td class="px-6 py-4 text-sm text-gray-500">Filename for the downloaded PDF</td>
								</tr>
								<tr>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
										>disablePages</td
									>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
										>{`[{
		from_page: number;
		to_page: number;
	}]`}</td
									>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">[]</td>
									<td class="px-6 py-4 text-sm text-gray-500"
										>Array of page numbers to disable editing on</td
									>
								</tr>
								<tr>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
										>ownerId</td
									>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">String</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">''</td>
									<td class="px-6 py-4 text-sm text-gray-500"
										>User identifier to mark ownership of annotations for multi-user support</td
									>
								</tr>
							</tbody>
						</table>
					</div>
				</div>

				<!-- Events -->
				<div class="mb-12">
					<h3 class="text-2xl font-semibold text-gray-900 mb-4">Events</h3>
					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th
										class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Event</th
									>
									<th
										class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Detail</th
									>
									<th
										class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
										>Description</th
									>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								<tr>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
										>annotationChange</td
									>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
										>Array of annotation objects</td
									>
									<td class="px-6 py-4 text-sm text-gray-500"
										>Fired when annotations are created, updated, or deleted</td
									>
								</tr>
								<tr>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
										>dataUpdated</td
									>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Object</td>
									<td class="px-6 py-4 text-sm text-gray-500"
										>Fired when any data within the editor is updated</td
									>
								</tr>
								<tr>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">done</td
									>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Object</td>
									<td class="px-6 py-4 text-sm text-gray-500"
										>Fired when the user completes the editing session</td
									>
								</tr>
							</tbody>
						</table>
					</div>
				</div>

				<!-- Example Demo -->
				<div class="mb-12">
					<h3 class="text-2xl font-semibold text-gray-900 mb-4">Try It Out</h3>
					<div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
						<div class="text-center">
							<p class="mb-6 text-gray-600">
								See the PDF editor in action with our interactive demo
							</p>
							<a
								href="/editor"
								class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
							>
								<FileText class="mr-2 h-5 w-5" />
								Try the Live Demo
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Footer -->
		<footer class="bg-gray-50 border-t border-gray-100">
			<div
				class="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center"
			>
				<div class="flex items-center">
					<FileText class="h-8 w-8 text-amber-500 mr-2" />
					<span class="text-xl font-semibold text-gray-900">sveltekit-pdf-editor</span>
				</div>
				<div class="mt-8 md:mt-0">
					<a
						href="https://github.com/TheBlankness/sveltekit-pdf-editor"
						target="_blank"
						rel="noopener noreferrer"
						class="text-gray-500 hover:text-amber-500 flex items-center"
					>
						<Github class="h-5 w-5 mr-2" />
						<span>GitHub Repository</span>
					</a>
				</div>
			</div>
		</footer>
	</main>
</div>
