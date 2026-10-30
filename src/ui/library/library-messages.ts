import { setIcon } from 'obsidian';
import { AccessDenied } from '@/storages/object-store';
import { providerOf } from '@/storages/provider';
import type { Settings } from '@/models/plugin-settings';

export function showLibraryEmpty(messageEl: HTMLElement, noFiles: boolean): void {
	messageEl.empty();
	messageEl.removeClass('is-error', 'is-hidden');
	const empty = messageEl.createDiv({ cls: 'depot-library-empty' });
	setIcon(empty.createDiv({ cls: 'depot-library-empty-icon' }), noFiles ? 'images' : 'search-x');
	empty.createDiv({ cls: 'depot-library-empty-title', text: noFiles ? 'No files yet' : 'No files match your search' });
	empty.createDiv({
		cls: 'depot-library-empty-hint',
		text: noFiles ? 'Files you upload to this profile appear here.' : 'Try different words or another filter.',
	});
}

export function showLibraryMessage(messageEl: HTMLElement, text: string, isError = false): void {
	messageEl.empty();
	messageEl.toggleClass('is-error', isError);
	messageEl.toggleClass('is-hidden', text === '');
	messageEl.setText(text);
}

export function libraryFailureMessage(settings: Settings, profile: string, error: unknown): string {
	if (!(error instanceof AccessDenied)) {
		return `Could not load "${profile}": ${error instanceof Error ? error.message : String(error)}`;
	}

	const hints = {
		aws: 'The AWS keys need the s3:ListBucket permission to browse this bucket.',
		r2: 'Check that the R2 token has access to this bucket.',
		other: 'Check that the keys are allowed to list this bucket.',
	};

	return `Access denied for "${profile}". ${hints[providerOf(settings.profile(profile)?.endpoint ?? '')]}`;
}
