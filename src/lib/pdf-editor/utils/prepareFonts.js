// Available fonts
export const Fonts = {
	Roboto: {
		src: '/fonts/Roboto-Regular.ttf',
		correction(size, lineHeight) {
			return (size * lineHeight - size) / 2 + size / 7;
		},
		subset: true
	},
	'Noto Sans CJK': {
		src: '/fonts/NotoSansSC-Regular.ttf',
		correction(size, lineHeight) {
			return (size * lineHeight - size) / 2 + size / 7;
		},
		subset: false
	},
	'KaiTi Regular': {
		src: '/fonts/KaiTi-Regular.ttf',
		correction(size, lineHeight) {
			return (size * lineHeight - size) / 2 + size / 7;
		},
		subset: false
	}
};

export async function fetchFont(name) {
	if (!Fonts || !Fonts[name]) {
		throw new Error(`Font '${name}' does not exist.`);
	}

	const font = Fonts[name];
	try {
		const response = await fetch(font.src);
		const fontBuffer = await response.arrayBuffer();
		const fontFace = new FontFace(name, fontBuffer);
		fontFace.display = 'swap';
		await fontFace.load();
		document.fonts.add(fontFace);
		return {
			...font,
			buffer: fontBuffer
		};
	} catch (error) {
		throw new Error(`Failed to fetch font '${name}': ${error.message}`);
	}
}

export const fetchFontbyName = async (fontFamily) => {
	const font = await Fonts[fontFamily];
	if (font) {
		return fetch(font.src);
	} else {
		throw new Error(`Font '${fontFamily}' not found.`);
	}
};
