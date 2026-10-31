import { expect, it, onTestFinished, vi } from 'vitest';
import { Window } from 'happy-dom';
import type { Workspace } from 'obsidian';
import { WorkspaceObserver } from '@/integrations/workspace-observer';

it('renders nothing before the layout is ready', () => {
	const fixture = GivenLoadedWorkspaceObserver();

	const rendered = WhenSubscribing(fixture);

	expect(rendered).toEqual([]);
});

it('renders the root once the layout is ready', () => {
	const fixture = GivenLoadedWorkspaceObserver();
	const rendered = WhenSubscribing(fixture);

	WhenLayoutIsReady(fixture);

	expect(rendered).toEqual([fixture.root]);
});

it('renders the root at once for a subscriber added after it started', () => {
	const fixture = GivenStartedWorkspaceObserver();

	const rendered = WhenSubscribing(fixture);

	expect(rendered).toEqual([fixture.root]);
});

it('starts at once when the layout is already ready', () => {
	const fixture = GivenLoadedWorkspaceObserver({ ready: true });

	const rendered = WhenSubscribing(fixture);

	expect(rendered).toEqual([fixture.root]);
});

it('renders elements added to the workspace for every subscriber', async () => {
	const fixture = GivenStartedWorkspaceObserver();
	const first = WhenSubscribing(fixture);
	const second = WhenSubscribing(fixture);

	const added = WhenAddingElement(fixture);

	await vi.waitFor(() => expect(first).toEqual([fixture.root, added]));
	expect(second).toEqual([fixture.root, added]);
});

it('renders a childless element whose source changes', async () => {
	const fixture = GivenStartedWorkspaceObserver();
	const rendered = WhenSubscribing(fixture);

	WhenChangingAttribute(fixture.image, 'src', 'personal://photo.png');

	await vi.waitFor(() => expect(rendered).toEqual([fixture.root, fixture.image]));
});

it('ignores attribute changes on containers', async () => {
	const fixture = GivenStartedWorkspaceObserver();
	const rendered = WhenSubscribing(fixture);

	WhenChangingAttribute(fixture.container, 'style', 'color: red');
	WhenChangingAttribute(fixture.image, 'src', 'personal://photo.png');

	await vi.waitFor(() => expect(rendered).toEqual([fixture.root, fixture.image]));
});

it('renders elements created in another window', async () => {
	const fixture = GivenStartedWorkspaceObserver();
	const rendered = WhenSubscribing(fixture);

	const foreign = WhenAddingElementFromAnotherWindow(fixture);

	await vi.waitFor(() => expect(rendered).toContain(foreign));
});

it('stops rendering for a subscriber that unsubscribed', async () => {
	const fixture = GivenStartedWorkspaceObserver();
	const unsubscribed = GivenUnsubscribedSubscriber(fixture);
	const subscribed = WhenSubscribing(fixture);

	const added = WhenAddingElement(fixture);

	await vi.waitFor(() => expect(subscribed).toContain(added));
	expect(unsubscribed).toEqual([fixture.root]);
});

it('stops rendering once unloaded', async () => {
	const fixture = GivenStartedWorkspaceObserver();
	const rendered = WhenSubscribing(fixture);
	fixture.component.unload();

	WhenAddingElement(fixture);
	await new Promise((resolve) => setTimeout(resolve, 0));

	expect(rendered).toEqual([fixture.root]);
});

it('does not start if the layout becomes ready after unload', () => {
	const fixture = GivenLoadedWorkspaceObserver();
	const rendered = WhenSubscribing(fixture);
	fixture.component.unload();

	WhenLayoutIsReady(fixture);

	expect(rendered).toEqual([]);
});

function GivenStartedWorkspaceObserver() {
	const fixture = GivenLoadedWorkspaceObserver();
	WhenLayoutIsReady(fixture);

	return fixture;
}

function GivenLoadedWorkspaceObserver({ ready = false }: { ready?: boolean } = {}) {
	const root = document.body.createDiv({ cls: 'workspace' });
	const container = root.createDiv();
	container.createSpan();
	const image = root.createEl('img');
	let layoutReady: () => void = () => {};
	const workspace = {
		containerEl: root,
		onLayoutReady: (callback: () => void) => {
			if (ready) callback();
			else layoutReady = callback;
		},
	};
	const component = new WorkspaceObserver(workspace as unknown as Workspace);
	component.load();
	onTestFinished(() => component.unload());

	return { component, root, container, image, layoutReady: () => layoutReady() };
}

function GivenUnsubscribedSubscriber(fixture: ReturnType<typeof GivenLoadedWorkspaceObserver>): unknown[] {
	const rendered: unknown[] = [];
	const unsubscribe = fixture.component.subscribe((element) => rendered.push(element));
	unsubscribe();

	return rendered;
}

function WhenLayoutIsReady(fixture: ReturnType<typeof GivenLoadedWorkspaceObserver>): void {
	fixture.layoutReady();
}

function WhenSubscribing(fixture: ReturnType<typeof GivenLoadedWorkspaceObserver>): unknown[] {
	const rendered: unknown[] = [];
	fixture.component.subscribe((element) => rendered.push(element));

	return rendered;
}

function WhenAddingElement(fixture: ReturnType<typeof GivenLoadedWorkspaceObserver>): HTMLElement {
	return fixture.root.createDiv();
}

function WhenAddingElementFromAnotherWindow(fixture: ReturnType<typeof GivenLoadedWorkspaceObserver>): HTMLElement {
	const foreign = new Window().document.createElement('div') as unknown as HTMLElement;
	fixture.root.appendChild(foreign);

	return foreign;
}

function WhenChangingAttribute(element: HTMLElement, name: string, value: string): void {
	element.setAttribute(name, value);
}
