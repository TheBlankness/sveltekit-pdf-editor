<script lang="ts">
	interface Props {
		stroke_visibility: 'all' | 'self' | 'others';
		onChange: (value: 'all' | 'self' | 'others') => void;
	}

	let { stroke_visibility, onChange }: Props = $props();
</script>

<select
	value={stroke_visibility}
	onchange={(e) => onChange(e.currentTarget.value as 'all' | 'self' | 'others')}
	class="select select-bordered h-10 w-32 shrink-0 text-sm shadow-sm transition-colors duration-200 hover:bg-gray-50"
	class:select-warning={stroke_visibility === 'self'}
	class:select-info={stroke_visibility === 'others'}
>
	<option value="all">👁️ All Notes</option>
	<option value="self">📝 My Notes</option>
	<option value="others">👥 Others</option>
</select>
