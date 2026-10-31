import { afterEach, vi } from 'vitest';
import { Setting as ObsidianSetting, type SettingDefinitionItem, type SettingGroup } from 'obsidian';
import { notices, Platform } from './obsidian';

if (typeof window !== 'undefined') GivenObsidianDom(window);

afterEach(() => {
	notices.splice(0);
	Platform.isMobile = false;
	if (typeof document !== 'undefined') document.body.empty();
	vi.unstubAllGlobals();
});

export function WhenTyping(input: HTMLInputElement, value: string): void {
	input.value = value;
	input.dispatchEvent(new Event('input'));
}

export function WhenChoosing(select: HTMLSelectElement, value: string): void {
	select.value = value;
	select.dispatchEvent(new Event('change'));
}

export function WhenClicking(element: Element): void {
	element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

export function find<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
	const found = root.querySelector<T>(selector);
	if (found === null) throw new Error(`Could not find ${selector}.`);
	return found;
}

export function findAll<T extends Element = HTMLElement>(root: ParentNode, selector: string): T[] {
	return Array.from(root.querySelectorAll<T>(selector));
}

export function buttonNamed(root: ParentNode, text: string): HTMLButtonElement {
	const found = findAll<HTMLButtonElement>(root, 'button').find((candidate) => candidate.textContent?.trim() === text);
	if (found === undefined) throw new Error(`Could not find the "${text}" button.`);
	return found;
}

export function GivenSetting(group: SettingDefinitionItem, name: string): ObsidianSetting {
	const items = 'type' in group && group.type === 'group' ? (group.items ?? []) : [group];
	const definition = items.find((item) => 'name' in item && item.name === name);

	if (definition === undefined || !('render' in definition) || definition.render === undefined) {
		throw new Error(`The "${name}" setting has no custom render.`);
	}

	const setting = new ObsidianSetting(document.body.createDiv());
	definition.render(setting, {} as SettingGroup);

	return setting;
}

type Attributes = Record<string, string | number | boolean | null>;

interface ElementInfo {
	cls?: string | string[];
	text?: string | DocumentFragment;
	attr?: Attributes;
	title?: string;
	value?: string;
	type?: string;
	href?: string;
	placeholder?: string;
	parent?: Node;
	prepend?: boolean;
}

type Info = ElementInfo | string | undefined;
type Callback<T> = ((element: T) => void) | undefined;

export class FakeWorkspaceObserver {
	private renderer: ((element: HTMLElement) => void) | undefined;

	get subscribers(): number {
		return this.renderer ? 1 : 0;
	}

	subscribe(render: (element: HTMLElement) => void): () => void {
		this.renderer = render;
		return () => {
			this.renderer = undefined;
		};
	}

	render(element: HTMLElement): void {
		this.renderer?.(element);
	}
}

function GivenObsidianDom(window: Window & typeof globalThis): void {
	const { Node, Element, HTMLElement } = window;
	const document = window.document;

	Object.assign(Node.prototype, {
		createEl<K extends keyof HTMLElementTagNameMap>(
			this: Node,
			tag: K,
			info?: Info,
			callback?: Callback<HTMLElementTagNameMap[K]>
		) {
			return build(this.ownerDocument ?? document, tag, withParent(info, this), callback);
		},
		createDiv(this: Node, info?: Info, callback?: Callback<HTMLDivElement>) {
			return build(this.ownerDocument ?? document, 'div', withParent(info, this), callback);
		},
		createSpan(this: Node, info?: Info, callback?: Callback<HTMLSpanElement>) {
			return build(this.ownerDocument ?? document, 'span', withParent(info, this), callback);
		},
		empty(this: Node) {
			while (this.firstChild) this.removeChild(this.firstChild);
		},
		detach(this: Node) {
			this.parentNode?.removeChild(this);
		},
		appendText(this: Node, text: string) {
			this.appendChild((this.ownerDocument ?? document).createTextNode(text));
		},
		instanceOf(this: Node, type: { name: string; prototype: unknown }) {
			if (this instanceof (type as unknown as typeof Node)) return true;

			for (let prototype = Object.getPrototypeOf(this); prototype; prototype = Object.getPrototypeOf(prototype)) {
				if ((prototype as { constructor?: { name?: string } }).constructor?.name === type.name) return true;
			}

			return false;
		},
	});

	Object.assign(Element.prototype, {
		getText(this: Element) {
			return this.textContent ?? '';
		},
		setText(this: Element, text: string | DocumentFragment) {
			this.textContent = '';
			if (typeof text === 'string') this.textContent = text;
			else this.appendChild(text);
		},
		addClass(this: Element, ...classes: string[]) {
			this.classList.add(...classes.filter(Boolean));
		},
		addClasses(this: Element, classes: string[]) {
			this.classList.add(...classes.filter(Boolean));
		},
		removeClass(this: Element, ...classes: string[]) {
			this.classList.remove(...classes);
		},
		removeClasses(this: Element, classes: string[]) {
			this.classList.remove(...classes);
		},
		toggleClass(this: Element, classes: string | string[], value: boolean) {
			for (const name of Array.isArray(classes) ? classes : [classes]) this.classList.toggle(name, value);
		},
		hasClass(this: Element, name: string) {
			return this.classList.contains(name);
		},
		setAttr(this: Element, name: string, value: string | number | boolean | null) {
			if (value === null) this.removeAttribute(name);
			else this.setAttribute(name, String(value));
		},
		setAttrs(this: Element, attributes: Attributes) {
			for (const [name, value] of Object.entries(attributes))
				(this as unknown as { setAttr: (n: string, v: unknown) => void }).setAttr(name, value);
		},
		getAttr(this: Element, name: string) {
			return this.getAttribute(name);
		},
	});

	Object.assign(HTMLElement.prototype, {
		show(this: HTMLElement) {
			this.style.removeProperty('display');
		},
		hide(this: HTMLElement) {
			this.style.display = 'none';
		},
		toggle(this: HTMLElement, show: boolean) {
			if (show) this.style.removeProperty('display');
			else this.style.display = 'none';
		},
		isShown(this: HTMLElement) {
			return this.style.display !== 'none';
		},
		setCssProps(this: HTMLElement, props: Record<string, string>) {
			for (const [name, value] of Object.entries(props)) this.style.setProperty(name, value);
		},
		find(this: HTMLElement, selector: string) {
			return this.querySelector(selector);
		},
		findAll(this: HTMLElement, selector: string) {
			return Array.from(this.querySelectorAll(selector));
		},
	});

	Object.assign(window, {
		createEl: (tag: string, info?: Info, callback?: Callback<HTMLElement>) => build(document, tag, info, callback),
		createDiv: (info?: Info, callback?: Callback<HTMLElement>) => build(document, 'div', info, callback),
		createSpan: (info?: Info, callback?: Callback<HTMLElement>) => build(document, 'span', info, callback),
		createFragment: (callback?: Callback<DocumentFragment>) => {
			const fragment = document.createDocumentFragment();
			callback?.(fragment);
			return fragment;
		},
	});
}

function withParent(info: Info, parent: Node): ElementInfo {
	return { ...(typeof info === 'string' ? { cls: info } : (info ?? {})), parent };
}

function build<T extends HTMLElement>(document: Document, tag: string, info: Info, callback: Callback<T>): T {
	const options: ElementInfo = typeof info === 'string' ? { cls: info } : (info ?? {});
	const element = document.createElement(tag) as T;

	if (options.cls !== undefined) element.className = Array.isArray(options.cls) ? options.cls.join(' ') : options.cls;
	if (options.text !== undefined) {
		if (typeof options.text === 'string') element.textContent = options.text;
		else element.appendChild(options.text);
	}
	for (const [name, value] of Object.entries(options.attr ?? {})) {
		if (value !== null && value !== false) element.setAttribute(name, value === true ? '' : String(value));
	}
	if (options.title !== undefined) element.title = options.title;
	if (options.value !== undefined) (element as unknown as { value: string }).value = options.value;
	if (options.type !== undefined) element.setAttribute('type', options.type);
	if (options.href !== undefined) element.setAttribute('href', options.href);
	if (options.placeholder !== undefined) element.setAttribute('placeholder', options.placeholder);
	if (options.parent !== undefined) {
		if (options.prepend) options.parent.insertBefore(element, options.parent.firstChild);
		else options.parent.appendChild(element);
	}

	callback?.(element);

	return element;
}
