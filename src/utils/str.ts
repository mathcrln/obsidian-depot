export interface SlugOptions {
	lowercase?: boolean;
}

export interface PluralOptions {
	locale?: string;
	plural?: string;
}

export const Str = {
	slug(value: string, { lowercase = true }: SlugOptions = {}): string {
		const slug = value.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');

		return lowercase ? slug.toLowerCase() : slug;
	},

	escapeRegExp(value: string): string {
		return value.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
	},

	words(value: string): string[] {
		return value.split(/\s+/).filter(Boolean);
	},

	compare(this: void, a: string, b: string): number {
		return a < b ? -1 : a > b ? 1 : 0;
	},

	plural(noun: string, count: number, { locale = 'en', plural = noun + 's' }: PluralOptions = {}): string {
		return new Intl.PluralRules(locale).select(count) === 'one' ? noun : plural;
	},

	quantity(count: number, noun: string, options: PluralOptions = {}): string {
		return count + ' ' + Str.plural(noun, count, options);
	},
};
