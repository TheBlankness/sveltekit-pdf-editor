// Define a strongly typed color entry
export type PresetColor = {
	label: string;
	hex: string;
	outline: string;
};

// A list of colors with readable names and outline mappings
export const presetColors: PresetColor[] = [
	{
		label: 'Black',
		hex: '#232529',
		outline: 'rgba(92, 94, 99, 0.6)'
	},
	{
		label: 'Gray',
		hex: '#5C5E63',
		outline: 'rgba(35, 37, 41, 0.6)'
	},
	{
		label: 'Red',
		hex: '#FF5B59',
		outline: 'rgba(255, 91, 89, 0.3)'
	},
	{
		label: 'Pink',
		hex: '#F65385',
		outline: 'rgba(246, 83, 133, 0.3)'
	},
	{
		label: 'Orange',
		hex: '#FD9038',
		outline: 'rgba(253, 144, 56, 0.4)'
	},
	{
		label: 'Yellow',
		hex: '#F5B900',
		outline: 'rgba(245, 185, 0, 0.4)'
	},
	{
		label: 'Green',
		hex: '#0FC27B',
		outline: 'rgba(15, 194, 123, 0.4)'
	},
	{
		label: 'Cyan',
		hex: '#17BDE9',
		outline: 'rgba(23, 189, 233, 0.4)'
	},
	{
		label: 'Blue',
		hex: '#266DF0',
		outline: 'rgba(38, 109, 240, 0.4)'
	},
	// {
	// 	label: 'Purple',
	// 	hex: '#9162F9',
	// 	outline: 'rgba(145, 98, 249, 0.4)'
	// }
];

// Build a map from hex -> outline for fast lookup
const outlineColorMap: Record<string, string> = presetColors.reduce(
	(map, color) => {
		map[color.hex] = color.outline;
		return map;
	},
	{} as Record<string, string>
);

// Outline color resolver
export function getOutlineColor(brushHex: string): string {
	return outlineColorMap[brushHex] || 'rgba(251, 146, 60, 0.4)'; // Fallback: soft orange
}
