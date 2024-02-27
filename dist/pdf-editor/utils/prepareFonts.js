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
	}
};

export function fetchFont(name) {
	const font = Fonts[name];
	if (!font) throw new Error(`Font '${name}' not exists.`);
	Fonts[name] = fetch(font.src)
		.then((r) => r.arrayBuffer())
		.then((fontBuffer) => {
			const fontFace = new FontFace(name, fontBuffer);
			fontFace.display = 'swap';
			fontFace.load().then(() => document.fonts.add(fontFace));
			return {
				...font,
				buffer: fontBuffer
			};
		});
	return Fonts[name];
}

export const fetchFontbyName = async (fontFamily) => {
	const font = await Fonts[fontFamily];
	if (font) {
		return fetch(font.src);
	} else {
		throw new Error(`Font '${fontFamily}' not found.`);
	}
};
