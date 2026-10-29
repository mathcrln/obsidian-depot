import { extensionOf } from '@/uploads/content-types';
import { ulid } from '@/uploads/ulid';

const PREFIX = 'attachments';

export function objectKeyFor(fileName: string, time?: number): string {
	const id = ulid(time);
	const extension = extensionOf(fileName);

	return extension === undefined ? `${PREFIX}/${id}` : `${PREFIX}/${id}.${extension}`;
}
