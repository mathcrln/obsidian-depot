import { attachmentKindOf } from '@/attachments/attachment-kind';
import { extensionOf } from '@/uploads/content-types';

export interface UploadedFile {
	fileName: string;
	id: string;
	note?: string;
	time?: number;
}

export interface KeyOptions {
	lowercaseNames: boolean;
}

const UNTITLED_NOTE = 'untitled';

export class InvalidPathPattern extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidPathPattern';
	}
}

const PLACEHOLDERS = new Set(['yyyy', 'mm', 'dd', 'name', 'ext', 'id', 'type', 'note']);
const PLACEHOLDER = /\{([^{}]*)\}/g;

export class PathPattern {
	static readonly DEFAULT = new PathPattern('{yyyy}/{mm}/{id}.{ext}');

	private constructor(private readonly source: string) {}

	static parse(source: string): PathPattern {
		const problem = PathPattern.problemWith(source);

		if (problem !== undefined) {
			throw new InvalidPathPattern(problem);
		}

		return new PathPattern(source);
	}

	static isValid(source: string): boolean {
		return PathPattern.problemWith(source) === undefined;
	}

	keyFor(file: UploadedFile, options: KeyOptions): string {
		const time = file.time ?? Date.now();
		const date = new Date(time);
		const extension = extensionOf(file.fileName) ?? '';
		const note = slug(file.note ?? '', options.lowercaseNames) || slug(UNTITLED_NOTE, options.lowercaseNames);
		const values: Record<string, () => string> = {
			yyyy: () => String(date.getFullYear()).padStart(4, '0'),
			mm: () => String(date.getMonth() + 1).padStart(2, '0'),
			dd: () => String(date.getDate()).padStart(2, '0'),
			name: () => slug(nameWithoutExtension(file.fileName, extension), options.lowercaseNames),
			ext: () => extension,
			id: () => file.id,
			type: () => attachmentKindOf(file.fileName),
			note: () => note,
		};

		const filled = (extension === '' ? this.source.replace(/\.\{ext\}/g, '') : this.source).replace(
			PLACEHOLDER,
			(_, name: string) => values[name]?.() ?? ''
		);

		return filled
			.split('/')
			.filter((segment) => segment !== '')
			.join('/');
	}

	toString(): string {
		return this.source;
	}

	private static problemWith(source: string): string | undefined {
		if (source.trim() === '') {
			return 'The path pattern cannot be empty.';
		}

		if (source.startsWith('/')) {
			return 'The path pattern cannot start with a slash.';
		}

		if (source.split('/').includes('..')) {
			return 'The path pattern cannot contain ".." segments.';
		}

		for (const match of source.matchAll(PLACEHOLDER)) {
			if (!PLACEHOLDERS.has(match[1] ?? '')) {
				return `Unknown placeholder {${match[1]}}.`;
			}
		}

		if (!source.includes('{id}')) {
			return 'The path pattern must include {id} so uploads never replace each other.';
		}

		return undefined;
	}
}

function nameWithoutExtension(fileName: string, extension: string): string {
	return extension === '' ? fileName.replace(/\.$/, '') : fileName.slice(0, -(extension.length + 1));
}

function slug(value: string, lowercase: boolean): string {
	const slugged = value.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');

	return lowercase ? slugged.toLowerCase() : slugged;
}
