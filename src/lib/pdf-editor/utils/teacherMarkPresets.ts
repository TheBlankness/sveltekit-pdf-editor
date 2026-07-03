export type TeacherMarkColor = 'green' | 'red' | 'blue';
export type TeacherMarkIcon = 'none' | 'check-circle' | 'thumbs-up' | 'star' | 'award';

export type TeacherMarkColorPreset = {
	value: TeacherMarkColor;
	label: string;
	border: string;
	background: string;
	text: string;
	meta: string;
	time: string;
};

export const teacherMarkLabelPresets = ['Marked correct', 'Checked by', 'Good job'] as const;
export const teacherMarkIconPresets: Array<{ value: TeacherMarkIcon; label: string }> = [
	{ value: 'none', label: 'No icon' },
	{ value: 'check-circle', label: 'Check' },
	{ value: 'thumbs-up', label: 'Thumbs up' },
	{ value: 'star', label: 'Star' },
	{ value: 'award', label: 'Award' }
];

export const teacherMarkColorPresets: TeacherMarkColorPreset[] = [
	{
		value: 'green',
		label: 'Green',
		border: '#15803d',
		background: '#f0fdf4',
		text: '#14532d',
		meta: '#166534',
		time: '#3f6212'
	},
	{
		value: 'red',
		label: 'Red',
		border: '#b91c1c',
		background: '#fef2f2',
		text: '#7f1d1d',
		meta: '#991b1b',
		time: '#b91c1c'
	},
	{
		value: 'blue',
		label: 'Blue',
		border: '#1d4ed8',
		background: '#eff6ff',
		text: '#1e3a8a',
		meta: '#1e40af',
		time: '#1d4ed8'
	}
];

export function getTeacherMarkColorPreset(value: unknown): TeacherMarkColorPreset {
	return (
		teacherMarkColorPresets.find((preset) => preset.value === value) ?? teacherMarkColorPresets[0]
	);
}

export function getTeacherMarkIcon(value: unknown): TeacherMarkIcon {
	return teacherMarkIconPresets.some((preset) => preset.value === value)
		? (value as TeacherMarkIcon)
		: 'none';
}
