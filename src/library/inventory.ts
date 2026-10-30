import { Str } from '@/utils/str';
import { attachmentKindOf } from '@/attachments/attachment-kind';
import type { ObjectSummary } from '@/storages/object-store';
import type { LibraryItem, ReferenceUse } from './library-item';

const DEPOT_PREFIX = '.depot/';

export function inventoryOf({
	profile,
	objects,
	uses,
}: {
	profile: string;
	objects: ObjectSummary[];
	uses: ReferenceUse[];
}): LibraryItem[] {
	const notesByKey = notesOf(profile, uses);
	const stored = objects.filter((object) => !object.key.startsWith(DEPOT_PREFIX));
	const storedKeys = new Set(stored.map((object) => object.key));

	const present: LibraryItem[] = stored.map((object) => {
		const notes = notesByKey.get(object.key) ?? [];

		return {
			profile,
			key: object.key,
			kind: attachmentKindOf(object.key),
			status: notes.length > 0 ? 'used' : 'unused',
			notes,
			size: object.size,
			lastModified: object.lastModified,
		};
	});

	const broken: LibraryItem[] = [...notesByKey]
		.filter(([key]) => !storedKeys.has(key))
		.map(([key, notes]) => ({ profile, key, kind: attachmentKindOf(key), status: 'broken', notes }));

	return [...broken.sort(byKey), ...present.sort(newestFirst)];
}

function notesOf(profile: string, uses: ReferenceUse[]): Map<string, string[]> {
	const notes = new Map<string, Set<string>>();

	for (const use of uses) {
		if (use.profile !== profile) continue;
		notes.set(use.key, (notes.get(use.key) ?? new Set()).add(use.note));
	}

	return new Map([...notes].map(([key, set]) => [key, [...set].sort(Str.compare)]));
}

function byKey(a: LibraryItem, b: LibraryItem): number {
	return Str.compare(a.key, b.key);
}

function newestFirst(a: LibraryItem, b: LibraryItem): number {
	return (b.lastModified ?? 0) - (a.lastModified ?? 0) || byKey(a, b);
}
