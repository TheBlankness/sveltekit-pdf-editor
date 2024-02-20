import { readAsArrayBuffer } from './asyncReader.js';
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
import fontkit from '@pdf-lib/fontkit';
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

				const fontResponse = await fetch(
					'https://fonts.gstatic.com/s/roboto/v20/KFOmCnqEu92Fr1Mu4mxP.ttf'
				);
				const fontBytes = await fontResponse.arrayBuffer();
				pdfDoc.registerFontkit(fontkit);
				const customFont = await pdfDoc.embedFont(fontBytes, { subset: true });

				const height = size * lineHeight;
				const textContent = lines?.join('\n');
				return () => {
					page.drawText(textContent, {
						x,
						y: pageHeight - y - height, // Adjust y position for bottom-up rendering
						size,
						font: customFont,
						lineHeight: lineHeight * size,
						color: rgb(0, 0, 0) // Set a default color
					});
				};
			} else if (object.type === 'drawing') {
				let { x, y, path, scale, brushColor, brushSize } = object;
				const { r, g, b } = hexToRgb(brushColor);
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
						borderColor: rgb(r, g, b)
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

function hexToRgb(hex) {
	hex = hex.replace(/^#/, '');
	const bigint = parseInt(hex, 16);
	const r = ((bigint >> 16) & 255) / 255;
	const g = ((bigint >> 8) & 255) / 255;
	const b = (bigint & 255) / 255;
	return { r, g, b };
}
