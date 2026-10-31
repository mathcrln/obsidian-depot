import { expect, it, onTestFinished, vi } from 'vitest';
import type { App, TFile, WorkspaceLeaf } from 'obsidian';
import type DepotPlugin from '@/main';
import type { Attachment } from '@/attachments/attachment';
import type { Attachments } from '@/attachments/attachments';
import type { ObjectSummary } from '@/storages/object-store';
import type { Storages } from '@/storages/storages';
import { AttachmentReference } from '@/references/attachment-reference';
import { Library } from '@/queries/library';
import { Settings } from '@/models/plugin-settings';
import { LibraryView } from '@/ui/library/library-view';
import { Events } from '../../support/obsidian';
import { find, findAll, WhenChoosing, WhenClicking, WhenTyping } from '../../support/setup';

it('keeps the latest library load when an older refresh finishes afterward', async () => {
	const fixture = GivenLibraryView({ lists: [deferred(), deferred()] });

	await WhenLoadsFinishOutOfOrder(fixture, {
		older: [GivenObject('stale.pdf')],
		latest: [GivenObject('fresh.pdf'), GivenObject('photo.png')],
	});

	expect(tilesIn(fixture)).toEqual([expect.stringContaining('fresh.pdf'), expect.stringContaining('photo.png')]);
});

it('does not render a library load that completes after the view closes', async () => {
	const fixture = GivenLibraryView({ lists: [deferred()] });

	await WhenClosingDuringLoad(fixture, [GivenObject('after-close.pdf')]);

	expect(tilesIn(fixture)).toHaveLength(0);
	expect(fixture.subscriptions()).toBe(0);
});

it('clears selection when the selected file no longer matches the kind filter', async () => {
	const fixture = await GivenOpenLibrary('document.pdf', 'photo.png');
	WhenSelectingTile(fixture, 'pdf');

	WhenFilteringKind(fixture, 'image');

	expect(tilesIn(fixture)).toEqual([expect.stringContaining('photo.png')]);
	expect(find(fixture.content, '.depot-library-details').hasClass('is-hidden')).toBe(true);
});

it('shows the selected file in the details panel', async () => {
	const fixture = await GivenOpenLibrary('document.pdf', 'photo.png');

	WhenSelectingTile(fixture, 'pdf');

	expect(find(fixture.content, '.depot-library-details').textContent).toContain('document.pdf');
});

it('filters by search', async () => {
	const fixture = await GivenOpenLibrary('document.pdf', 'photo.png');

	WhenSearching(fixture, 'photo');

	await vi.waitFor(() => expect(tilesIn(fixture)).toEqual([expect.stringContaining('photo.png')]));
});

it('shows everything again when the search is cleared', async () => {
	const fixture = await GivenOpenLibrary('document.pdf', 'photo.png');
	WhenSearching(fixture, 'photo');
	await vi.waitFor(() => expect(tilesIn(fixture)).toHaveLength(1));

	WhenClearingSearch(fixture);

	await vi.waitFor(() => expect(tilesIn(fixture)).toHaveLength(2));
});

it('ignores searches typed after the view closes', async () => {
	const fixture = await GivenOpenLibrary('document.pdf', 'photo.png');
	const search = find<HTMLInputElement>(fixture.content, 'input[type="search"]');
	await fixture.view.onClose();

	WhenTyping(search, 'photo');
	await new Promise((resolve) => setTimeout(resolve, 300));

	expect(tilesIn(fixture)).toHaveLength(2);
});

it('keeps a broken status selection through a refresh', async () => {
	const fixture = await GivenOpenLibraryWithBrokenReference();
	WhenClicking(brokenTab(fixture));

	await WhenRefreshingTo(fixture, []);

	await vi.waitFor(() => expect(findAll(fixture.content, '.depot-library-tab')).toHaveLength(4));
	expect(brokenTab(fixture).getAttribute('aria-pressed')).toBe('true');
});

it('hides the status tabs while refreshing', async () => {
	const fixture = GivenLibraryView({ lists: [[], deferred()] });
	await fixture.view.onOpen();

	WhenRefreshing(fixture);

	expect(findAll(fixture.content, '.depot-library-tab')).toHaveLength(0);
});

it('releases workspace listeners when the view closes, every time', async () => {
	const fixture = await GivenReopenedLibrary();

	await fixture.view.onClose();

	expect(fixture.subscriptions()).toBe(0);
});

it('stops refreshing from a control of a closed view', async () => {
	const fixture = await GivenOpenLibrary();
	const refresh = find(fixture.content, '.depot-library-refresh');
	await fixture.view.onClose();
	const loads = fixture.loads();

	WhenClicking(refresh);

	expect(fixture.loads()).toBe(loads);
});

interface Deferred {
	promise: Promise<ObjectSummary[]>;
	resolve: (objects: ObjectSummary[]) => void;
}

interface LibraryViewFixture {
	view: LibraryView;
	lists: Array<ObjectSummary[] | Deferred>;
	content: HTMLElement;
	subscriptions: () => number;
	loads: () => number;
}

function GivenLibraryView({
	lists = [],
	notes = [],
}: {
	lists?: Array<ObjectSummary[] | Deferred>;
	notes?: Array<{ path: string; text: string }>;
}): LibraryViewFixture {
	const settings = Settings.from({ profiles: [{ id: 'personal' }] });
	const pendingLists = [...lists];
	let loads = 0;
	const store = {
		async *list() {
			loads++;
			const next = pendingLists.shift() ?? [];
			const objects = Array.isArray(next) ? next : await next.promise;
			for (const object of objects) yield object;
		},
	};
	const storages = { storeFor: () => store } as unknown as Storages<Attachment>;
	const vaultFiles = notes.map(({ path }) => ({ path, extension: 'md', stat: { mtime: 1, size: 0 } }) as unknown as TFile);
	const app = {
		vault: {
			getFiles: () => vaultFiles,
			cachedRead: async (file: TFile) => notes.find((note) => note.path === file.path)?.text ?? '',
		},
		workspace: Object.assign(new Events(), { getActiveViewOfType: () => undefined }),
	};
	const attachments = {
		from(value: string) {
			const reference = AttachmentReference.tryParse(value);
			return reference === undefined ? undefined : { reference };
		},
		of: () => ({ reference: { toString: () => 'personal://file' }, markdown: () => '![](personal://file)' }),
	} as unknown as Attachments;
	const library = new Library({ app: app as unknown as App, settings, storages, attachments });
	const plugin = { app, depot: { settings, storages, attachments, library, notes: { in: () => ({ insert: () => {} }) } } };
	const view = new LibraryView({ app } as unknown as WorkspaceLeaf, plugin as unknown as DepotPlugin);
	view.load();
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(readonly callback: IntersectionObserverCallback) {}
			observe(): void {}
			unobserve(): void {}
			disconnect(): void {}
		}
	);

	onTestFinished(async () => {
		for (const pending of lists) if (!Array.isArray(pending)) pending.resolve([]);
		await view.onClose();
	});

	return {
		view,
		lists,
		content: view.contentEl,
		subscriptions: () => app.workspace.listeners(),
		loads: () => loads,
	};
}

async function GivenOpenLibrary(...keys: string[]): Promise<LibraryViewFixture> {
	const fixture = GivenLibraryView({ lists: [keys.map(GivenObject)] });
	await fixture.view.onOpen();

	return fixture;
}

async function GivenOpenLibraryWithBrokenReference(): Promise<LibraryViewFixture> {
	const fixture = GivenLibraryView({
		lists: [[], deferred()],
		notes: [{ path: 'Notes/Photo.md', text: '![](personal://missing.pdf)' }],
	});
	await fixture.view.onOpen();

	return fixture;
}

async function GivenReopenedLibrary(): Promise<LibraryViewFixture> {
	const fixture = GivenLibraryView({ lists: [[], []] });
	await fixture.view.onOpen();
	await fixture.view.onClose();
	await fixture.view.onOpen();

	return fixture;
}

function GivenObject(key: string): ObjectSummary {
	return { key, size: 1, lastModified: 0 };
}

function WhenSelectingTile(fixture: LibraryViewFixture, kind: string): void {
	WhenClicking(find(fixture.content, `.depot-library-tile[data-kind="${kind}"]`));
}

function WhenFilteringKind(fixture: LibraryViewFixture, kind: string): void {
	WhenChoosing(find(fixture.content, '[aria-label="File kind"]'), kind);
}

function WhenSearching(fixture: LibraryViewFixture, query: string): void {
	WhenTyping(find(fixture.content, 'input[type="search"]'), query);
}

function WhenClearingSearch(fixture: LibraryViewFixture): void {
	WhenClicking(find(fixture.content, '.search-input-clear-button'));
}

function WhenRefreshing(fixture: LibraryViewFixture): void {
	WhenClicking(find(fixture.content, '.depot-library-refresh'));
}

async function WhenRefreshingTo(fixture: LibraryViewFixture, objects: ObjectSummary[]): Promise<void> {
	WhenRefreshing(fixture);
	pendingList(fixture, 1).resolve(objects);
	await vi.waitFor(() => expect(findAll(fixture.content, '.depot-library-tab')).not.toHaveLength(0));
}

async function WhenLoadsFinishOutOfOrder(
	fixture: LibraryViewFixture,
	{ older, latest }: { older: ObjectSummary[]; latest: ObjectSummary[] }
): Promise<void> {
	const opening = fixture.view.onOpen();
	const refresh = fixture.view.refresh();
	pendingList(fixture, 1).resolve(latest);
	await refresh;
	pendingList(fixture, 0).resolve(older);
	await opening;
}

async function WhenClosingDuringLoad(fixture: LibraryViewFixture, objects: ObjectSummary[]): Promise<void> {
	const opening = fixture.view.onOpen();
	await fixture.view.onClose();
	pendingList(fixture, 0).resolve(objects);
	await opening;
}

function deferred(): Deferred {
	let resolve: (objects: ObjectSummary[]) => void = () => {};
	const promise = new Promise<ObjectSummary[]>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function pendingList(fixture: LibraryViewFixture, index: number): Deferred {
	const list = fixture.lists[index];
	if (list === undefined || Array.isArray(list)) throw new Error(`List ${index} is not pending.`);
	return list;
}

function tilesIn(fixture: LibraryViewFixture): string[] {
	return findAll(fixture.content, '.depot-library-tile').map((tile) => tile.title);
}

function brokenTab(fixture: LibraryViewFixture): HTMLElement {
	const tab = findAll(fixture.content, '.depot-library-tab').find((candidate) => candidate.textContent?.includes('Broken'));
	if (tab === undefined) throw new Error('The broken status tab was not rendered.');
	return tab;
}
