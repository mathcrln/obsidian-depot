import { afterEach, expect, it, vi } from 'vitest';
import { TFile, type Plugin } from 'obsidian';
import { BasesCovers } from '@/integrations/bases-covers';
import type { Depot } from '@/depot';
import type { WorkspaceObserver } from '@/integrations/workspace-observer';

vi.mock('obsidian', () => ({
	TFile: class TFile {},
	Component: class {
		private readonly disposers: Array<() => void> = [];
		load(): void {
			this.onload();
		}
		unload(): void {
			this.onunload();
			for (const dispose of this.disposers.splice(0)) dispose();
		}
		onload(): void {}
		onunload(): void {}
		register(dispose: () => void): void {
			this.disposers.push(dispose);
		}
	},
}));

const originalHTMLElement = globalThis.HTMLElement;
afterEach(() => {
	globalThis.HTMLElement = originalHTMLElement;
});

it('subscribes on load and unsubscribes on unload', () => {
	const fixture = GivenBasesCovers(new FakeRoot() as unknown as HTMLElement, new Map(), GivenAttachment([]));
	expect(fixture.observer.subscribers).toBe(0);

	fixture.component.load();
	expect(fixture.observer.subscribers).toBe(1);

	fixture.component.unload();
	expect(fixture.observer.subscribers).toBe(0);
});

it('renders a Bases cover when the cover itself is the scan root', async () => {
	const note = GivenNote('Notes/One.md');
	const cover = GivenCover(() => note.path);
	const resolutions: Array<(value: { url: string }) => void> = [];
	const fixture = GivenBasesCovers(cover as unknown as HTMLElement, new Map([[note.path, note]]), GivenAttachment(resolutions));
	fixture.component.load();
	fixture.observer.render(cover as unknown as HTMLElement);
	expect(resolutions).toHaveLength(1);

	resolutions[0]?.({ url: 'blob:cover' });
	await vi.waitFor(() => expect(cover.style.backgroundImage).toBe('url("blob:cover")'));
	expect(cover.dataset.depot).toBe('loaded');
	fixture.component.unload();
});

it('keeps a recycled cover on the new note when an older image resolves later', async () => {
	const firstNote = GivenNote('Notes/One.md');
	const nextNote = GivenNote('Notes/Two.md');
	let path = firstNote.path;
	const cover = GivenCover(() => path);
	const resolutions: Array<(value: { url: string }) => void> = [];
	const fixture = GivenBasesCovers(
		cover as unknown as HTMLElement,
		new Map([
			[firstNote.path, firstNote],
			[nextNote.path, nextNote],
		]),
		GivenAttachment(resolutions)
	);
	fixture.component.load();
	fixture.observer.render(cover as unknown as HTMLElement);
	path = nextNote.path;
	fixture.observer.render(cover as unknown as HTMLElement);
	resolutions[0]?.({ url: 'blob:old-note' });
	await Promise.resolve();
	expect(cover.style.backgroundImage).toBe('');
	resolutions[1]?.({ url: 'blob:new-note' });
	await vi.waitFor(() => expect(cover.style.backgroundImage).toBe('url("blob:new-note")'));
	expect(cover.dataset.depot).toBe('loaded');
	fixture.component.unload();
});

it('retries the same pending cover after the component is mounted again', async () => {
	const note = GivenNote('Notes/One.md');
	const cover = GivenCover(() => note.path);
	const resolutions: Array<(value: { url: string }) => void> = [];
	const notes = new Map([[note.path, note]]);
	const attachment = GivenAttachment(resolutions);
	const first = GivenBasesCovers(cover as unknown as HTMLElement, notes, attachment);
	first.component.load();
	first.observer.render(cover as unknown as HTMLElement);
	first.component.unload();

	const second = GivenBasesCovers(cover as unknown as HTMLElement, notes, attachment);
	second.component.load();
	second.observer.render(cover as unknown as HTMLElement);
	expect(resolutions).toHaveLength(2);
	resolutions[0]?.({ url: 'blob:stale' });
	await Promise.resolve();
	expect(cover.style.backgroundImage).toBe('');
	resolutions[1]?.({ url: 'blob:fresh' });
	await vi.waitFor(() => expect(cover.style.backgroundImage).toBe('url("blob:fresh")'));
	second.component.unload();
});

function GivenBasesCovers(root: HTMLElement, notes: Map<string, TFile>, attachment: ImageAttachment) {
	globalThis.HTMLElement = FakeCover as unknown as typeof HTMLElement;
	const observer = new FakeWorkspaceObserver();
	const plugin = {
		app: {
			workspace: { containerEl: root },
			vault: { getAbstractFileByPath: (path: string) => notes.get(path) ?? null },
			metadataCache: {
				getFileCache: () => ({ frontmatter: { cover: 'cover.png' } }),
				getFirstLinkpathDest: () => null,
			},
		},
	};
	const depot = { attachments: { within: () => [attachment] } };
	const component = new BasesCovers(
		plugin as unknown as Plugin,
		depot as unknown as Depot,
		observer as unknown as WorkspaceObserver
	);
	return { component, observer };
}

function GivenAttachment(resolutions: Array<(value: { url: string }) => void>): ImageAttachment {
	return {
		kind: 'image',
		resolve: () => new Promise((resolve) => resolutions.push(resolve)),
	};
}

function GivenNote(path: string): TFile {
	return Object.assign(new TFile(), { path });
}

function GivenCover(path: () => string): FakeCover {
	return new FakeCover(path);
}

type ImageAttachment = {
	kind: 'image';
	resolve(): Promise<{ url: string }>;
};

class FakeWorkspaceObserver {
	private renderer: ((element: HTMLElement) => void) | undefined;

	get subscribers(): number {
		return this.renderer ? 1 : 0;
	}

	subscribe(render: (element: HTMLElement) => void): () => void {
		this.renderer = render;
		return () => {
			this.renderer = undefined;
		};
	}

	render(element: HTMLElement): void {
		this.renderer?.(element);
	}
}

class FakeRoot {
	matches = vi.fn(() => false);
	querySelectorAll = vi.fn(() => []);
}

class FakeCover {
	dataset: Record<string, string> = {};
	style = {
		backgroundImage: '',
		removeProperty: (property: string) => {
			if (property === 'background-image') this.style.backgroundImage = '';
		},
	};
	childElementCount = 0;
	querySelectorAll = vi.fn(() => []);
	addClass = vi.fn();
	setAttribute = vi.fn();
	private readonly card: { innerText: string; getAttribute(name: string): string | null; querySelector(): null };

	constructor(path: () => string) {
		this.card = {
			innerText: '',
			getAttribute: (name) => (name === 'data-path' ? path() : null),
			querySelector: () => null,
		};
	}

	matches(selector: string): boolean {
		return selector === '.bases-cards-cover';
	}

	closest(): HTMLElement {
		return this.card as unknown as HTMLElement;
	}

	get parentElement(): HTMLElement {
		return this.card as unknown as HTMLElement;
	}

	instanceOf(constructor: typeof HTMLElement): boolean {
		return constructor === (FakeCover as unknown as typeof HTMLElement);
	}
}
