import { AttachmentReference } from '@/references/attachment-reference';
import type { ProfileId } from '@/references/profile-id';
import { contentTypeOf } from '@/uploads/content-types';
import { objectKeyFor } from '@/uploads/object-keys';
import type { ObjectStore } from '@/storages/object-store';

export interface UploadableFile {
	name: string;
	type?: string;
	arrayBuffer(): Promise<ArrayBuffer>;
}

export interface ProfileOptions<A> {
	id: ProfileId;
	store: ObjectStore;
	attach: (reference: AttachmentReference, name: string) => A;
}

export class Profile<A> {
	readonly id: ProfileId;
	private readonly store: ObjectStore;
	private readonly attach: (reference: AttachmentReference, name: string) => A;

	constructor({ id, store, attach }: ProfileOptions<A>) {
		this.id = id;
		this.store = store;
		this.attach = attach;
	}

	async upload(file: UploadableFile): Promise<A> {
		const key = objectKeyFor(file.name);

		await this.store.put(key, await file.arrayBuffer(), contentTypeOf(file.name, file.type));

		return this.attach(AttachmentReference.to(this.id, key), file.name);
	}
}
