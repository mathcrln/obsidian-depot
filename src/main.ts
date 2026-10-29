import { Plugin } from 'obsidian';
import { registerCheckConnectionCommand } from '@/commands/check-connection';
import { registerUploadCommand } from '@/commands/upload-attachment';
import { Depot } from '@/depot';
import { registerPasteAndDrop } from '@/editor/paste-and-drop';
import { registerLivePreview } from '@/rendering/live-preview';
import { registerReadingView } from '@/rendering/reading-view';
import { DepotSettingTab } from '@/settings/setting-tab';

export default class DepotPlugin extends Plugin {
	depot!: Depot;

	async onload() {
		this.depot = await Depot.boot(this);

		this.addSettingTab(new DepotSettingTab(this));
		registerUploadCommand(this);
		registerCheckConnectionCommand(this);
		registerPasteAndDrop(this);
		registerReadingView(this);
		registerLivePreview(this);
	}

	onunload() {
		this.depot.release();
	}
}
