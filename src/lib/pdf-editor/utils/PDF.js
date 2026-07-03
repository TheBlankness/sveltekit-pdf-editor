import { readAsArrayBuffer } from './asyncReader.js';
import { fetchFontbyName, Fonts } from './prepareFonts.js';
import {
	PDFDocument,
	degrees,
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
import { toast, TOAST_ERROR } from './toast';

import { getTeacherMarkColorPreset, getTeacherMarkIcon } from './teacherMarkPresets';

const DEFAULT_FONT_FAMILY = 'Roboto';
const DEFAULT_TEXT_COLOR = '#000000';

function getPageObjects(objects, pageIndex, currentPage = 1) {
	if (!Array.isArray(objects)) return [];
	if (Array.isArray(objects[pageIndex])) return objects[pageIndex];
	return pageIndex === Math.max(0, Number(currentPage || 1) - 1) ? objects : [];
}

export async function save(pdfFile, objects, name, options = {}) {
	let pdfDoc;
	const embeddedFonts = new Map();

	async function getEmbeddedFont(fontFamily = DEFAULT_FONT_FAMILY) {
		const normalizedFontFamily = Fonts[fontFamily] ? fontFamily : DEFAULT_FONT_FAMILY;
		if (embeddedFonts.has(normalizedFontFamily)) {
			return embeddedFonts.get(normalizedFontFamily);
		}

		const fontResponse = await fetchFontbyName(normalizedFontFamily);
		const fontBytes = await fontResponse.arrayBuffer();
		pdfDoc.registerFontkit(fontkit);
		const customFont = await pdfDoc.embedFont(fontBytes, {
			subset: Fonts[normalizedFontFamily].subset
		});
		embeddedFonts.set(normalizedFontFamily, customFont);
		return customFont;
	}

	try {
		pdfDoc = await PDFDocument.load(await readAsArrayBuffer(pdfFile));
	} catch (e) {
		toast.push('Failed to load PDF.', { theme: TOAST_ERROR });
		throw e;
	}
	const pagesProcesses = pdfDoc.getPages().map(async (page, pageIndex) => {
		const pageObjects = getPageObjects(objects, pageIndex, options.currentPage);
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
							height,
							opacity: normalizeOpacity(object.opacity, 1)
						});
				} catch (e) {
					toast.push(`Failed to embed image: ${e instanceof Error ? e.message : String(e)}`, {
						theme: TOAST_ERROR
					});
					return;
				}
			} else if (object.type === 'text') {
				const { x, y, lines, lineHeight = 1, size = 16, fontFamily } = object;
				const customFont = await getEmbeddedFont(fontFamily);
				const height = size * lineHeight;
				const textContent = lines?.join('\n') || '';
				const textColor = colorFromHex(object.fontColor || object.textColor || DEFAULT_TEXT_COLOR);

				return () => {
					page.drawText(textContent, {
						x,
						y: pageHeight - y - height,
						size,
						font: customFont,
						lineHeight: lineHeight * size,
						color: textColor,
						opacity: normalizeOpacity(object.opacity, 1)
					});
				};
			} else if (object.type === 'drawing' || object.type === 'highlight') {
				let { x, y, path, scale = 1, rotation = 0, brushColor, brushSize } = object;
				const strokeColor = colorFromHex(brushColor || DEFAULT_TEXT_COLOR);
				const opacity = normalizeOpacity(object.opacity, object.type === 'highlight' ? 0.5 : 1);
				const pathBBox = computeSvgPathBBox(path);
				const anchorX = pathBBox ? pathBBox.x + pathBBox.width / 2 : 0;
				const anchorY = pathBBox ? pathBBox.y + pathBBox.height / 2 : 0;
				const rotationRadians = (rotation * Math.PI) / 180;
				const cos = Math.cos(rotationRadians);
				const sin = Math.sin(rotationRadians);
				const drawX = x + anchorX - scale * (cos * anchorX - sin * anchorY);
				const drawY = y + anchorY - scale * (sin * anchorX + cos * anchorY);
				return () => {
					page.pushOperators(
						pushGraphicsState(),
						setLineCap(LineCapStyle.Round),
						setLineJoin(LineJoinStyle.Round)
					);
					page.drawSvgPath(path, {
						borderWidth: brushSize,
						scale,
						rotate: degrees(-rotation),
						x: drawX,
						y: pageHeight - drawY,
						borderColor: strokeColor,
						borderOpacity: opacity
					});
					page.pushOperators(popGraphicsState());
				};
			} else if (object.type === 'line') {
				const {
					x = 0,
					y = 0,
					width = 0,
					height = 0,
					strokeColor = DEFAULT_TEXT_COLOR,
					strokeWidth = 2,
					lineType = 'solid'
				} = object;
				const dashArray = getLineDashArray(lineType, strokeWidth);

				return () => {
					page.drawLine({
						start: { x, y: pageHeight - y },
						end: { x: x + width, y: pageHeight - y - height },
						thickness: strokeWidth,
						color: colorFromHex(strokeColor),
						opacity: normalizeOpacity(object.opacity, 1),
						lineCap: LineCapStyle.Round,
						...(dashArray ? { dashArray } : {})
					});
				};
			} else if (object.type === 'teacher-mark') {
				const stampFont = await getEmbeddedFont(DEFAULT_FONT_FAMILY);
				return () => drawTeacherMark(page, pageHeight, object, stampFont);
			}
		});
		// embed objects in order
		const drawProcesses = await Promise.all(embedProcesses);
		drawProcesses.forEach((p) => p?.());
	});
	await Promise.all(pagesProcesses);
	try {
		const pdfBytes = await pdfDoc.save();
		download(pdfBytes, name, 'application/pdf');
		return pdfBytes;
	} catch (e) {
		toast.push('Failed to save PDF.', { theme: TOAST_ERROR });
		throw e;
	}
}

function colorFromHex(hex, fallback = DEFAULT_TEXT_COLOR) {
	const parsed = hexToRgb(hex || fallback);
	return rgb(parsed.r, parsed.g, parsed.b);
}

function hexToRgb(hex) {
	const normalized = String(hex || DEFAULT_TEXT_COLOR)
		.trim()
		.replace(/^#/, '');
	const safeHex = /^[0-9a-f]{3}$/i.test(normalized)
		? normalized
				.split('')
				.map((value) => value + value)
				.join('')
		: normalized;

	if (!/^[0-9a-f]{6}$/i.test(safeHex)) {
		return hexToRgb(DEFAULT_TEXT_COLOR);
	}

	const bigint = parseInt(safeHex, 16);
	const r = ((bigint >> 16) & 255) / 255;
	const g = ((bigint >> 8) & 255) / 255;
	const b = (bigint & 255) / 255;
	return { r, g, b };
}

function normalizeOpacity(value, fallback = 1) {
	const opacity = Number(value);
	return Number.isFinite(opacity) ? Math.max(0, Math.min(opacity, 1)) : fallback;
}

function getLineDashArray(lineType, strokeWidth) {
	if (lineType === 'dotted') return [strokeWidth * 2, strokeWidth * 2];
	if (lineType === 'dashed') return [strokeWidth * 4, strokeWidth * 2];
	return null;
}

function capitalizeFirstLetter(value) {
	const trimmed = String(value || '').trim();
	if (!trimmed) return 'Teacher';
	return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function formatMarkedAt(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value || '';

	return date.toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

function fitTextToWidth(text, font, fontSize, maxWidth) {
	const value = String(text || '');
	if (font.widthOfTextAtSize(value, fontSize) <= maxWidth) return value;

	let output = value;
	while (output.length > 1 && font.widthOfTextAtSize(`${output}...`, fontSize) > maxWidth) {
		output = output.slice(0, -1);
	}
	return output.length > 1 ? `${output}...` : output;
}

function drawTeacherMark(page, pageHeight, object, font) {
	const x = Number(object.x || 0);
	const y = Number(object.y || 0);
	const width = Math.max(20, Number(object.width || 60));
	const height = Math.max(14, Number(object.height || 40));
	const pdfY = pageHeight - y - height;
	const colors = getTeacherMarkColorPreset(object.stampColor);
	const baseFontSize = Math.max(4, Math.min(Number(object.fontSize || 8), 24));
	const metaFontSize = Math.max(3, baseFontSize * 0.68);
	const padding = Math.max(2, Math.min(width, height) * 0.06);
	const iconName = getTeacherMarkIcon(object.stampIcon);
	const iconFontSize = Math.max(8, baseFontSize * 1.8);
	const hasIcon = iconName !== 'none';
	const iconWidth = hasIcon ? iconFontSize + padding : 0;
	const contentX = x + padding + iconWidth;
	const maxTextWidth = Math.max(4, width - padding * 2 - iconWidth);
	const label = fitTextToWidth(object.label || 'Marked correct', font, baseFontSize, maxTextWidth);
	const markedBy = capitalizeFirstLetter(object.markedBy || 'Teacher');
	const meta = fitTextToWidth(`Stamped by ${markedBy}`, font, metaFontSize, maxTextWidth);
	const time = fitTextToWidth(
		formatMarkedAt(object.markedAt || object.updatedAt || new Date().toISOString()),
		font,
		metaFontSize,
		maxTextWidth
	);

	page.drawRectangle({
		x,
		y: pdfY,
		width,
		height,
		color: colorFromHex(colors.background),
		opacity: normalizeOpacity(object.opacity, 1),
		borderColor: colorFromHex(colors.border),
		borderOpacity: normalizeOpacity(object.opacity, 1),
		borderWidth: 1
	});

	if (hasIcon) {
		drawTeacherMarkIcon(page, iconName, {
			x: x + padding + iconFontSize / 2,
			y: pdfY + height / 2,
			size: iconFontSize,
			color: colorFromHex(colors.text),
			opacity: normalizeOpacity(object.opacity, 1)
		});
	}

	const contentHeight = baseFontSize + metaFontSize * 2.1;
	const firstLineY = pdfY + Math.max(1, (height + contentHeight) / 2 - baseFontSize);
	page.drawText(label.toUpperCase(), {
		x: contentX,
		y: firstLineY,
		size: baseFontSize,
		font,
		color: colorFromHex(colors.text),
		opacity: normalizeOpacity(object.opacity, 1)
	});
	page.drawText(meta, {
		x: contentX,
		y: firstLineY - metaFontSize * 1.15,
		size: metaFontSize,
		font,
		color: colorFromHex(colors.meta),
		opacity: normalizeOpacity(object.opacity, 1)
	});
	page.drawText(time, {
		x: contentX,
		y: firstLineY - metaFontSize * 2.3,
		size: metaFontSize,
		font,
		color: colorFromHex(colors.time),
		opacity: normalizeOpacity(object.opacity, 1)
	});
}

function drawTeacherMarkIcon(page, iconName, options) {
	const { x, y, size, color, opacity } = options;
	const strokeWidth = Math.max(1, size * 0.12);
	const half = size / 2;

	if (iconName === 'check-circle') {
		page.drawCircle({
			x,
			y,
			size: half,
			borderColor: color,
			borderOpacity: opacity,
			borderWidth: strokeWidth
		});
		page.drawLine({
			start: { x: x - size * 0.22, y: y - size * 0.02 },
			end: { x: x - size * 0.06, y: y - size * 0.18 },
			thickness: strokeWidth,
			color,
			opacity,
			lineCap: LineCapStyle.Round
		});
		page.drawLine({
			start: { x: x - size * 0.06, y: y - size * 0.18 },
			end: { x: x + size * 0.24, y: y + size * 0.2 },
			thickness: strokeWidth,
			color,
			opacity,
			lineCap: LineCapStyle.Round
		});
		return;
	}

	if (iconName === 'star') {
		page.drawSvgPath(createStarPath(x, y, half, half * 0.45), {
			borderColor: color,
			borderOpacity: opacity,
			borderWidth: strokeWidth,
			color,
			opacity
		});
		return;
	}

	if (iconName === 'award') {
		page.drawCircle({
			x,
			y: y + size * 0.08,
			size: size * 0.28,
			borderColor: color,
			borderOpacity: opacity,
			borderWidth: strokeWidth
		});
		page.drawLine({
			start: { x: x - size * 0.12, y: y - size * 0.18 },
			end: { x: x - size * 0.22, y: y - size * 0.42 },
			thickness: strokeWidth,
			color,
			opacity,
			lineCap: LineCapStyle.Round
		});
		page.drawLine({
			start: { x: x + size * 0.12, y: y - size * 0.18 },
			end: { x: x + size * 0.22, y: y - size * 0.42 },
			thickness: strokeWidth,
			color,
			opacity,
			lineCap: LineCapStyle.Round
		});
		return;
	}

	if (iconName === 'thumbs-up') {
		page.drawSvgPath(
			[
				`M ${x - size * 0.33} ${y - size * 0.22}`,
				`L ${x - size * 0.12} ${y - size * 0.22}`,
				`L ${x - size * 0.02} ${y + size * 0.28}`,
				`L ${x + size * 0.14} ${y + size * 0.28}`,
				`L ${x + size * 0.1} ${y + size * 0.04}`,
				`L ${x + size * 0.34} ${y + size * 0.04}`,
				`L ${x + size * 0.28} ${y - size * 0.22}`,
				`L ${x - size * 0.33} ${y - size * 0.22}`,
				'Z'
			].join(' '),
			{
				borderColor: color,
				borderOpacity: opacity,
				borderWidth: strokeWidth,
				color,
				opacity
			}
		);
	}
}

function createStarPath(centerX, centerY, outerRadius, innerRadius) {
	const points = [];
	for (let index = 0; index < 10; index += 1) {
		const radius = index % 2 === 0 ? outerRadius : innerRadius;
		const angle = -Math.PI / 2 + (index * Math.PI) / 5;
		points.push({
			x: centerX + Math.cos(angle) * radius,
			y: centerY + Math.sin(angle) * radius
		});
	}

	return points
		.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
		.concat('Z')
		.join(' ');
}

function computeSvgPathBBox(path) {
	const values = path
		.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)
		?.map((value) => Number(value))
		.filter((value) => Number.isFinite(value));

	if (!values || values.length < 2) return null;

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (let i = 0; i < values.length - 1; i += 2) {
		const x = values[i];
		const y = values[i + 1];
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x);
		maxY = Math.max(maxY, y);
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY
	};
}



