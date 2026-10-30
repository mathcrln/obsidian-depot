import { AttachmentReference } from '@/references/attachment-reference';
import type { ProfileId } from '@/references/profile-id';
import { contentTypeOf } from '@/uploads/content-types';
import { PathPattern } from '@/uploads/path-pattern';
import type { ObjectStore } from '@/storages/object-store';
import { HashMarkers, looksMissing } from '@/uploads/hash-markers';
import { ObjectId } from '@/uploads/object-ids';
import type { IdStyle } from '@/uploads/object-ids';
import type { UploadRegistry } from '@/uploads/upload-registry';

export interface UploadableFile {
	name: string;
	type?: string;
	arrayBuffer(): Promise<ArrayBuffer>;
}

export interface UploadSettings {
	pathPattern: string;
	lowercaseNames: boolean;
	idStyle: IdStyle;
	detectDuplicates: boolean;
}

export interface UploadContext {
	note?: string;
}

export interface UploadResult<A> {
	attachment: A;
	reused: boolean;
}

export interface ProfileOptions<A> {
	id: ProfileId;
	settings: UploadSettings;
	store: ObjectStore;
	registry: UploadRegistry;
	attach: (reference: AttachmentReference, name: string) => A;
}

export class Profile<A> {
	readonly id: ProfileId;
	private readonly pattern: PathPattern;
	private readonly settings: UploadSettings;
	private readonly store: ObjectStore;
	private readonly markers: HashMarkers;
	private readonly registry: UploadRegistry;
	private readonly attach: (reference: AttachmentReference, name: string) => A;

	constructor({ id, settings, store, registry, attach }: ProfileOptions<A>) {
		this.id = id;
		this.settings = settings;
		this.pattern = PathPattern.isValid(settings.pathPattern) ? PathPattern.parse(settings.pathPattern) : PathPattern.DEFAULT;
		this.store = store;
		this.markers = new HashMarkers(store);
		this.registry = registry;
		this.attach = attach;
	}

	async upload(file: UploadableFile, context: UploadContext = {}): Promise<UploadResult<A>> {
		const bytes = await file.arrayBuffer();
		const hash = await ObjectId.hashOf(bytes);
		const existing = this.settings.detectDuplicates ? await this.existingUpload(hash) : undefined;

		if (existing !== undefined) {
			return { attachment: this.attach(AttachmentReference.to(this.id, existing), file.name), reused: true };
		}

		const key = this.pattern.keyFor(
			{
				fileName: file.name,
				id: ObjectId.generate(this.settings.idStyle, { hash }),
				...(context.note === undefined ? {} : { note: context.note }),
			},
			this.settings
		);

		await this.store.put(key, bytes, contentTypeOf(file.name, file.type));

		if (this.settings.detectDuplicates) {
			await this.markers.record(hash, key);
			await this.registry.remember(this.id.value, hash, key);
		}

		return { attachment: this.attach(AttachmentReference.to(this.id, key), file.name), reused: false };
	}

	private async existingUpload(hash: string): Promise<string | undefined> {
		const local = await this.registry.find(this.id.value, hash);

		if (local !== undefined && (await this.stillExists(local))) return local;

		const shared = await this.markers.find(hash);

		if (shared === undefined || !(await this.stillExists(shared))) return undefined;

		await this.registry.remember(this.id.value, hash, shared);

		return shared;
	}

	private async stillExists(key: string): Promise<boolean> {
		try {
			await this.store.head(key);

			return true;
		} catch (error) {
			if (looksMissing(error)) return false;

			throw error;
		}
	}
}
