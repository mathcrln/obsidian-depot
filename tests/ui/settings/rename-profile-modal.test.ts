import { expect, it, onTestFinished } from 'vitest';
import type { App, TFile } from 'obsidian';
import { Profiles } from '@/actions/profiles';
import { Settings } from '@/models/plugin-settings';
import { RenameProfileModal } from '@/ui/settings/rename-profile-modal';
import { find, WhenTyping } from '../../support/setup';

it('shows the reopened scan and ignores an older scan that finishes afterward', async () => {
	const rename = GivenReopenedRenameModal('personal');

	await WhenScanFinishes(rename, 1, 'personal://fresh/folder/photo.png personal://fresh/folder/other.png');
	WhenEnteringNewName(rename, 'renamed');
	await WhenScanFinishes(rename, 0, 'personal://stale/old.png');

	expect(find(rename.modal.contentEl, '.depot-rename-impact').textContent).toContain('2 references in 1 note');
	expect(find(rename.modal.contentEl, '.depot-rename-preview').textContent).toContain('fresh/folder/…');
	expect(rename.firstImpact.textContent).toBe('Looking for references…');
});

function GivenReopenedRenameModal(profile: string) {
	const rename = GivenRenameModal(profile);
	rename.modal.open();
	const firstImpact = find(rename.modal.contentEl, '.depot-rename-impact');
	rename.modal.close();
	rename.modal.open();

	return { ...rename, firstImpact };
}

function GivenRenameModal(profile: string) {
	const scans: Array<(text: string) => void> = [];
	const file = { path: 'Notes/References.md', extension: 'md' } as unknown as TFile;
	const app = {
		vault: {
			getFiles: () => [file],
			cachedRead: () => new Promise<string>((resolve) => scans.push(resolve)),
		},
	} as unknown as App;
	const settings = Settings.from({ profiles: [{ id: profile }] });
	const modal = new RenameProfileModal(
		{ app, profiles: new Profiles({ app, settings, save: async () => {} }), settings, onChange: () => {} },
		profile
	);

	onTestFinished(() => {
		if (modal.containerEl.isConnected) modal.close();
	});

	return { modal, scans };
}

function WhenEnteringNewName(rename: ReturnType<typeof GivenRenameModal>, name: string): void {
	WhenTyping(find(rename.modal.contentEl, 'input'), name);
}

async function WhenScanFinishes(rename: ReturnType<typeof GivenReopenedRenameModal>, scan: number, text: string): Promise<void> {
	rename.scans[scan]?.(text);
	await new Promise((resolve) => setTimeout(resolve, 0));
}
