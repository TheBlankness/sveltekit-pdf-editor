type SortableAnnotation = {
	type?: string;
};

export function customSort(a: SortableAnnotation, b: SortableAnnotation) {
		// Define rendering order: drawing/highlight -> line -> text
		// Higher numbers render on top (later in the array)
		const typeOrder: Record<string, number> = {
			drawing: 1,
			highlight: 1,
			line: 2,
			text: 3,
			'teacher-mark': 4
		};

		const orderA = a.type ? typeOrder[a.type] || 0 : 0;
		const orderB = b.type ? typeOrder[b.type] || 0 : 0;

		if (orderA !== orderB) {
			return orderA - orderB; // Sort by type order
		}

		return 0; // Same type, maintain relative positions
	}

export default customSort;
