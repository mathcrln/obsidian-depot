export interface ShownNotice {
	text: string;
	hidden: boolean;
}

export const notices: ShownNotice[] = [];

export const Platform = { isMobile: false, isDesktop: true, isDesktopApp: true, isMobileApp: false };

export interface EventRef {
	events: Events;
	name: string;
	callback: (...args: unknown[]) => unknown;
}

export class Events {
	private readonly refs: EventRef[] = [];

	on(name: string, callback: (...args: never[]) => unknown): EventRef {
		const ref = { events: this, name, callback: callback as (...args: unknown[]) => unknown };
		this.refs.push(ref);
		return ref;
	}

	offref(ref: EventRef): void {
		this.refs.splice(this.refs.indexOf(ref) >>> 0, 1);
	}

	trigger(name: string, ...args: unknown[]): void {
		for (const ref of this.refs.filter((candidate) => candidate.name === name)) ref.callback(...args);
	}

	listeners(name?: string): number {
		return this.refs.filter((ref) => name === undefined || ref.name === name).length;
	}
}

export class Component {
	private loaded = false;
	private readonly children: Component[] = [];
	private readonly cleanups: Array<() => void> = [];

	load(): void {
		if (this.loaded) return;
		this.loaded = true;
		this.onload();
		for (const child of [...this.children]) child.load();
	}

	unload(): void {
		if (!this.loaded) return;
		this.loaded = false;
		for (const child of this.children.splice(0)) child.unload();
		this.onunload();
		for (const cleanup of this.cleanups.splice(0)) cleanup();
	}

	onload(): void {}

	onunload(): void {}

	addChild<T extends Component>(child: T): T {
		this.children.push(child);
		if (this.loaded) child.load();
		return child;
	}

	removeChild<T extends Component>(child: T): T {
		const index = this.children.indexOf(child);
		if (index !== -1) this.children.splice(index, 1);
		child.unload();
		return child;
	}

	register(cleanup: () => void): void {
		this.cleanups.push(cleanup);
	}

	registerEvent(ref: EventRef): void {
		this.register(() => ref.events.offref(ref));
	}

	registerDomEvent(target: EventTarget, type: string, listener: EventListener, options?: AddEventListenerOptions): void {
		target.addEventListener(type, listener, options);
		this.register(() => target.removeEventListener(type, listener, options));
	}

	registerInterval(id: number): number {
		this.register(() => window.clearInterval(id));
		return id;
	}
}

export interface KeymapHandler {
	modifiers: string[];
	key: string;
	callback: (event: KeyboardEvent) => unknown;
}

export class Scope {
	private readonly handlers: KeymapHandler[] = [];

	register(modifiers: string[] | null, key: string, callback: (event: KeyboardEvent) => unknown): KeymapHandler {
		const handler = { modifiers: modifiers ?? [], key, callback };
		this.handlers.push(handler);
		return handler;
	}

	unregister(handler: KeymapHandler): void {
		const index = this.handlers.indexOf(handler);
		if (index !== -1) this.handlers.splice(index, 1);
	}

	press(key: string): void {
		for (const handler of this.handlers.filter((candidate) => candidate.key === key)) {
			handler.callback(new KeyboardEvent('keydown', { key }));
		}
	}
}

export class Modal {
	readonly containerEl = createDiv({ cls: 'modal-container' });
	readonly modalEl = this.containerEl.createDiv({ cls: 'modal' });
	readonly titleEl = this.modalEl.createDiv({ cls: 'modal-title' });
	readonly contentEl = this.modalEl.createDiv({ cls: 'modal-content' });
	readonly scope = new Scope();

	constructor(readonly app: unknown) {}

	open(): void {
		document.body.appendChild(this.containerEl);
		this.onOpen();
	}

	close(): void {
		this.containerEl.detach();
		this.onClose();
	}

	setTitle(title: string): this {
		this.titleEl.setText(title);
		return this;
	}

	onOpen(): void | Promise<void> {}

	onClose(): void {}
}

export class ItemView extends Component {
	readonly app: unknown;
	readonly containerEl = createDiv({ cls: 'workspace-leaf-content' });
	readonly contentEl = this.containerEl.createDiv({ cls: 'view-content' });

	constructor(readonly leaf: { app?: unknown }) {
		super();
		this.app = leaf.app;
	}

	async onOpen(): Promise<void> {}

	async onClose(): Promise<void> {}
}

export class MarkdownView extends ItemView {}

export class PluginSettingTab {
	readonly containerEl = createDiv();

	constructor(
		readonly app: unknown,
		readonly plugin: unknown
	) {}

	display(): void {}

	hide(): void {}

	update(): void {}
}

export class TFile {
	path = '';
	name = '';
	basename = '';
	extension = '';
	stat = { ctime: 0, mtime: 0, size: 0 };
	parent: unknown = null;
}

export class Notice {
	private readonly state: ShownNotice;

	constructor(message: string | DocumentFragment, _duration?: number) {
		this.state = { text: typeof message === 'string' ? message : (message.textContent ?? ''), hidden: false };
		notices.push(this.state);
	}

	setMessage(message: string | DocumentFragment): this {
		this.state.text = typeof message === 'string' ? message : (message.textContent ?? '');
		return this;
	}

	hide(): void {
		this.state.hidden = true;
	}
}

export function setIcon(parent: HTMLElement, icon: string): void {
	parent.empty();
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.classList.add('svg-icon', `lucide-${icon}`);
	parent.appendChild(svg);
}

export function setTooltip(element: HTMLElement, tooltip: string): void {
	element.setAttribute('aria-label', tooltip);
}

export interface Debouncer<T extends unknown[], V> {
	(...args: T): this;
	cancel(): this;
	run(): V | void;
}

export function debounce<T extends unknown[], V>(callback: (...args: T) => V, timeout = 0): Debouncer<T, V> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let pending: T | undefined;

	const run = (): V | void => {
		if (pending === undefined) return;
		const args = pending;
		pending = undefined;
		timer = undefined;
		return callback(...args);
	};
	const debounced = ((...args: T) => {
		pending = args;
		if (timer !== undefined) clearTimeout(timer);
		timer = setTimeout(run, timeout);
		return debounced;
	}) as Debouncer<T, V>;
	debounced.cancel = () => {
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
		pending = undefined;
		return debounced;
	};
	debounced.run = run;

	return debounced;
}

export function requestUrl(): never {
	throw new Error('requestUrl is not available in tests. Use FakeHttp.');
}

abstract class ValueComponent<T> {
	protected changed: (value: T) => unknown = () => {};

	onChange(callback: (value: T) => unknown): this {
		this.changed = callback;
		return this;
	}

	abstract setValue(value: T): this;

	abstract getValue(): T;
}

export class TextComponent extends ValueComponent<string> {
	readonly inputEl: HTMLInputElement;

	constructor(containerEl: HTMLElement, type = 'text') {
		super();
		this.inputEl = containerEl.createEl('input', { type });
		this.inputEl.addEventListener('input', () => this.changed(this.inputEl.value));
	}

	setValue(value: string): this {
		this.inputEl.value = value;
		return this;
	}

	getValue(): string {
		return this.inputEl.value;
	}

	setPlaceholder(placeholder: string): this {
		this.inputEl.placeholder = placeholder;
		return this;
	}

	setDisabled(disabled: boolean): this {
		this.inputEl.disabled = disabled;
		return this;
	}
}

export class SearchComponent extends TextComponent {
	readonly containerEl: HTMLElement;
	readonly clearButtonEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		const container = containerEl.createDiv({ cls: 'search-input-container' });
		super(container, 'search');
		this.containerEl = container;
		this.clearButtonEl = container.createDiv({ cls: 'search-input-clear-button' });
		this.clearButtonEl.addEventListener('click', () => {
			this.setValue('');
			this.inputEl.dispatchEvent(new Event('input'));
		});
	}
}

export class ToggleComponent extends ValueComponent<boolean> {
	readonly toggleEl: HTMLElement;
	private value = false;

	constructor(containerEl: HTMLElement) {
		super();
		this.toggleEl = containerEl.createDiv({ cls: 'checkbox-container', attr: { role: 'switch' } });
		this.toggleEl.addEventListener('click', () => {
			this.setValue(!this.value);
			this.changed(this.value);
		});
	}

	setValue(value: boolean): this {
		this.value = value;
		this.toggleEl.toggleClass('is-enabled', value);
		return this;
	}

	getValue(): boolean {
		return this.value;
	}
}

export class DropdownComponent extends ValueComponent<string> {
	readonly selectEl: HTMLSelectElement;

	constructor(containerEl: HTMLElement) {
		super();
		this.selectEl = containerEl.createEl('select', { cls: 'dropdown' });
		this.selectEl.addEventListener('change', () => this.changed(this.selectEl.value));
	}

	addOption(value: string, display: string): this {
		this.selectEl.createEl('option', { value, text: display });
		return this;
	}

	addOptions(options: Record<string, string>): this {
		for (const [value, display] of Object.entries(options)) this.addOption(value, display);
		return this;
	}

	setValue(value: string): this {
		this.selectEl.value = value;
		return this;
	}

	getValue(): string {
		return this.selectEl.value;
	}
}

export class ButtonComponent {
	readonly buttonEl: HTMLButtonElement;

	constructor(containerEl: HTMLElement) {
		this.buttonEl = containerEl.createEl('button');
	}

	setButtonText(text: string): this {
		this.buttonEl.setText(text);
		return this;
	}

	setIcon(icon: string): this {
		setIcon(this.buttonEl, icon);
		return this;
	}

	setTooltip(tooltip: string): this {
		setTooltip(this.buttonEl, tooltip);
		return this;
	}

	setCta(): this {
		this.buttonEl.addClass('mod-cta');
		return this;
	}

	setWarning(): this {
		this.buttonEl.addClass('mod-warning');
		return this;
	}

	setClass(cls: string): this {
		this.buttonEl.addClass(cls);
		return this;
	}

	setDisabled(disabled: boolean): this {
		this.buttonEl.disabled = disabled;
		this.buttonEl.toggleClass('is-disabled', disabled);
		return this;
	}

	onClick(callback: (event: MouseEvent) => unknown): this {
		this.buttonEl.addEventListener('click', (event) => {
			if (!this.buttonEl.disabled) callback(event);
		});
		return this;
	}
}

export class ExtraButtonComponent extends ButtonComponent {}

export class Setting {
	readonly settingEl: HTMLElement;
	readonly infoEl: HTMLElement;
	readonly nameEl: HTMLElement;
	readonly descEl: HTMLElement;
	readonly controlEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		this.settingEl = containerEl.createDiv({ cls: 'setting-item' });
		this.infoEl = this.settingEl.createDiv({ cls: 'setting-item-info' });
		this.nameEl = this.infoEl.createDiv({ cls: 'setting-item-name' });
		this.descEl = this.infoEl.createDiv({ cls: 'setting-item-description' });
		this.controlEl = this.settingEl.createDiv({ cls: 'setting-item-control' });
	}

	setName(name: string | DocumentFragment): this {
		this.nameEl.setText(name);
		return this;
	}

	setDesc(desc: string | DocumentFragment): this {
		this.descEl.setText(desc);
		return this;
	}

	setClass(cls: string): this {
		this.settingEl.addClass(cls);
		return this;
	}

	setHeading(): this {
		this.settingEl.addClass('setting-item-heading');
		return this;
	}

	setDisabled(disabled: boolean): this {
		this.settingEl.toggleClass('is-disabled', disabled);
		return this;
	}

	addText(configure: (component: TextComponent) => unknown): this {
		configure(new TextComponent(this.controlEl));
		return this;
	}

	addSearch(configure: (component: SearchComponent) => unknown): this {
		configure(new SearchComponent(this.controlEl));
		return this;
	}

	addToggle(configure: (component: ToggleComponent) => unknown): this {
		configure(new ToggleComponent(this.controlEl));
		return this;
	}

	addDropdown(configure: (component: DropdownComponent) => unknown): this {
		configure(new DropdownComponent(this.controlEl));
		return this;
	}

	addButton(configure: (component: ButtonComponent) => unknown): this {
		configure(new ButtonComponent(this.controlEl));
		return this;
	}

	addExtraButton(configure: (component: ExtraButtonComponent) => unknown): this {
		configure(new ExtraButtonComponent(this.controlEl));
		return this;
	}
}
