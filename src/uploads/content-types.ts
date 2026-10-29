const FALLBACK_CONTENT_TYPE = 'application/octet-stream';

const CONTENT_TYPES = new Map<string, string>([
	['png', 'image/png'],
	['jpg', 'image/jpeg'],
	['jpeg', 'image/jpeg'],
	['gif', 'image/gif'],
	['webp', 'image/webp'],
	['svg', 'image/svg+xml'],
	['avif', 'image/avif'],
	['heic', 'image/heic'],
	['bmp', 'image/bmp'],
	['ico', 'image/x-icon'],
	['pdf', 'application/pdf'],
	['mp3', 'audio/mpeg'],
	['m4a', 'audio/mp4'],
	['wav', 'audio/wav'],
	['ogg', 'audio/ogg'],
	['flac', 'audio/flac'],
	['mp4', 'video/mp4'],
	['mov', 'video/quicktime'],
	['webm', 'video/webm'],
	['mkv', 'video/x-matroska'],
	['txt', 'text/plain'],
	['md', 'text/markdown'],
	['json', 'application/json'],
	['csv', 'text/csv'],
	['zip', 'application/zip'],
]);

export function contentTypeOf(fileName: string, reported?: string): string {
	if (reported !== undefined && reported !== '') {
		return reported;
	}

	const extension = extensionOf(fileName);

	return (extension !== undefined && CONTENT_TYPES.get(extension)) || FALLBACK_CONTENT_TYPE;
}

export function extensionOf(fileName: string): string | undefined {
	const dot = fileName.lastIndexOf('.');

	if (dot <= 0 || dot === fileName.length - 1) {
		return undefined;
	}

	return fileName.slice(dot + 1).toLowerCase();
}
