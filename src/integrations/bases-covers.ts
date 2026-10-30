import { Component, type Plugin } from 'obsidian';
import type { Depot } from '@/depot';
import type { WorkspaceObserver } from '@/integrations/workspace-observer';
import { BasesCoverRenderer } from '@/ui/bases/cover';

export class BasesCovers extends Component {
	constructor(
		private readonly plugin: Plugin,
		private readonly depot: Depot,
		private readonly observer: WorkspaceObserver
	) {
		super();
	}

	onload(): void {
		let active = true;
		const renderer = new BasesCoverRenderer(this.plugin.app, this.depot, () => active);

		this.register(() => {
			active = false;
			renderer.stop();
		});
		this.register(this.observer.subscribe((element) => renderer.render(element)));
	}
}
