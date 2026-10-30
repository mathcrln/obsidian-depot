import { afterEach, expect, it, vi } from 'vitest';
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

const searchControls = vi.hoisted(() => [] as Array<{ change: (query: string) => void }>);

vi.mock('obsidian', () => {
	class Component {
		children: Component[] = [];
		cleanups: Array<() => void> = [];
		loaded = false;
		addChild<T extends Component>(child: T): T {
			this.children.push(child);
			if (this.loaded) child.load();
			return child;
		}
		removeChild<T extends Component>(child: T): T {
			this.children = this.children.filter((candidate) => candidate !== child);
			child.unload();
			return child;
		}
		load(): void {
			this.loaded = true;
		}
		unload(): void {
			this.cleanups.splice(0).forEach((cleanup) => cleanup());
			this.children.splice(0).forEach((child) => child.unload());
			(this as unknown as { onunload?: () => void }).onunload?.();
			this.loaded = false;
		}
		register(cleanup: () => void): void {
			this.cleanups.push(cleanup);
		}
		registerEvent(dispose: () => void): void {
			this.register(dispose);
		}
		registerDomEvent(element: FakeElement, type: string, callback: EventListener): void {
			element.addEventListener(type, callback);
			this.register(() => element.removeEventListener(type, callback));
		}
	}
	return {
		Component,
		ItemView: class ItemView extends Component {
			contentEl = new FakeElement();
			app: unknown;
			constructor(leaf: { app: unknown }) {
				super();
				this.app = leaf.app;
			}
		},
		Modal: class Modal extends Component {
			contentEl = new FakeElement();
			modalEl = new FakeElement();
			titleEl = new FakeElement();
			scope = { register: () => ({}), unregister: () => {} };
			constructor(readonly app: unknown) {
				super();
			}
		},
		MarkdownView: class MarkdownView {},
		Platform: { isMobile: false },
		SearchComponent: class SearchComponent {
			inputEl: FakeElement;
			private changed: (query: string) => void = () => {};
			constructor(parent: FakeElement) {
				this.inputEl = parent.createEl('input');
				searchControls.push({ change: (query) => this.changed(query) });
			}
			setPlaceholder(): this {
				return this;
			}
			setValue(): this {
				return this;
			}
			onChange(callback: (query: string) => void): this {
				this.changed = callback;
				return this;
			}
		},
		debounce: (callback: (query: string) => void) => Object.assign(callback, { cancel: () => {} }),
		setIcon: () => {},
	};
});
afterEach(() => {
	vi.unstubAllGlobals();
	searchControls.splice(0);
});

it('keeps the latest real library query when an older refresh finishes afterward', async () => {
	const older = deferred<ObjectSummary[]>();
	const latest = deferred<ObjectSummary[]>();
	const fixture = GivenLibraryView({ lists: [older.promise, latest.promise] });
	const opening = fixture.view.onOpen();
	const refresh = fixture.view.refresh();

	latest.resolve([GivenObject('fresh.pdf'), GivenObject('photo.png')]);
	await refresh;
	older.resolve([GivenObject('stale.pdf')]);
	await opening;

	const titles = fixture.content.findAllClass('depot-library-tile').map((tile) => tile.attributes.title);
	expect(titles.some((title) => title?.includes('fresh.pdf'))).toBe(true);
	expect(titles.some((title) => title?.includes('photo.png'))).toBe(true);
	expect(titles.some((title) => title?.includes('stale.pdf'))).toBe(false);
	await fixture.view.onClose();
});

it('does not render a library load that completes after the view closes', async () => {
	const pending = deferred<ObjectSummary[]>();
	const fixture = GivenLibraryView({ lists: [pending.promise] });
	const opening = fixture.view.onOpen();
	await fixture.view.onClose();
	pending.resolve([GivenObject('after-close.pdf')]);
	await opening;

	expect(fixture.content.findAllClass('depot-library-tile')).toHaveLength(0);
	expect(fixture.subscriptions()).toBe(0);
});

it('clears selection when the selected file no longer matches the kind filter', async () => {
	const fixture = GivenLibraryView({ lists: [[GivenObject('document.pdf'), GivenObject('photo.png')]] });
	await fixture.view.onOpen();
	const documentTile = fixture.content
		.findAllClass('depot-library-tile')
		.find((tile) => tile.attributes['data-kind'] === 'pdf');
	if (documentTile === undefined) throw new Error('The PDF tile was not rendered.');
	documentTile.dispatch('click');
	expect(fixture.content.findClass('depot-library-details').textContent).toContain('document.pdf');

	const kind = fixture.content.findAttribute('aria-label', 'File kind');
	kind.value = 'image';
	kind.dispatch('change');

	const visibleTitles = fixture.content.findAllClass('depot-library-tile').map((tile) => tile.attributes.title);
	expect(visibleTitles).toHaveLength(1);
	expect(visibleTitles[0]).toContain('photo.png');
	expect(fixture.content.findClass('depot-library-details').classes.has('is-hidden')).toBe(true);
	await fixture.view.onClose();
});

it('uses SearchComponent change callbacks for queries and clear actions', async () => {
	const searchIndex = searchControls.length;
	const fixture = GivenLibraryView({ lists: [[GivenObject('document.pdf'), GivenObject('photo.png')]] });
	await fixture.view.onOpen();
	const search = searchControls[searchIndex];
	if (search === undefined) throw new Error('Search component was not created.');

	search.change('photo');
	const matched = fixture.content.findAllClass('depot-library-tile');
	expect(matched).toHaveLength(1);
	expect(matched[0]?.attributes.title).toContain('photo.png');
	search.change('');
	expect(fixture.content.findAllClass('depot-library-tile')).toHaveLength(2);

	await fixture.view.onClose();
	search.change('photo');
	expect(fixture.content.findAllClass('depot-library-tile')).toHaveLength(2);
});

it('keeps a broken status selection through the loading view', async () => {
	const retry = deferred<ObjectSummary[]>();
	const fixture = GivenLibraryView({
		lists: [[], retry.promise],
		notes: [{ path: 'Notes/Photo.md', text: '![](personal://missing.pdf)' }],
	});
	await fixture.view.onOpen();
	const broken = fixture.content.findAllClass('depot-library-tab').find((tab) => tab.textContent.includes('Broken'));
	if (broken === undefined) throw new Error('The broken status tab was not rendered.');
	broken.dispatch('click');
	const selectedBroken = fixture.content.findAllClass('depot-library-tab').find((tab) => tab.textContent.includes('Broken'));
	expect(selectedBroken?.attributes['aria-pressed']).toBe('true');

	fixture.content.findClass('depot-library-refresh').dispatch('click');
	expect(fixture.content.findAllClass('depot-library-tab')).toHaveLength(0);
	retry.resolve([]);
	await vi.waitFor(() => expect(fixture.content.findAllClass('depot-library-tab')).toHaveLength(4));

	const refreshedBroken = fixture.content.findAllClass('depot-library-tab').find((tab) => tab.textContent.includes('Broken'));
	expect(refreshedBroken?.attributes['aria-pressed']).toBe('true');
	await fixture.view.onClose();
});

it('releases workspace and control listeners across repeated view opens', async () => {
	const fixture = GivenLibraryView({ lists: [[], []] });
	await fixture.view.onOpen();
	expect(fixture.subscriptions()).toBe(2);
	await fixture.view.onClose();
	expect(fixture.subscriptions()).toBe(0);

	await fixture.view.onOpen();
	expect(fixture.subscriptions()).toBe(2);
	const refresh = fixture.content.findClass('depot-library-refresh');
	expect(refresh.listeners.get('click')?.size).toBe(1);
	await fixture.view.onClose();
	expect(fixture.subscriptions()).toBe(0);
	expect(refresh.listeners.get('click')?.size).toBe(0);
});

interface LibraryViewFixture {
	view: LibraryView;
	content: FakeElement;
	subscriptions: () => number;
}

function GivenLibraryView({
	lists = [],
	notes = [],
}: {
	lists?: Array<ObjectSummary[] | Promise<ObjectSummary[]>>;
	notes?: Array<{ path: string; text: string }>;
}): LibraryViewFixture {
	const settings = Settings.from({ profiles: [{ id: 'personal' }] });
	const pendingLists = [...lists];
	const store = {
		async *list() {
			const objects = await (pendingLists.shift() ?? Promise.resolve([]));
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
		workspace: {
			subscriptions: 0,
			getActiveViewOfType: () => undefined,
			on() {
				this.subscriptions++;
				return () => {
					this.subscriptions--;
				};
			},
		},
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

	return {
		view,
		content: view.contentEl as unknown as FakeElement,
		subscriptions: () => app.workspace.subscriptions,
	};
}

function GivenObject(key: string): ObjectSummary {
	return { key, size: 1, lastModified: 0 };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
	let resolve: (value: T) => void = () => {};
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

class FakeElement {
	readonly children: FakeElement[] = [];
	readonly listeners = new Map<string, Set<EventListener>>();
	readonly classes = new Set<string>();
	readonly attributes: Record<string, string> = {};
	parentElement: FakeElement | undefined;
	value = '';
	clientWidth = 900;
	text = '';
	get textContent(): string {
		return this.text + this.children.map((child) => child.textContent).join('');
	}
	createDiv(options?: { cls?: string; text?: string; attr?: Record<string, string> }): FakeElement {
		return this.append(new FakeElement(options));
	}
	createEl(_tag: string, options?: { cls?: string; text?: string; attr?: Record<string, string> }): FakeElement {
		return this.append(new FakeElement(options));
	}
	createSpan(options?: { cls?: string; text?: string }): FakeElement {
		return this.append(new FakeElement(options));
	}
	addEventListener(type: string, callback: EventListener): void {
		const callbacks = this.listeners.get(type) ?? new Set<EventListener>();
		callbacks.add(callback);
		this.listeners.set(type, callbacks);
	}
	removeEventListener(type: string, callback: EventListener): void {
		this.listeners.get(type)?.delete(callback);
	}
	dispatch(type: string): void {
		this.listeners.get(type)?.forEach((callback) => callback(new Event(type)));
	}
	toggleClass(name: string, enabled: boolean): void {
		if (enabled) this.classes.add(name);
		else this.classes.delete(name);
	}
	addClass(name: string): void {
		this.classes.add(name);
	}
	removeClass(name: string): void {
		this.classes.delete(name);
	}
	setText(text: string): void {
		this.empty();
		this.text = text;
	}
	setAttr(name: string, value: string): void {
		this.attributes[name] = value;
	}
	empty(): void {
		this.children.splice(0);
		this.text = '';
	}
	findClass(name: string): FakeElement {
		const found = this.findClassOrUndefined(name);
		if (found === undefined) throw new Error(`Could not find ${name}.`);
		return found;
	}
	findClassOrUndefined(name: string): FakeElement | undefined {
		if (this.classes.has(name)) return this;
		for (const child of this.children) {
			const found = child.findClassOrUndefined(name);
			if (found !== undefined) return found;
		}
		return undefined;
	}
	findAllClass(name: string): FakeElement[] {
		return [...(this.classes.has(name) ? [this] : []), ...this.children.flatMap((child) => child.findAllClass(name))];
	}
	findAttribute(name: string, value: string): FakeElement {
		const found = this.findAttributeOrUndefined(name, value);
		if (found === undefined) throw new Error(`Could not find ${name}=${value}.`);
		return found;
	}
	findAttributeOrUndefined(name: string, value: string): FakeElement | undefined {
		if (this.attributes[name] === value) return this;
		for (const child of this.children) {
			const found = child.findAttributeOrUndefined(name, value);
			if (found !== undefined) return found;
		}
		return undefined;
	}
	private append(child: FakeElement): FakeElement {
		child.parentElement = this;
		this.children.push(child);
		return child;
	}
	constructor(options?: { cls?: string; text?: string; attr?: Record<string, string> }) {
		options?.cls?.split(/\s+/).forEach((name) => this.classes.add(name));
		this.text = options?.text ?? '';
		Object.assign(this.attributes, options?.attr ?? {});
	}
}
