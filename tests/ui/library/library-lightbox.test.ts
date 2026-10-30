import { expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import type { Depot } from '@/depot';
import type { LibraryItem } from '@/library/library-item';
import { LibraryLightbox } from '@/ui/library/library-lightbox';

vi.mock('obsidian', () => ({
	Component: class Component {
		cleanups: Array<() => void> = [];
		register(cleanup: () => void): void {
			this.cleanups.push(cleanup);
		}
		registerDomEvent(element: FakeElement, type: string, callback: EventListener): void {
			element.addEventListener(type, callback);
			this.register(() => element.removeEventListener(type, callback));
		}
		load(): void {}
		unload(): void {
			this.cleanups.splice(0).forEach((cleanup) => cleanup());
		}
	},
	Modal: class Modal {
		contentEl = new FakeElement();
		modalEl = new FakeElement();
		titleEl = new FakeElement();
		scope = new FakeScope();
		constructor(readonly app: unknown) {}
		open(): void {
			(this as unknown as { onOpen: () => void }).onOpen();
		}
		close(): void {
			(this as unknown as { onClose: () => void }).onClose();
		}
	},
	Notice: class Notice {},
	setIcon: () => {},
}));

it('navigates the supplied visible snapshot and updates the current item', () => {
	const fixture = GivenLightbox();
	fixture.visible.splice(1, 1, fixture.third);
	fixture.content.findAttribute('aria-label', 'Next file').dispatch('click');

	expect(fixture.changed).toEqual([fixture.first, fixture.second]);
	expect(fixture.content.findClass('depot-library-lightbox-name').textContent).toBe('second.pdf');
	expect(fixture.content.findClass('depot-library-lightbox-facts').textContent).toBe('2 of 2');
	fixture.lightbox.close();
});

it('releases an item action listener when navigation changes the item', () => {
	const fixture = GivenLightbox();
	const oldInsert = fixture.content.findClass('depot-library-actions').children[1];
	fixture.content.findAttribute('aria-label', 'Next file').dispatch('click');

	expect(oldInsert?.listeners.get('click')?.size).toBe(0);
	fixture.lightbox.close();
});

it('cleans navigation listeners across repeated close and open cycles', () => {
	const fixture = GivenLightbox();
	const firstNext = fixture.content.findAttribute('aria-label', 'Next file');
	fixture.lightbox.close();
	expect(firstNext.listeners.get('click')?.size).toBe(0);

	fixture.lightbox.open();
	const reopenedNext = fixture.content.findAttribute('aria-label', 'Next file');
	expect(reopenedNext.listeners.get('click')?.size).toBe(1);
	reopenedNext.dispatch('click');
	fixture.lightbox.close();

	expect(fixture.changed).toEqual([fixture.first, fixture.first, fixture.second]);
	expect(fixture.dismissed).toEqual([true, true]);
});

function GivenLibraryItem(key: string): LibraryItem {
	return { profile: 'personal', key, kind: 'pdf', status: 'used', notes: [] };
}

function GivenLightbox() {
	const first = GivenLibraryItem('first.pdf');
	const second = GivenLibraryItem('second.pdf');
	const third = GivenLibraryItem('third.pdf');
	const visible = [first, second];
	const changed: LibraryItem[] = [];
	const dismissed: boolean[] = [];
	const depot = {
		attachments: {
			of: () => ({ reference: { toString: () => 'personal://file' }, markdown: () => '![](personal://file)' }),
		},
	} as unknown as Depot;
	const lightbox = new LibraryLightbox(
		{} as unknown as App,
		depot,
		[...visible],
		first,
		() => undefined,
		(item) => changed.push(item),
		() => dismissed.push(true)
	);
	lightbox.open();

	return { changed, content: lightbox.contentEl as unknown as FakeElement, dismissed, first, lightbox, second, third, visible };
}

class FakeScope {
	private readonly handlers = new Set<object>();
	register(): object {
		const handler = {};
		this.handlers.add(handler);
		return handler;
	}
	unregister(handler: object): void {
		this.handlers.delete(handler);
	}
}

class FakeElement {
	readonly children: FakeElement[] = [];
	readonly listeners = new Map<string, Set<EventListener>>();
	readonly attributes: Record<string, string> = {};
	readonly classes = new Set<string>();
	disabled = false;
	text = '';

	get textContent(): string {
		return this.text + this.children.map((child) => child.textContent).join('');
	}
	createEl(_tag: string, options?: { cls?: string; text?: string; attr?: Record<string, string> }): FakeElement {
		const child = new FakeElement(options);
		this.children.push(child);
		return child;
	}
	createDiv(options?: { cls?: string; text?: string; attr?: Record<string, string> }): FakeElement {
		return this.createEl('div', options);
	}
	createSpan(options?: { cls?: string; text?: string; attr?: Record<string, string> }): FakeElement {
		return this.createEl('span', options);
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
	findAttribute(name: string, value: string): FakeElement {
		if (this.attributes[name] === value) return this;
		for (const child of this.children) {
			const found = child.findAttributeOrUndefined(name, value);
			if (found !== undefined) return found;
		}
		throw new Error(`Could not find ${name}=${value}.`);
	}
	findClass(name: string): FakeElement {
		if (this.classes.has(name)) return this;
		for (const child of this.children) {
			const found = child.findClassOrUndefined(name);
			if (found !== undefined) return found;
		}
		throw new Error(`Could not find ${name}.`);
	}
	findClassOrUndefined(name: string): FakeElement | undefined {
		if (this.classes.has(name)) return this;
		for (const child of this.children) {
			const found = child.findClassOrUndefined(name);
			if (found !== undefined) return found;
		}
		return undefined;
	}
	findAttributeOrUndefined(name: string, value: string): FakeElement | undefined {
		if (this.attributes[name] === value) return this;
		for (const child of this.children) {
			const found = child.findAttributeOrUndefined(name, value);
			if (found !== undefined) return found;
		}
		return undefined;
	}
	empty(): void {
		this.children.splice(0);
		this.text = '';
	}
	setText(text: string): void {
		this.empty();
		this.text = text;
	}
	addClass(name: string): void {
		this.classes.add(name);
	}
	removeClass(name: string): void {
		this.classes.delete(name);
	}

	constructor(options?: { cls?: string; text?: string; attr?: Record<string, string> }) {
		if (options?.cls) this.classes.add(options.cls);
		this.text = options?.text ?? '';
		Object.assign(this.attributes, options?.attr ?? {});
	}
}
