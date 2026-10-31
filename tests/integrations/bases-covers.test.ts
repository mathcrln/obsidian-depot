import { expect, it, onTestFinished, vi } from 'vitest';
import { TFile, type Plugin } from 'obsidian';
import { BasesCovers } from '@/integrations/bases-covers';
import type { Depot } from '@/depot';
import type { WorkspaceObserver } from '@/integrations/workspace-observer';
import { FakeWorkspaceObserver } from '../support/setup';

it('does not watch the workspace before it is loaded', () => {
	const fixture = GivenBasesCovers();

	expect(fixture.observer.subscribers).toBe(0);
});

it('watches the workspace once loaded', () => {
	const fixture = GivenBasesCovers();

	fixture.component.load();

	expect(fixture.observer.subscribers).toBe(1);
});

it('stops watching the workspace once unloaded', () => {
	const fixture = GivenLoadedBasesCovers();

	fixture.component.unload();

	expect(fixture.observer.subscribers).toBe(0);
});

it('shows the cover image of the card note', async () => {
	const card = GivenCard('Notes/One.md');
	const fixture = GivenLoadedBasesCovers();

	WhenObserved(fixture, card.root);
	WhenCoverLoads(fixture, 0, 'blob:cover');

	await vi.waitFor(() => expect(card.cover.style.backgroundImage).toBe('url("blob:cover")'));
	expect(card.cover.dataset.depot).toBe('loaded');
});

it('renders a cover reported on its own', async () => {
	const card = GivenCard('Notes/One.md');
	const fixture = GivenLoadedBasesCovers();

	WhenObserved(fixture, card.cover);
	WhenCoverLoads(fixture, 0, 'blob:cover');

	await vi.waitFor(() => expect(card.cover.style.backgroundImage).toBe('url("blob:cover")'));
});

it('marks a cover that fails to load', async () => {
	const card = GivenCard('Notes/One.md');
	const fixture = GivenLoadedBasesCovers();

	WhenObserved(fixture, card.root);
	WhenCoverFails(fixture, 0, 'Access denied');

	await vi.waitFor(() => expect(card.cover.dataset.depot).toBe('failed'));
	expect(card.cover.hasClass('depot-cover-failed')).toBe(true);
	expect(card.cover.getAttribute('aria-label')).toBe('Access denied');
});

it('keeps a recycled cover on the new note when the old image loads later', async () => {
	const card = GivenRecycledCard('Notes/One.md', 'Notes/Two.md');

	WhenCoverLoads(card.fixture, 1, 'blob:new-note');
	WhenCoverLoads(card.fixture, 0, 'blob:old-note');

	await vi.waitFor(() => expect(card.cover.style.backgroundImage).toBe('url("blob:new-note")'));
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(card.cover.style.backgroundImage).toBe('url("blob:new-note")');
});

it('ignores a cover that loads after its renderer was unloaded', async () => {
	const card = GivenCard('Notes/One.md');
	const fixture = GivenLoadedBasesCovers();
	WhenObserved(fixture, card.root);
	fixture.component.unload();

	WhenCoverLoads(fixture, 0, 'blob:stale');
	await new Promise((resolve) => setTimeout(resolve, 0));

	expect(card.cover.style.backgroundImage).toBe('');
});

it('retries a cover left pending by an unloaded renderer', async () => {
	const card = GivenCard('Notes/One.md');
	const first = GivenLoadedBasesCovers();
	WhenObserved(first, card.root);
	first.component.unload();
	const second = GivenLoadedBasesCovers();

	WhenObserved(second, card.root);
	WhenCoverLoads(second, 0, 'blob:fresh');

	await vi.waitFor(() => expect(card.cover.style.backgroundImage).toBe('url("blob:fresh")'));
});

it('leaves a card alone when its note has no Depot cover', () => {
	const card = GivenCard('Notes/One.md');
	const fixture = GivenLoadedBasesCovers({ covers: false });

	WhenObserved(fixture, card.root);

	expect(card.cover.dataset.depot).toBeUndefined();
	expect(fixture.resolutions).toHaveLength(0);
});

function GivenLoadedBasesCovers(options: { covers?: boolean } = {}) {
	const fixture = GivenBasesCovers(options);
	fixture.component.load();

	return fixture;
}

function GivenRecycledCard(from: string, to: string) {
	const card = GivenCard(from);
	const fixture = GivenLoadedBasesCovers();
	WhenObserved(fixture, card.root);
	card.root.setAttribute('data-path', to);
	WhenObserved(fixture, card.root);

	return { ...card, fixture };
}

function GivenBasesCovers({ covers = true }: { covers?: boolean } = {}) {
	const notes = ['Notes/One.md', 'Notes/Two.md'];
	const files = new Map(notes.map((path) => [path, Object.assign(new TFile(), { path })]));
	const resolutions: Array<(value: { url: string }) => void> = [];
	const failures: Array<(error: Error) => void> = [];
	const attachment = {
		kind: 'image',
		resolve: () =>
			new Promise((resolve, reject) => {
				resolutions.push(resolve);
				failures.push(reject);
			}),
	};
	const plugin = {
		app: {
			vault: { getAbstractFileByPath: (path: string) => files.get(path) ?? null },
			metadataCache: {
				getFileCache: () => ({ frontmatter: { cover: 'personal://cover.png' } }),
				getFirstLinkpathDest: () => null,
			},
		},
	};
	const depot = { attachments: { within: () => (covers ? [attachment] : []) } };
	const observer = new FakeWorkspaceObserver();
	const component = new BasesCovers(
		plugin as unknown as Plugin,
		depot as unknown as Depot,
		observer as unknown as WorkspaceObserver
	);

	onTestFinished(() => component.unload());

	return { component, observer, resolutions, failures };
}

function GivenCard(path: string) {
	const root = document.body.createDiv({ cls: 'bases-cards-item', attr: { 'data-path': path } });
	const cover = root.createDiv({ cls: 'bases-cards-cover' });

	return { root, cover };
}

function WhenObserved(fixture: ReturnType<typeof GivenBasesCovers>, element: HTMLElement): void {
	fixture.observer.render(element);
}

function WhenCoverLoads(fixture: ReturnType<typeof GivenBasesCovers>, request: number, url: string): void {
	fixture.resolutions[request]?.({ url });
}

function WhenCoverFails(fixture: ReturnType<typeof GivenBasesCovers>, request: number, message: string): void {
	fixture.failures[request]?.(new Error(message));
}
