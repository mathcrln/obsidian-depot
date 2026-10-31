import { describe, expect, it, onTestFinished, vi } from 'vitest';
import type { Plugin, TFile } from 'obsidian';
import { Notes } from '@/ui/notes/notes';
import { NoteAttachments } from '@/integrations/note-attachments';
import type { Depot } from '@/depot';
import type { WorkspaceObserver } from '@/integrations/workspace-observer';
import { FakeWorkspaceObserver } from '../support/setup';
import type { UploadFile } from '@/actions/upload-attachments';
import type { InsertableAttachment } from '@/ui/notes/note-editor';
import type { UploadableFile } from '@/storages/profile';
import { AttachmentReference } from '@/references/attachment-reference';
import { Events, notices } from '../support/obsidian';

const EDITOR_EVENTS = [
	{ name: 'paste', event: 'editor-paste', transfer: 'clipboardData' },
	{ name: 'drop', event: 'editor-drop', transfer: 'dataTransfer' },
] as const;

describe('NoteAttachments', () => {
	it('does not listen before it is loaded', () => {
		const fixture = GivenNoteAttachments();

		expect(fixture.workspace.listeners()).toBe(0);
		expect(fixture.postProcessors).toHaveLength(0);
		expect(fixture.observer.subscribers).toBe(0);
	});

	it.each(EDITOR_EVENTS)('uploads a $name into the current note', async ({ event, transfer }) => {
		const fixture = GivenLoadedNoteAttachments();

		const editorEvent = WhenEditorEvent(fixture, event, transfer, [GivenFile(`${event}.png`)]);

		expect(editorEvent.defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(fixture.inserted).toEqual([`s3://${event}.png`]));
		expect(fixture.uploads).toEqual([`${event}.png:My note`]);
		expect(notices).toEqual([{ text: `Uploading ${event}.png…`, hidden: true }]);
	});

	it.each(EDITOR_EVENTS)('leaves an already handled $name alone', ({ event, transfer }) => {
		const fixture = GivenLoadedNoteAttachments();

		WhenEditorEvent(fixture, event, transfer, [GivenFile('image.png')], { handled: true });

		expect(fixture.uploads).toEqual([]);
	});

	it.each(EDITOR_EVENTS)('ignores a $name with no files', ({ event, transfer }) => {
		const fixture = GivenLoadedNoteAttachments();

		const editorEvent = WhenEditorEvent(fixture, event, transfer, []);

		expect(editorEvent.defaultPrevented).toBe(false);
		expect(fixture.uploads).toEqual([]);
	});

	it('stops handling pastes once unloaded', () => {
		const fixture = GivenUnloadedNoteAttachments();

		WhenEditorEvent(fixture, 'editor-paste', 'clipboardData', [GivenFile('late.png')]);

		expect(fixture.uploads).toEqual([]);
	});

	it('renders attachments in live preview elements reported by the workspace observer', async () => {
		const fixture = GivenLoadedNoteAttachments();
		const image = GivenEmbed('personal://photo.png');

		WhenLivePreviewShows(fixture, image);

		await vi.waitFor(() => expect(image.getAttribute('src')).toBe('blob:personal://photo.png'));
	});

	it('renders attachments in reading view', async () => {
		const fixture = GivenLoadedNoteAttachments();
		const image = GivenEmbed('personal://photo.png');

		WhenReadingViewShows(fixture, image);

		await vi.waitFor(() => expect(image.getAttribute('src')).toBe('blob:personal://photo.png'));
	});

	it('leaves links of unknown profiles alone', () => {
		const fixture = GivenLoadedNoteAttachments();
		const image = GivenEmbed('https://example.com/photo.png');

		WhenReadingViewShows(fixture, image);

		expect(image.getAttribute('src')).toBe('https://example.com/photo.png');
		expect(image.dataset.depot).toBeUndefined();
	});

	it('stops listening to the workspace observer when unloaded', () => {
		const fixture = GivenLoadedNoteAttachments();

		fixture.component.unload();

		expect(fixture.observer.subscribers).toBe(0);
	});
});

function GivenLoadedNoteAttachments() {
	const fixture = GivenNoteAttachments();
	fixture.component.load();

	return fixture;
}

function GivenUnloadedNoteAttachments() {
	const fixture = GivenLoadedNoteAttachments();
	fixture.component.unload();

	return fixture;
}

function GivenNoteAttachments() {
	const uploads: string[] = [];
	const inserted: string[] = [];
	const workspace = new Events();
	const postProcessors: Array<(element: HTMLElement) => void> = [];
	const plugin = {
		app: { workspace },
		registerMarkdownPostProcessor: (processor: (element: HTMLElement) => void) => postProcessors.push(processor),
	};
	const observer = new FakeWorkspaceObserver();
	const component = new NoteAttachments(
		plugin as unknown as Plugin,
		GivenDepot(GivenUpload(uploads)),
		observer as unknown as WorkspaceObserver
	);
	const editor = { replaceSelection: (markdown: string) => inserted.push(markdown) };
	onTestFinished(() => component.unload());

	return { component, workspace, postProcessors, observer, uploads, inserted, editor };
}

function GivenDepot(upload: UploadFile<InsertableAttachment>): Depot {
	const attachments = {
		from(src: string) {
			const reference = AttachmentReference.tryParse(src);
			if (reference?.profile.value !== 'personal') return undefined;

			return {
				reference,
				kind: 'image',
				name: reference.key,
				resolve: async () => ({ url: `blob:${reference.toString()}`, contentType: 'image/png' }),
			};
		},
	};

	return { notes: new Notes(upload), attachments } as unknown as Depot;
}

function GivenUpload(uploads: string[]): UploadFile<InsertableAttachment> {
	return async (file, context) => {
		uploads.push(`${file.name}:${context.note}`);
		return { attachment: { markdown: () => `s3://${file.name}` }, reused: false };
	};
}

function GivenEmbed(src: string): HTMLImageElement {
	return document.body.createDiv().createEl('img', { attr: { src } });
}

function GivenFile(name: string): UploadableFile {
	return { name, arrayBuffer: async () => new ArrayBuffer(0) };
}

function WhenLivePreviewShows(fixture: ReturnType<typeof GivenNoteAttachments>, element: HTMLElement): void {
	fixture.observer.render(element.parentElement as HTMLElement);
}

function WhenReadingViewShows(fixture: ReturnType<typeof GivenNoteAttachments>, element: HTMLElement): void {
	for (const processor of fixture.postProcessors) processor(element.parentElement as HTMLElement);
}

function WhenEditorEvent(
	fixture: ReturnType<typeof GivenNoteAttachments>,
	name: 'editor-paste' | 'editor-drop',
	transfer: 'clipboardData' | 'dataTransfer',
	files: UploadableFile[],
	{ handled = false }: { handled?: boolean } = {}
): Event {
	const event = new Event(name, { cancelable: true });
	Object.defineProperty(event, transfer, { value: { files } });
	if (handled) event.preventDefault();
	const note = { basename: 'My note' } as Pick<TFile, 'basename'>;

	fixture.workspace.trigger(name, event, fixture.editor, { file: note });

	return event;
}
