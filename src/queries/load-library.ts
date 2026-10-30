import type { App } from 'obsidian';
import type { Attachment } from '@/attachments/attachment';
import type { Attachments } from '@/attachments/attachments';
import { inventoryOf } from '@/library/inventory';
import type { LibraryItem } from '@/library/library-item';
import type { Settings } from '@/models/plugin-settings';
import { findReferenceUses } from '@/queries/find-reference-uses';
import type { ReferenceScanCache } from '@/queries/find-reference-uses';
import type { Storages } from '@/storages/storages';

export interface LoadLibraryOptions {
	app: App;
	attachments: Pick<Attachments, 'from'>;
	profile: string;
	scans?: ReferenceScanCache;
	settings: Pick<Settings, 'profileFor'>;
	storages: Pick<Storages<Attachment>, 'storeFor'>;
}

export async function loadLibrary({
	app,
	attachments,
	profile,
	scans,
	settings,
	storages,
}: LoadLibraryOptions): Promise<LibraryItem[]> {
	const store = storages.storeFor(profile);
	const profileId = settings.profileFor(profile)?.id ?? profile;
	const [objects, uses] = await Promise.all([listObjects(store), findReferenceUses({ app, attachments, settings, scans })]);

	return inventoryOf({ profile: profileId, objects, uses: uses.filter((use) => use.profile === profileId) });
}

async function listObjects(store: ReturnType<LoadLibraryOptions['storages']['storeFor']>) {
	const objects = [];
	for await (const object of store.list()) objects.push(object);
	return objects;
}
