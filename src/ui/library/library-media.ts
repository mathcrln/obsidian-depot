import { setIcon, type Component } from 'obsidian';
import type { AttachmentKind } from '@/attachments/attachment-kind';
import type { Depot } from '@/depot';
import { extensionLabel } from '@/ui/library/library-format';
import type { LibraryItem } from '@/library/library-item';
import { AttachmentReference } from '@/references/attachment-reference';

const ICONS: Record<AttachmentKind, string> = {
	image: 'image',
	pdf: 'file-text',
	audio: 'music',
	video: 'video',
	other: 'file',
};

export function iconFor(kind: AttachmentKind): string {
	return ICONS[kind];
}

export function hasThumbnail(item: LibraryItem): boolean {
	return item.kind === 'image' && item.status !== 'broken';
}

export function renderPlaceholder(parent: HTMLElement, item: LibraryItem): HTMLElement {
	const icon = parent.createDiv({ cls: 'depot-library-icon' });
	setIcon(icon.createSpan(), item.status === 'broken' ? 'alert-triangle' : iconFor(item.kind));
	const label = extensionLabel(item.key);
	if (label) icon.createSpan({ cls: 'depot-library-ext', text: label });

	return icon;
}

export function loadImage(scope: Component, depot: Depot, item: LibraryItem, img: HTMLImageElement): void {
	const frame = img.parentElement;
	let active = true;
	scope.register(() => {
		active = false;
	});
	frame?.addClass('depot-library-loading');

	scope.registerDomEvent(
		img,
		'load',
		() => {
			img.addClass('is-loaded');
			frame?.removeClass('depot-library-loading');
		},
		{ once: true }
	);

	depot.attachments
		.of(AttachmentReference.to(item.profile, item.key))
		.resolve()
		.then(
			({ url }) => {
				if (!active) return;
				img.src = url;
			},
			() => {
				if (!active) return;
				frame?.removeClass('depot-library-loading');
				img.replaceWith(createDiv({ cls: 'depot-library-icon', text: 'Unavailable' }));
			}
		);
}
