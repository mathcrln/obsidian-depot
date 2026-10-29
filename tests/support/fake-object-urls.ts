import type { ObjectUrls } from '@/attachments/object-urls';

export class FakeObjectUrls implements ObjectUrls {
	readonly created: Array<{ url: string; bytes: ArrayBuffer; contentType: string }> = [];
	readonly revoked: string[] = [];

	create(bytes: ArrayBuffer, contentType: string): string {
		const url = `blob:fake/${this.created.length + 1}`;
		this.created.push({ url, bytes, contentType });

		return url;
	}

	revoke(url: string): void {
		this.revoked.push(url);
	}
}
