import { expect, it, onTestFinished } from 'vitest';
import type { App, MarkdownView } from 'obsidian';
import type { Depot } from '@/depot';
import type { LibraryItem } from '@/library/library-item';
import { LibraryLightbox } from '@/ui/library/library-lightbox';
import type { Scope } from '../../support/obsidian';
import { buttonNamed, find, WhenClicking } from '../../support/setup';

it('navigates the supplied visible snapshot and updates the current item', () => {
	const fixture = GivenOpenLightbox();
	fixture.visible.splice(1, 1, fixture.third);

	WhenClickingNext(fixture.lightbox);

	expect(fixture.changed).toEqual([fixture.first, fixture.second]);
	expect(find(fixture.lightbox.contentEl, '.depot-library-lightbox-name').textContent).toBe('second.pdf');
	expect(find(fixture.lightbox.contentEl, '.depot-library-lightbox-facts').textContent).toBe('2 of 2');
});

it('navigates with the arrow keys', () => {
	const fixture = GivenOpenLightbox();

	WhenPressing(fixture.lightbox, 'ArrowRight');
	WhenPressing(fixture.lightbox, 'ArrowLeft');

	expect(fixture.changed).toEqual([fixture.first, fixture.second, fixture.first]);
});

it('inserts only the current item after navigating', () => {
	const fixture = GivenOpenLightbox();
	const staleInsert = buttonNamed(fixture.lightbox.contentEl, 'Insert into note');
	WhenClickingNext(fixture.lightbox);

	WhenClicking(staleInsert);
	WhenInserting(fixture.lightbox);

	expect(fixture.inserted).toEqual(['second.pdf']);
});

it('navigates again once reopened', () => {
	const fixture = GivenReopenedLightbox();

	WhenClickingNext(fixture.lightbox);

	expect(fixture.changed).toEqual([fixture.first, fixture.first, fixture.second]);
});

it('reports each dismissal', () => {
	const fixture = GivenReopenedLightbox();

	fixture.lightbox.close();

	expect(fixture.dismissed).toEqual([true, true]);
});

function GivenOpenLightbox() {
	const first = GivenLibraryItem('first.pdf');
	const second = GivenLibraryItem('second.pdf');
	const third = GivenLibraryItem('third.pdf');
	const visible = [first, second];
	const changed: LibraryItem[] = [];
	const dismissed: boolean[] = [];
	const inserted: string[] = [];
	const depot = {
		attachments: { of: (reference: { key: string }) => ({ reference, key: reference.key }) },
		notes: { in: () => ({ insert: (attachment: { key: string }) => inserted.push(attachment.key) }) },
	} as unknown as Depot;
	const editor = { editor: {} } as unknown as MarkdownView;
	const lightbox = new LibraryLightbox(
		{} as unknown as App,
		depot,
		[...visible],
		first,
		() => editor,
		(item) => changed.push(item),
		() => dismissed.push(true)
	);
	lightbox.open();
	onTestFinished(() => {
		if (lightbox.containerEl.isConnected) lightbox.close();
	});

	return { changed, dismissed, inserted, first, lightbox, second, third, visible };
}

function GivenReopenedLightbox() {
	const fixture = GivenOpenLightbox();
	fixture.lightbox.close();
	fixture.lightbox.open();

	return fixture;
}

function GivenLibraryItem(key: string): LibraryItem {
	return { profile: 'personal', key, kind: 'pdf', status: 'used', notes: [] };
}

function WhenClickingNext(lightbox: LibraryLightbox): void {
	WhenClicking(find(lightbox.contentEl, '[aria-label="Next file"]'));
}

function WhenInserting(lightbox: LibraryLightbox): void {
	WhenClicking(buttonNamed(lightbox.contentEl, 'Insert into note'));
}

function WhenPressing(lightbox: LibraryLightbox, key: string): void {
	(lightbox.scope as unknown as Scope).press(key);
}
