import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Workspace } from 'obsidian';
import { WorkspaceObserver } from '@/integrations/workspace-observer';

vi.mock('obsidian', () => ({
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
	},
}));

afterEach(() => vi.unstubAllGlobals());

describe('WorkspaceObserver', () => {
	it('renders the root after layout is ready, then observes it and disconnects on unload', () => {
		const fixture = GivenWorkspaceObserver();
		const rendered: unknown[] = [];
		fixture.component.subscribe((element) => rendered.push(element));

		fixture.component.load();
		expect(rendered).toEqual([]);
		expect(fixture.observer).toBeUndefined();

		fixture.layoutReady();
		expect(rendered).toEqual([fixture.root]);
		expect(fixture.observer?.observed).toBe(fixture.root);

		fixture.component.unload();
		expect(fixture.observer?.disconnected).toBe(true);
	});

	it('renders the root at once for a subscriber added after it started', () => {
		const fixture = GivenWorkspaceObserver();
		fixture.component.load();
		fixture.layoutReady();
		const rendered: unknown[] = [];

		fixture.component.subscribe((element) => rendered.push(element));

		expect(rendered).toEqual([fixture.root]);
	});

	it('runs the layout callback immediately when the layout is already ready', () => {
		const fixture = GivenWorkspaceObserver({ ready: true });
		const rendered: unknown[] = [];
		fixture.component.load();

		fixture.component.subscribe((element) => rendered.push(element));

		expect(rendered).toEqual([fixture.root]);
	});

	it('does not scan if layout becomes ready after unload', () => {
		const fixture = GivenWorkspaceObserver();
		const rendered: unknown[] = [];
		fixture.component.subscribe((element) => rendered.push(element));
		fixture.component.load();

		fixture.component.unload();
		fixture.layoutReady();

		expect(rendered).toEqual([]);
		expect(fixture.observer).toBeUndefined();
	});

	it('ignores queued mutations after unload', () => {
		const fixture = GivenWorkspaceObserver();
		const rendered: unknown[] = [];
		fixture.component.subscribe((element) => rendered.push(element));
		fixture.component.load();
		fixture.layoutReady();
		fixture.component.unload();

		fixture.mutate({ type: 'childList', addedNodes: [new FakeElement()] });

		expect(rendered).toEqual([fixture.root]);
	});

	it('stops rendering for a subscriber that unsubscribed', () => {
		const fixture = GivenWorkspaceObserver();
		const rendered: unknown[] = [];
		const unsubscribe = fixture.component.subscribe((element) => rendered.push(element));
		fixture.component.load();
		fixture.layoutReady();
		unsubscribe();

		fixture.mutate({ type: 'childList', addedNodes: [new FakeElement()] });

		expect(rendered).toEqual([fixture.root]);
	});

	it('renders every subscriber for added nodes and for childless attribute targets only', () => {
		const fixture = GivenWorkspaceObserver();
		const first: unknown[] = [];
		const second: unknown[] = [];
		fixture.component.subscribe((element) => first.push(element));
		fixture.component.subscribe((element) => second.push(element));
		fixture.component.load();
		fixture.layoutReady();
		const added = new FakeElement();
		const leaf = new FakeElement();
		const parent = new FakeElement(2);

		fixture.mutate({ type: 'childList', addedNodes: [added] });
		fixture.mutate({ type: 'attributes', target: leaf, addedNodes: [] });
		fixture.mutate({ type: 'attributes', target: parent, addedNodes: [] });

		expect(first).toEqual([fixture.root, added, leaf]);
		expect(second).toEqual([fixture.root, added, leaf]);
		fixture.component.unload();
	});

	it('renders elements from a different window through Obsidian instance checks', () => {
		const fixture = GivenWorkspaceObserver();
		const rendered: unknown[] = [];
		fixture.component.subscribe((element) => rendered.push(element));
		fixture.component.load();
		const foreign = new ForeignElement();
		expect(foreign instanceof FakeElement).toBe(false);

		fixture.layoutReady();
		fixture.mutate({ type: 'childList', addedNodes: [foreign] });

		expect(rendered).toEqual([fixture.root, foreign]);
		fixture.component.unload();
	});
});

function GivenWorkspaceObserver({ ready = false }: { ready?: boolean } = {}) {
	const root = new FakeElement();
	let layoutReady: () => void = () => {};
	let observer: FakeObserver | undefined;
	vi.stubGlobal('HTMLElement', FakeElement);
	vi.stubGlobal(
		'MutationObserver',
		class extends FakeObserver {
			constructor(callback: MutationCallback) {
				super(callback);
				observer = this;
			}
		}
	);
	const workspace = {
		containerEl: root,
		onLayoutReady: (callback: () => void) => {
			if (ready) callback();
			else layoutReady = callback;
		},
	};

	return {
		component: new WorkspaceObserver(workspace as unknown as Workspace),
		root,
		layoutReady: () => layoutReady(),
		get observer() {
			return observer;
		},
		mutate: (record: { type: string; target?: unknown; addedNodes: unknown[] }) => {
			if (!observer) throw new Error('Workspace observer was not started.');
			observer.callback([record as unknown as MutationRecord], observer as unknown as MutationObserver);
		},
	};
}

class FakeObserver {
	observed: Node | undefined;
	disconnected = false;
	constructor(readonly callback: MutationCallback) {}
	observe(target: Node): void {
		this.observed = target;
	}
	takeRecords(): MutationRecord[] {
		return [];
	}
	disconnect(): void {
		this.disconnected = true;
	}
}

class FakeElement {
	constructor(readonly childElementCount = 0) {}
	instanceOf(): boolean {
		return true;
	}
}

class ForeignElement {
	childElementCount = 0;
	instanceOf(constructor: unknown): boolean {
		return constructor === FakeElement;
	}
}
