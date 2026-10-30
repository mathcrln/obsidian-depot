import type { App } from 'obsidian';
import type { Attachment } from '@/attachments/attachment';
import type { Attachments } from '@/attachments/attachments';
import type { LibraryItem } from '@/library/library-item';
import type { Settings } from '@/models/plugin-settings';
import { loadLibrary } from '@/queries/load-library';
import { ReferenceScanCache } from '@/queries/find-reference-uses';
import type { Storages } from '@/storages/storages';

export interface LibraryOptions {
	app: App;
	attachments: Attachments;
	settings: Settings;
	storages: Storages<Attachment>;
}

export class Library {
	private readonly scans = new ReferenceScanCache();

	constructor(private readonly options: LibraryOptions) {}

	load(profile: string): Promise<LibraryItem[]> {
		return loadLibrary({ ...this.options, profile, scans: this.scans });
	}
}
