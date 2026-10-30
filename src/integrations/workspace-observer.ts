import { Component, type Workspace } from 'obsidian';

type Render = (element: HTMLElement) => void;

export class WorkspaceObserver extends Component {
	private readonly subscribers = new Set<Render>();
	private observer: MutationObserver | undefined;
	private root: HTMLElement | undefined;
	private running = false;

	constructor(private readonly workspace: Workspace) {
		super();
	}

	onload(): void {
		this.running = true;
		this.workspace.onLayoutReady(() => this.start());
	}

	onunload(): void {
		this.running = false;
		this.observer?.disconnect();
		this.observer = undefined;
		this.root = undefined;
		this.subscribers.clear();
	}

	subscribe(render: Render): () => void {
		this.subscribers.add(render);
		if (this.root) render(this.root);

		return () => {
			this.subscribers.delete(render);
		};
	}

	private start(): void {
		if (!this.running) return;

		const root = this.workspace.containerEl;
		this.root = root;
		this.renderAll(root);
		this.observer = new MutationObserver((mutations) => this.handle(mutations));
		this.observer.observe(root, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['src', 'href', 'data', 'style'],
		});
	}

	private handle(mutations: MutationRecord[]): void {
		for (const mutation of mutations) {
			if (
				mutation.type === 'attributes' &&
				mutation.target.instanceOf(HTMLElement) &&
				mutation.target.childElementCount === 0
			) {
				this.renderAll(mutation.target);
			}

			for (const node of Array.from(mutation.addedNodes)) {
				if (node.instanceOf(HTMLElement)) this.renderAll(node);
			}
		}
	}

	private renderAll(element: HTMLElement): void {
		for (const render of [...this.subscribers]) render(element);
	}
}
