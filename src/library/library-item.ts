import type { AttachmentKind } from '@/attachments/attachment-kind';

export type LibraryStatus = 'used' | 'unused' | 'broken';

export interface LibraryItem {
	profile: string;
	key: string;
	kind: AttachmentKind;
	status: LibraryStatus;
	notes: string[];
	size?: number;
	lastModified?: number;
}

export interface ReferenceUse {
	profile: string;
	key: string;
	note: string;
}
