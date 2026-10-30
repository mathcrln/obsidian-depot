const CANDIDATE = /(?<![A-Za-z0-9+.-])[a-z][a-z0-9-]*:\/\/[^\s)>"'\],|]*/g;

export function findReferencesIn(text: string): string[] {
	return text.match(CANDIDATE) ?? [];
}
