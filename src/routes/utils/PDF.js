import { readAsArrayBuffer } from './asyncReader.js';
import { fetchFont, getAsset } from './prepareAssets';
import { noop } from './helper.js';
import {
	PDFDocument,
	pushGraphicsState,
	setLineCap,
	popGraphicsState,
	setLineJoin,
	LineCapStyle,
	LineJoinStyle,
	rgb
} from 'pdf-lib';
import download from 'downloadjs';
export async function save(pdfFile, objects, name) {
	let pdfDoc;
	try {
		pdfDoc = await PDFDocument.load(await readAsArrayBuffer(pdfFile));
	} catch (e) {
		console.log('Failed to load PDF.');
		throw e;
	}
	const pagesProcesses = pdfDoc.getPages().map(async (page, pageIndex) => {
		const pageObjects = objects[pageIndex];
		// 'y' starts from bottom in PDFLib, use this to calculate y
		const pageHeight = page.getHeight();
		const embedProcesses = pageObjects.map(async (object) => {
			if (object.type === 'image') {
				let { file, x, y, width, height } = object;
				let img;
				try {
					if (file.type === 'image/jpeg') {
						img = await pdfDoc.embedJpg(await readAsArrayBuffer(file));
					} else {
						img = await pdfDoc.embedPng(await readAsArrayBuffer(file));
					}
					return () =>
						page.drawImage(img, {
							x,
							y: pageHeight - y - height,
							width,
							height
						});
				} catch (e) {
					console.log('Failed to embed image.', e);
					return noop;
				}
			} else if (object.type === 'text') {
				const { x, y, lines, lineHeight, size, fontFamily } = object;
				const height = size * lineHeight;
				console.log(height);
				const textContent = lines?.join('\n');
				return () => {
					page.drawText(textContent, {
						x,
						y: pageHeight - y - height, // Adjust y position for bottom-up rendering
						size,
						lineHeight: lineHeight * size,
						color: rgb(0, 0, 0) // Set a default color
					});
				};
			} else if (object.type === 'drawing') {
				let { x, y, path, scale, color, brushSize } = object;

				return () => {
					page.pushOperators(
						pushGraphicsState(),
						setLineCap(LineCapStyle.Round),
						setLineJoin(LineJoinStyle.Round)
					);
					page.drawSvgPath(path, {
						borderWidth: brushSize,
						scale,
						x,
						y: pageHeight - y,
						borderColor: rgb(0.95, 0.1, 0.1)
					});
					page.pushOperators(popGraphicsState());
				};
			}
		});
		// embed objects in order
		const drawProcesses = await Promise.all(embedProcesses);
		drawProcesses.forEach((p) => p());
	});
	await Promise.all(pagesProcesses);
	try {
		const pdfBytes = await pdfDoc.save();
		download(pdfBytes, name, 'application/pdf');
		return pdfBytes;
	} catch (e) {
		console.log('Failed to save PDF.');
		throw e;
	}
}
