import { afterEach, expect, it, vi } from 'vitest';
import type { Depot } from '@/depot';
import type { LibraryItem } from '@/library/library-item';
import { LibraryGrid } from '@/ui/library/library-tile';

vi.mock('obsidian', () => ({
	Component: class Component {
		children: Array<{ load: () => void; unload: () => void }> = [];
		cleanups: Array<() => void> = [];
		loaded = false;
		addChild<T extends { load: () => void; unload: () => void }>(child: T): T {
			this.children.push(child);
			if (this.loaded) child.load();
			return child;
		}
		removeChild<T extends { unload: () => void }>(child: T): T {
			const component = child as unknown as { load: () => void; unload: () => void };
			this.children = this.children.filter((candidate) => candidate !== component);
			child.unload();
			return child;
		}
		load(): void {
			this.loaded = true;
		}
		unload(): void {
			this.cleanups.splice(0).forEach((cleanup) => cleanup());
			this.children.forEach((child) => child.unload());
			(this as unknown as { onunload?: () => void }).onunload?.();
			this.loaded = false;
		}
		register(cleanup: () => void): void {
			this.cleanups.push(cleanup);
		}
		registerDomEvent(element: FakeElement, type: string, callback: EventListener): void {
			element.addEventListener(type, callback);
			this.register(() => element.removeEventListener(type, callback));
		}
	},
	setIcon: () => {},
}));
afterEach(() => vi.unstubAllGlobals());

it('owns tile listeners and the render observer for the current grid', () => {
	const observers: FakeObserver[] = [];
	vi.stubGlobal(
		'IntersectionObserver',
		class extends FakeObserver {
			constructor(callback: IntersectionObserverCallback) {
				super(callback);
				observers.push(this);
			}
		}
	);
	const parent = new FakeElement();
	const selected: string[] = [];
	const opened: string[] = [];
	const item: LibraryItem = { profile: 'personal', key: 'files/one.pdf', kind: 'pdf', status: 'used', notes: [] };
	const grid = new LibraryGrid(
		parent as unknown as HTMLElement,
		{} as unknown as Depot,
		(value) => selected.push(value.key),
		(value) => opened.push(value.key)
	);
	grid.load();
	grid.render([{ id: 'undated', label: 'Unknown date', items: [item] }], undefined);
	const firstTile = parent.findClass('depot-library-tile');
	firstTile.dispatch('click');
	grid.select(item);
	grid.render([{ id: 'undated', label: 'Unknown date', items: [item] }], undefined);
	firstTile.dispatch('dblclick');

	expect(selected).toEqual(['files/one.pdf']);
	expect(opened).toEqual([]);
	expect(observers[0]?.disconnected).toBe(true);
	expect(observers).toHaveLength(2);

	grid.unload();
	expect(observers[1]?.disconnected).toBe(true);
});

class FakeObserver {
	disconnected = false;
	constructor(readonly callback: IntersectionObserverCallback) {}
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {
		this.disconnected = true;
	}
}

class FakeElement {
	readonly children: FakeElement[] = [];
	readonly listeners = new Map<string, Set<EventListener>>();
	readonly classes = new Set<string>();
	textContent = '';

	createEl(_tag: string, options?: { cls?: string; text?: string }): FakeElement {
		return this.append(new FakeElement(options?.cls, options?.text));
	}
	createDiv(options?: { cls?: string; text?: string }): FakeElement {
		return this.append(new FakeElement(options?.cls, options?.text));
	}
	createSpan(options?: { cls?: string; text?: string }): FakeElement {
		return this.append(new FakeElement(options?.cls, options?.text));
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
	findClass(name: string): FakeElement {
		if (this.classes.has(name)) return this;
		for (const child of this.children) {
			const found = child.findClassOrUndefined(name);
			if (found !== undefined) return found;
		}
		throw new Error(`Could not find ${name}.`);
	}
	empty(): void {
		this.children.splice(0);
	}
	findClassOrUndefined(name: string): FakeElement | undefined {
		if (this.classes.has(name)) return this;
		for (const child of this.children) {
			const found = child.findClassOrUndefined(name);
			if (found !== undefined) return found;
		}
		return undefined;
	}
	private append(child: FakeElement): FakeElement {
		this.children.push(child);
		return child;
	}
	constructor(className?: string, text?: string) {
		if (className) this.classes.add(className);
		this.textContent = text ?? '';
	}
}
