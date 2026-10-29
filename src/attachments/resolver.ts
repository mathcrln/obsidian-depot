import type { ObjectCache } from '@/cache/object-cache';
import type { ObjectUrls } from '@/attachments/object-urls';
import type { AttachmentReference } from '@/references/attachment-reference';
import type { ProfileId } from '@/references/profile-id';
import type { ObjectStore } from '@/storages/object-store';

export interface ResolvedAttachment {
	url: string;
	contentType: string;
}

export interface ResolverDependencies {
	storeFor: (profile: ProfileId) => ObjectStore;
	cache: ObjectCache;
	objectUrls: ObjectUrls;
}

export class Resolver {
	private readonly resolved = new Map<string, Promise<ResolvedAttachment>>();
	private readonly urls = new Set<string>();

	constructor(private readonly dependencies: ResolverDependencies) {}

	resolve(reference: AttachmentReference): Promise<ResolvedAttachment> {
		const id = reference.toString();
		const existing = this.resolved.get(id);

		if (existing) return existing;

		const pending = this.load(reference);
		this.resolved.set(id, pending);

		pending.catch(() => {
			if (this.resolved.get(id) === pending) this.resolved.delete(id);
		});

		return pending;
	}

	release(): void {
		for (const url of this.urls) {
			this.dependencies.objectUrls.revoke(url);
		}

		this.urls.clear();
		this.resolved.clear();
	}

	private async load(reference: AttachmentReference): Promise<ResolvedAttachment> {
		const { cache, objectUrls } = this.dependencies;
		const profile = reference.profile.value;

		const cached = await cache.read(profile, reference.key);
		let object: { bytes: ArrayBuffer; contentType: string };

		if (cached) {
			object = cached;
		} else {
			const fetched = await this.dependencies.storeFor(reference.profile).get(reference.key);
			object = fetched;

			try {
				await cache.write(profile, reference.key, {
					bytes: fetched.bytes,
					contentType: fetched.contentType,
					...(fetched.etag !== undefined && { etag: fetched.etag }),
				});
			} catch {
				// the cache is an optimisation; serving the object matters more
			}
		}

		const url = objectUrls.create(object.bytes, object.contentType);
		if (this.resolved.has(reference.toString())) this.urls.add(url);
		else objectUrls.revoke(url);

		return { url, contentType: object.contentType };
	}
}
