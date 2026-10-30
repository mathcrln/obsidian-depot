import type DepotPlugin from '@/main';
import { renderAttachmentsIn } from './attachment-element';
import { renderBasesCoversIn } from './bases-covers';

export function registerLivePreview(plugin: DepotPlugin): void {
	const render = (element: HTMLElement) => {
		renderAttachmentsIn(element, plugin.depot);
		renderBasesCoversIn(element, plugin);
	};

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (
				mutation.type === 'attributes' &&
				mutation.target instanceof HTMLElement &&
				mutation.target.childElementCount === 0
			) {
				render(mutation.target);
			}

			for (const node of Array.from(mutation.addedNodes)) {
				if (node instanceof HTMLElement) render(node);
			}
		}
	});

	plugin.app.workspace.onLayoutReady(() => {
		const root = plugin.app.workspace.containerEl;

		render(root);
		observer.observe(root, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['src', 'href', 'data', 'style'],
		});
	});

	plugin.register(() => observer.disconnect());
}
