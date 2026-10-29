import type DepotPlugin from '@/main';
import { renderAttachmentsIn } from './attachment-element';

export function registerReadingView(plugin: DepotPlugin): void {
	plugin.registerMarkdownPostProcessor((el) => {
		renderAttachmentsIn(el, plugin.depot);
	});
}
