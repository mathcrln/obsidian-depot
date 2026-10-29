import { ProfileId } from './profile-id';

const SEPARATOR = '://';

export class InvalidAttachmentReference extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidAttachmentReference';
	}
}

export class AttachmentReference {
	private constructor(
		readonly profile: ProfileId,
		readonly key: string
	) {}

	static parse(value: string): AttachmentReference {
		const index = value.indexOf(SEPARATOR);

		if (index === -1) {
			throw new InvalidAttachmentReference(`"${value}" is not an attachment reference: expected <profile>://<object-key>.`);
		}

		const scheme = value.slice(0, index);

		if (!ProfileId.isValid(scheme)) {
			throw new InvalidAttachmentReference(`"${scheme}" is not a valid storage profile identifier.`);
		}

		return new AttachmentReference(
			ProfileId.parse(scheme),
			AttachmentReference.decode(value.slice(index + SEPARATOR.length))
		);
	}

	static tryParse(value: string): AttachmentReference | undefined {
		try {
			return AttachmentReference.parse(value);
		} catch (error) {
			if (error instanceof InvalidAttachmentReference) {
				return undefined;
			}

			throw error;
		}
	}

	static to(profile: ProfileId | string, key: string): AttachmentReference {
		const id = typeof profile === 'string' ? ProfileId.parse(profile) : profile;

		AttachmentReference.assertKey(key);

		return new AttachmentReference(id, key);
	}

	equals(other: AttachmentReference): boolean {
		return this.profile.equals(other.profile) && this.key === other.key;
	}

	toString(): string {
		const encoded = this.key
			.split('/')
			.map((segment) =>
				encodeURIComponent(segment).replace(/[()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
			)
			.join('/');

		return `${this.profile.value}${SEPARATOR}${encoded}`;
	}

	private static decode(encoded: string): string {
		let key: string;

		try {
			key = decodeURIComponent(encoded);
		} catch {
			throw new InvalidAttachmentReference(`"${encoded}" contains malformed percent-encoding.`);
		}

		AttachmentReference.assertKey(key);

		return key;
	}

	private static assertKey(key: string): void {
		if (key === '') {
			throw new InvalidAttachmentReference('An attachment reference needs an object key.');
		}

		if (key.startsWith('/')) {
			throw new InvalidAttachmentReference('An object key cannot start with a slash.');
		}
	}
}
