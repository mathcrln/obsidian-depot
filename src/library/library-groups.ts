import { Carbon } from '@/utils/carbon';
import type { LibraryItem } from '@/library/library-item';

export interface LibraryGroup {
	id: string;
	label: string;
	items: LibraryItem[];
}

export function groupByMonth(items: LibraryItem[], locale?: string): LibraryGroup[] {
	const broken: LibraryItem[] = [];
	const undated: LibraryItem[] = [];
	const months = new Map<string, LibraryGroup>();

	for (const item of items) {
		if (item.status === 'broken') {
			broken.push(item);
		} else if (item.lastModified === undefined) {
			undated.push(item);
		} else {
			const id = Carbon.format(item.lastModified, 'YYYY-MM');
			const group = months.get(id) ?? { id, label: Carbon.formatMonth(item.lastModified, { locale }), items: [] };
			group.items.push(item);
			months.set(id, group);
		}
	}

	const dated = [...months.values()].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
	const groups: LibraryGroup[] = [];
	if (broken.length > 0) groups.push({ id: 'broken', label: 'Broken references', items: broken });
	groups.push(...dated);
	if (undated.length > 0) groups.push({ id: 'undated', label: 'Unknown date', items: undated });

	return groups;
}
