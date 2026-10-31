import { expect, it, onTestFinished, vi } from 'vitest';
import type { Depot } from '@/depot';
import type { LibraryItem } from '@/library/library-item';
import { LibraryGrid } from '@/ui/library/library-tile';
import { find, findAll, WhenClicking } from '../../support/setup';

it('selects a tile on click and opens it on double click', () => {
	const fixture = GivenGrid(GivenItem('files/one.pdf'));

	WhenClicking(find(fixture.parent, '.depot-library-tile'));
	WhenDoubleClicking(find(fixture.parent, '.depot-library-tile'));

	expect(fixture.selected).toEqual(['files/one.pdf']);
	expect(fixture.opened).toEqual(['files/one.pdf']);
});

it('stops reacting to tiles from a previous render', () => {
	const fixture = GivenGrid(GivenItem('files/one.pdf'));
	const staleTile = find(fixture.parent, '.depot-library-tile');
	WhenRerendering(fixture, GivenItem('files/one.pdf'));

	WhenClicking(staleTile);
	WhenDoubleClicking(staleTile);

	expect(fixture.selected).toEqual([]);
	expect(fixture.opened).toEqual([]);
	expect(findAll(fixture.parent, '.depot-library-tile')).toHaveLength(1);
});

it('marks only the selected tile', () => {
	const one = GivenItem('one.pdf');
	const two = GivenItem('two.pdf');
	const fixture = GivenGrid(one, two);

	fixture.grid.select(two);

	expect(findAll(fixture.parent, '.depot-library-tile.is-selected').map((tile) => tile.title)).toEqual([
		expect.stringContaining('two.pdf'),
	]);
});

it('disconnects the image observer of each render and on unload', () => {
	const observers = GivenIntersectionObservers();
	const fixture = GivenGrid(GivenItem('one.pdf'));
	WhenRerendering(fixture, GivenItem('one.pdf'));

	fixture.grid.unload();

	expect(observers.map((observer) => observer.disconnected)).toEqual([true, true]);
});

function GivenGrid(...items: LibraryItem[]) {
	const parent = document.body.createDiv();
	const selected: string[] = [];
	const opened: string[] = [];
	const grid = new LibraryGrid(
		parent,
		{} as unknown as Depot,
		(item) => selected.push(item.key),
		(item) => opened.push(item.key)
	);
	grid.load();
	onTestFinished(() => grid.unload());
	grid.render([GivenGroup(...items)], undefined);

	return { grid, parent, selected, opened };
}

function GivenIntersectionObservers(): FakeIntersectionObserver[] {
	const observers: FakeIntersectionObserver[] = [];
	vi.stubGlobal(
		'IntersectionObserver',
		class extends FakeIntersectionObserver {
			constructor() {
				super();
				observers.push(this);
			}
		}
	);

	return observers;
}

function GivenItem(key: string): LibraryItem {
	return { profile: 'personal', key, kind: 'pdf', status: 'used', notes: [] };
}

function GivenGroup(...items: LibraryItem[]) {
	return { id: 'undated', label: 'Unknown date', items };
}

function WhenRerendering(fixture: ReturnType<typeof GivenGrid>, ...items: LibraryItem[]): void {
	fixture.grid.render([GivenGroup(...items)], undefined);
}

function WhenDoubleClicking(element: Element): void {
	element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
}

class FakeIntersectionObserver {
	disconnected = false;
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {
		this.disconnected = true;
	}
}
