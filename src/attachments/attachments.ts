import { Attachment } from '@/attachments/attachment';
import type { Resolver } from '@/attachments/resolver';
import { AttachmentReference } from '@/references/attachment-reference';

export interface AttachmentsDependencies {
	resolver: Resolver;
	recognizes: (profileId: string) => boolean;
}

export class Attachments {
	constructor(private readonly dependencies: AttachmentsDependencies) {}

	from(src: string): Attachment | undefined {
		const reference = AttachmentReference.tryParse(src);

		if (!reference || !this.dependencies.recognizes(reference.profile.value)) return undefined;

		return this.of(reference);
	}

	within(value: unknown): Attachment[] {
		const values = Array.isArray(value) ? value : [value];

		return values.flatMap((candidate) => {
			if (typeof candidate !== 'string') return [];

			const source = candidate.trim().match(/^!?\[[^\]]*\]\(<?([^)>]+)>?\)$/)?.[1] ?? candidate.trim();
			const attachment = this.from(source);

			return attachment ? [attachment] : [];
		});
	}

	of(reference: AttachmentReference, name?: string): Attachment {
		return new Attachment(reference, this.dependencies.resolver, name);
	}
}
