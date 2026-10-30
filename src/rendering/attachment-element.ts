import type { Attachment } from '@/attachments/attachment';
import type { Depot } from '@/depot';

export function renderAttachmentsIn(root: HTMLElement, depot: Depot): void {
	for (const img of elementsIn(root, 'img[src]')) {
		const attachment = depot.attachments.from(img.getAttribute('src') ?? '');
		if (attachment) renderEmbed(img as HTMLImageElement, attachment);
	}

	for (const anchor of elementsIn(root, 'a[href]')) {
		const attachment = depot.attachments.from(anchor.getAttribute('href') ?? '');
		if (attachment) renderLink(anchor as HTMLAnchorElement, attachment);
	}

	for (const element of elementsIn(root, 'iframe[src], embed[src], video[src], audio[src], source[src], object[data]')) {
		const attribute = element instanceof HTMLObjectElement ? 'data' : 'src';
		const attachment = depot.attachments.from(element.getAttribute(attribute) ?? '');
		if (attachment) renderSource(element, attribute, attachment);
	}
}

export function renderSource(element: HTMLElement, attribute: 'src' | 'data', attachment: Attachment): void {
	if (element.dataset.depot) return;

	element.dataset.depot = 'loading';
	element.removeAttribute(attribute);
	element.addClass('depot-loading');

	attachment.resolve().then(
		({ url }) => {
			element.removeClass('depot-loading');
			element.dataset.depot = 'loaded';
			element.setAttribute(attribute, url);

			if (element instanceof HTMLSourceElement) {
				(element.parentElement as HTMLMediaElement | null)?.load?.();
			}
		},
		(error: unknown) => showFailure(element, attachment, error)
	);
}

export function renderEmbed(img: HTMLImageElement, attachment: Attachment): void {
	if (img.dataset.depot) return;

	img.dataset.depot = 'loading';
	img.removeAttribute('src');
	img.addClass('depot-loading');

	attachment.resolve().then(
		({ url }) => {
			img.removeClass('depot-loading');
			img.dataset.depot = 'loaded';

			if (attachment.kind === 'audio' || attachment.kind === 'video') {
				img.replaceWith(createEl(attachment.kind, { attr: { src: url, controls: true }, cls: 'depot-media' }));
			} else if (attachment.kind === 'image') {
				img.src = url;
			} else if (attachment.kind === 'pdf') {
				img.replaceWith(createEl('iframe', { attr: { src: url }, cls: 'depot-pdf' }));
			} else {
				img.replaceWith(createEl('a', { text: attachment.name, href: url, cls: 'depot-link' }));
			}
		},
		(error: unknown) => showFailure(img, attachment, error)
	);
}

export function renderLink(anchor: HTMLAnchorElement, attachment: Attachment): void {
	if (anchor.dataset.depot) return;

	anchor.dataset.depot = 'link';
	anchor.addClass('depot-link');
	anchor.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();

		attachment.resolve().then(
			({ url }) => window.open(url),
			(error: unknown) => showFailure(anchor, attachment, error)
		);
	});
}

function showFailure(element: HTMLElement, attachment: Attachment, error: unknown): void {
	element.dataset.depot = 'failed';
	element.removeClass('depot-loading');

	const message = error instanceof Error ? error.message : String(error);
	const failure = createSpan({ cls: 'depot-failure', text: `${attachment.reference.toString()} — ${message}` });

	if (element instanceof HTMLImageElement) {
		element.replaceWith(failure);
	} else if (!element.nextElementSibling?.hasClass('depot-failure')) {
		element.after(failure);
	}
}

function elementsIn(root: HTMLElement, selector: string): HTMLElement[] {
	const found = Array.from(root.querySelectorAll<HTMLElement>(selector));
	return root.matches(selector) ? [root, ...found] : found;
}
