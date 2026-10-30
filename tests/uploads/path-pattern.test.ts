import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvalidPathPattern, PathPattern } from '@/uploads/path-pattern';
import type { KeyOptions, UploadedFile } from '@/uploads/path-pattern';

const ID = '53670a34e119ae832528b72f8bd8750e';
const JUNE_7_2025 = new Date(2025, 5, 7, 10, 30).getTime();
const JANUARY_2_2026 = new Date(2026, 0, 2, 23, 59).getTime();

afterEach(() => {
	vi.useRealTimers();
});

describe('default', () => {
	it('is year, month, id and extension', () => {
		expect(PathPattern.DEFAULT.toString()).toBe('{yyyy}/{mm}/{id}.{ext}');
	});

	it('builds the documented key', () => {
		const key = PathPattern.DEFAULT.keyFor(GivenFile({ fileName: 'Beach Photo (2).JPG', note: 'Holidays' }), GivenOptions());

		expect(key).toMatch(new RegExp(`^2025/06/${ID}\\.jpg$`));
	});
});

describe('parsing', () => {
	it('round-trips the source text', () => {
		expect(PathPattern.parse('{type}/{id}').toString()).toBe('{type}/{id}');
	});

	it.each([
		['{name}.{ext}', 'must include {id}'],
		['', 'cannot be empty'],
		['   ', 'cannot be empty'],
		['/{id}', 'cannot start with a slash'],
		['a/../{id}', 'cannot contain ".."'],
		['{id}-{size}', 'Unknown placeholder {size}'],
		['{ID}', 'Unknown placeholder {ID}'],
	])('rejects %j', (source, reason) => {
		expect(() => PathPattern.parse(source)).toThrow(InvalidPathPattern);
		expect(() => PathPattern.parse(source)).toThrow(reason);
	});

	it('allows dots inside a segment', () => {
		expect(PathPattern.isValid('v1..2/{id}')).toBe(true);
	});

	it('reports validity without throwing', () => {
		expect(PathPattern.isValid('{id}')).toBe(true);
		expect(PathPattern.isValid('{name}')).toBe(false);
	});

	it('accepts a pattern that is only the id', () => {
		expect(PathPattern.parse('{id}').keyFor(GivenFile({ fileName: 'a.png' }), GivenOptions())).toMatch(
			new RegExp(`^${ID}\\.?$`)
		);
	});
});

describe('dates', () => {
	it('zero-pads year, month and day in local time', () => {
		const pattern = PathPattern.parse('{yyyy}-{mm}-{dd}/{id}');

		expect(pattern.keyFor(GivenFile({ fileName: 'a.png', time: JANUARY_2_2026 }), GivenOptions())).toMatch(
			new RegExp(`^2026-01-02/${ID}$`)
		);
	});

	it('defaults the time to now', () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date(2027, 0, 1, 0, 0));
		const key = PathPattern.parse('{yyyy}/{id}').keyFor({ fileName: 'a.png', id: ID }, GivenOptions());

		expect(key).toBe('2027/' + ID);
	});
});

describe('id', () => {
	it('uses the given id as it is', () => {
		const key = PathPattern.parse('{id}').keyFor(GivenFile({ fileName: 'a', id: 'Some_Id-1' }), GivenOptions());

		expect(key).toBe('Some_Id-1');
	});
});

describe('file parts', () => {
	it('uses the name without its last extension and a lowercased extension', () => {
		const key = PathPattern.parse('{name}-{id}.{ext}').keyFor(GivenFile({ fileName: 'archive.tar.GZ' }), GivenOptions());

		expect(key).toMatch(new RegExp(`^archive-tar-${ID}\\.gz$`));
	});

	it('removes the dot when the file has no extension', () => {
		const key = PathPattern.parse('{name}-{id}.{ext}').keyFor(GivenFile({ fileName: 'report' }), GivenOptions());

		expect(key).toMatch(new RegExp(`^report-${ID}$`));
	});

	it('treats a leading-dot name as having no extension', () => {
		const key = PathPattern.parse('{name}-{id}.{ext}').keyFor(GivenFile({ fileName: '.hidden' }), GivenOptions());

		expect(key).toMatch(new RegExp(`^hidden-${ID}$`));
	});

	it('treats a trailing dot as having no extension', () => {
		const key = PathPattern.parse('{name}-{id}.{ext}').keyFor(GivenFile({ fileName: 'name.' }), GivenOptions());

		expect(key).toMatch(new RegExp(`^name-${ID}$`));
	});

	it.each([
		['photo.png', 'image'],
		['doc.pdf', 'pdf'],
		['song.mp3', 'audio'],
		['clip.mov', 'video'],
		['data.xyz', 'other'],
		['README', 'other'],
	])('puts %s under its kind %s', (fileName, kind) => {
		const key = PathPattern.parse('{type}/{id}').keyFor(GivenFile({ fileName }), GivenOptions());

		expect(key).toMatch(new RegExp(`^${kind}/${ID}$`));
	});
});

describe('names', () => {
	it('lowercases names when asked, including Unicode letters', () => {
		const key = PathPattern.parse('{name}/{note}/{id}').keyFor(
			GivenFile({ fileName: 'ÉTÉ.PNG', note: 'My NOTE' }),
			GivenOptions({ lowercaseNames: true })
		);

		expect(key).toMatch(new RegExp(`^été/my-note/${ID}$`));
	});

	it('keeps the case of names when not lowercasing', () => {
		const key = PathPattern.parse('{name}/{note}/{id}').keyFor(
			GivenFile({ fileName: 'ÉTÉ.PNG', note: 'My NOTE' }),
			GivenOptions({ lowercaseNames: false })
		);

		expect(key).toMatch(new RegExp(`^ÉTÉ/My-NOTE/${ID}$`));
	});

	it('does not alter the pattern literals', () => {
		const key = PathPattern.parse('Files_2025/{id}').keyFor(
			GivenFile({ fileName: 'a.png' }),
			GivenOptions({ lowercaseNames: true })
		);

		expect(key).toMatch(new RegExp(`^Files_2025/${ID}$`));
	});
});

describe('notes', () => {
	it('uses the note name', () => {
		const key = PathPattern.parse('{note}/{id}').keyFor(
			GivenFile({ fileName: 'a.png', note: 'Weekly review' }),
			GivenOptions()
		);

		expect(key).toMatch(new RegExp(`^weekly-review/${ID}$`));
	});

	it.each([undefined, '', '   ', '***'])('falls back to the fixed untitled name for %j', (note) => {
		const key = PathPattern.parse('{note}/{id}').keyFor(
			GivenFile({ fileName: 'a.png', ...(note === undefined ? {} : { note }) }),
			GivenOptions()
		);

		expect(key).toMatch(new RegExp(`^untitled/${ID}$`));
	});
});

describe('empty placeholders', () => {
	it('drops an empty name but keeps the rest of the segment', () => {
		const key = PathPattern.parse('{name}-{id}.{ext}').keyFor(GivenFile({ fileName: '***.png' }), GivenOptions());

		expect(key).toMatch(new RegExp(`^-${ID}\\.png$`));
	});
});

function GivenFile({
	fileName,
	note,
	time = JUNE_7_2025,
	id = ID,
}: {
	fileName: string;
	note?: string;
	time?: number;
	id?: string;
}): UploadedFile {
	return { fileName, id, ...(note === undefined ? {} : { note }), time };
}

function GivenOptions({ lowercaseNames = true }: Partial<KeyOptions> = {}): KeyOptions {
	return { lowercaseNames };
}
