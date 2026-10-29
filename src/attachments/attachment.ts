import { attachmentKindOf, type AttachmentKind } from '@/attachments/attachment-kind';
import type { Resolver, ResolvedAttachment } from '@/attachments/resolver';
import type { AttachmentReference } from '@/references/attachment-reference';

const EMBEDDED: ReadonlySet<AttachmentKind> = new Set(['image', 'pdf', 'audio', 'video']);

export class Attachment {
	readonly name: string;

	constructor(
		readonly reference: AttachmentReference,
		private readonly resolver: Resolver,
		name?: string
	) {
		this.name = name ?? reference.key.split('/').pop() ?? reference.key;
	}

	get kind(): AttachmentKind {
		return attachmentKindOf(this.reference.key);
	}

	markdown(): string {
		if (EMBEDDED.has(this.kind)) {
			return `![](${this.reference.toString()})`;
		}

		return `[${this.name.replace(/[[\]]/g, '\\$&')}](${this.reference.toString()})`;
	}

	resolve(): Promise<ResolvedAttachment> {
		return this.resolver.resolve(this.reference);
	}
}
