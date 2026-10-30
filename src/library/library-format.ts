import type { LibraryItem } from '@/library/library-item';

export function humanSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes / 1024;
	let unit = 0;

	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}

	return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export function fileName(key: string): string {
	return key.split('/').pop() ?? key;
}

export function extensionLabel(key: string): string {
	const name = fileName(key);
	const dot = name.lastIndexOf('.');

	return dot > 0 ? name.slice(dot + 1).toUpperCase() : '';
}

export function formatDate(timestamp: number, locale?: string): string {
	return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(timestamp);
}

export function tileTitle(item: Pick<LibraryItem, 'key' | 'size' | 'lastModified'>, locale?: string): string {
	const parts = [fileName(item.key)];
	if (item.size !== undefined) parts.push(humanSize(item.size));
	if (item.lastModified !== undefined) parts.push(formatDate(item.lastModified, locale));

	return parts.join(' · ');
}
