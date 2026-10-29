export interface ObjectUrls {
	create(bytes: ArrayBuffer, contentType: string): string;
	revoke(url: string): void;
}

export const browserObjectUrls: ObjectUrls = {
	create: (bytes, contentType) => URL.createObjectURL(new Blob([bytes], { type: contentType })),
	revoke: (url) => URL.revokeObjectURL(url),
};
