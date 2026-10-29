import { extensionOf } from '@/uploads/content-types';

export type AttachmentKind = 'image' | 'pdf' | 'audio' | 'video' | 'other';

const KIND_BY_EXTENSION = new Map<string, AttachmentKind>([
	['png', 'image'],
	['jpg', 'image'],
	['jpeg', 'image'],
	['gif', 'image'],
	['webp', 'image'],
	['svg', 'image'],
	['avif', 'image'],
	['bmp', 'image'],
	['ico', 'image'],
	['heic', 'image'],
	['pdf', 'pdf'],
	['mp3', 'audio'],
	['m4a', 'audio'],
	['wav', 'audio'],
	['ogg', 'audio'],
	['flac', 'audio'],
	['mp4', 'video'],
	['mov', 'video'],
	['webm', 'video'],
	['mkv', 'video'],
]);

export function attachmentKindOf(key: string): AttachmentKind {
	const extension = extensionOf(key);

	return (extension !== undefined && KIND_BY_EXTENSION.get(extension)) || 'other';
}
