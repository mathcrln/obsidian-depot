import { ulid } from '@/uploads/ulid';

export type IdStyle = 'content-hash' | 'uuid-v7' | 'uuid-v4' | 'short' | 'ulid';

export const ID_STYLES: readonly IdStyle[] = ['content-hash', 'uuid-v7', 'uuid-v4', 'short', 'ulid'];

export const DEFAULT_ID_STYLE: IdStyle = 'content-hash';

export interface IdInput {
	hash: string;
	time?: number;
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SHORT_LENGTH = 10;
const UNBIASED_LIMIT = 256 - (256 % BASE62.length);

export const ObjectId = {
	isStyle(value: unknown): value is IdStyle {
		return ID_STYLES.includes(value as IdStyle);
	},

	async hashOf(bytes: ArrayBuffer): Promise<string> {
		const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));

		return hex(digest);
	},

	generate(style: IdStyle, { hash, time = Date.now() }: IdInput): string {
		switch (style) {
			case 'content-hash':
				return hash.slice(0, 32);
			case 'uuid-v4':
				return crypto.randomUUID();
			case 'uuid-v7':
				return uuidV7(time);
			case 'short':
				return shortId();
			case 'ulid':
				return ulid(time);
		}
	},
};

function uuidV7(time: number): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	const timestamp = BigInt(time);

	for (let index = 0; index < 6; index++) {
		bytes[index] = Number((timestamp >> BigInt(8 * (5 - index))) & 0xffn);
	}

	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

	const text = hex(bytes);

	return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`;
}

function shortId(): string {
	let id = '';

	while (id.length < SHORT_LENGTH) {
		for (const byte of crypto.getRandomValues(new Uint8Array(SHORT_LENGTH))) {
			if (byte < UNBIASED_LIMIT && id.length < SHORT_LENGTH) {
				id += BASE62.charAt(byte % BASE62.length);
			}
		}
	}

	return id;
}

function hex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
