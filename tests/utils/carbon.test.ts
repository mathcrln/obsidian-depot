import { describe, expect, it } from 'vitest';
import { Carbon } from '@/utils/carbon';

describe('Carbon', () => {
	describe('parse', () => {
		it('builds local midnight from a date-only string', () => {
			const date = Carbon.parse('2026-12-25');

			expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 11, 25, 0]);
		});

		it('uses native parsing for a timestamp with an offset', () => {
			expect(Carbon.parse('2026-04-22T14:05:00Z').getTime()).toBe(1776866700000);
		});

		it('accepts an epoch timestamp including zero', () => {
			expect(Carbon.parse(0).getTime()).toBe(0);
		});

		it('copies a Date without mutating the input', () => {
			const input = new Date(2026, 11, 25, 14, 5);
			const original = input.getTime();

			const parsed = Carbon.parse(input);
			parsed.setFullYear(2030);

			expect(input.getTime()).toBe(original);
			expect(parsed.getFullYear()).toBe(2030);
		});

		it('preserves years below one hundred', () => {
			expect(Carbon.parse('0026-01-05').getFullYear()).toBe(26);
		});

		it('accepts a leap day', () => {
			expect(Carbon.parse('2028-02-29').getDate()).toBe(29);
		});

		it.each(['not a date', '', '2026-02-29', '2026-02-30', '2026-13-01', '2026-01-00', Number.NaN, new Date(NaN)])(
			'rejects invalid date %s',
			(value) => {
				expect(() => Carbon.parse(value)).toThrow(RangeError);
			}
		);
	});

	describe('ymd', () => {
		it('pads local calendar components', () => {
			expect(Carbon.ymd(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
		});

		it('round-trips date-only strings', () => {
			expect(Carbon.ymd('2026-12-25')).toBe('2026-12-25');
			expect(Carbon.ymd('0026-01-05')).toBe('0026-01-05');
		});

		it('accepts a local timestamp string', () => {
			expect(Carbon.ymd('2026-04-22T12:00:00')).toBe('2026-04-22');
		});

		it('reads a date in the requested timezone', () => {
			expect(Carbon.ymd('2026-10-08T02:30:00Z', { timeZone: 'America/Martinique' })).toBe('2026-10-07');
			expect(Carbon.ymd('2026-10-08T02:30:00Z', { timeZone: 'Europe/Paris' })).toBe('2026-10-08');
		});
	});

	describe('format', () => {
		it('formats local numeric tokens with and without padding', () => {
			expect(Carbon.format('2026-01-05T07:05:00', 'YYYY-MM-DD HH:mm | M/D H:m')).toBe('2026-01-05 07:05 | 1/5 7:5');
		});

		it('formats month and weekday names in an explicit locale', () => {
			expect(Carbon.format('2026-10-08', 'dddd D MMMM YYYY', { locale: 'fr' })).toBe('jeudi 8 octobre 2026');
			expect(Carbon.format('2026-10-08', 'ddd D MMM', { locale: 'fr' })).toBe('jeu. 8 oct.');
			expect(Carbon.format('2026-10-08', 'dddd D MMMM YYYY', { locale: 'en-US' })).toBe('Thursday 8 October 2026');
		});

		it('keeps bracketed text literal and does not reformat inserted names', () => {
			expect(Carbon.format('2026-03-02T07:05:00', 'MMMM HH[h]mm [YYYY]', { locale: 'en-US' })).toBe('March 07h05 YYYY');
		});

		it('uses one timezone for numeric and named components across midnight', () => {
			expect(
				Carbon.format('2026-10-08T02:30:00Z', 'dddd YYYY-MM-DD HH:mm', {
					locale: 'en-US',
					timeZone: 'America/Martinique',
				})
			).toBe('Wednesday 2026-10-07 22:30');
		});

		it('writes midnight as 00', () => {
			expect(Carbon.format('2026-10-08T00:00:00Z', 'HH:mm', { timeZone: 'UTC' })).toBe('00:00');
		});

		it.each([
			['2026-03-29T00:30:00Z', '01:30'],
			['2026-03-29T01:30:00Z', '03:30'],
		])('applies the timezone offset at %s', (value, expected) => {
			expect(Carbon.format(value, 'HH:mm', { timeZone: 'Europe/Paris' })).toBe(expected);
		});

		it('keeps numeric tokens Gregorian and ASCII across locales', () => {
			expect(Carbon.format('2026-01-05', 'YYYY/MM/DD', { locale: 'ar-EG' })).toBe('2026/01/05');
			expect(Carbon.format('2026-01-05', 'YYYY/MM/DD', { locale: 'th-TH' })).toBe('2026/01/05');
		});

		it('accepts Date and timestamp inputs without changing the Date', () => {
			const input = new Date(2027, 0, 1);
			const original = input.getTime();

			expect(Carbon.format(input, 'YYYY-MM-DD')).toBe('2027-01-01');
			expect(Carbon.format(original, 'YYYY-MM-DD')).toBe('2027-01-01');
			expect(input.getTime()).toBe(original);
		});
	});

	describe('formatDate', () => {
		it('formats a medium date in the requested locale', () => {
			expect(Carbon.formatDate('2026-10-02', { locale: 'en-US' })).toBe('Oct 2, 2026');
			expect(Carbon.formatDate('2026-10-02', { locale: 'fr' })).toBe('2 oct. 2026');
		});

		it('honors the requested timezone at a date boundary', () => {
			expect(Carbon.formatDate('2026-10-08T02:30:00Z', { locale: 'en-US', timeZone: 'America/Martinique' })).toBe(
				'Oct 7, 2026'
			);
		});
	});

	describe('formatMonth', () => {
		it('formats a month and year in locale order', () => {
			expect(Carbon.formatMonth('2026-10-02', { locale: 'en-US' })).toBe('October 2026');
			expect(Carbon.formatMonth('2026-10-02', { locale: 'fr' })).toBe('octobre 2026');
			expect(Carbon.formatMonth('2026-10-02', { locale: 'ja-JP' })).toBe('2026年10月');
		});

		it('honors the requested timezone at a month boundary', () => {
			expect(Carbon.formatMonth('2027-01-01T02:30:00Z', { locale: 'en-US', timeZone: 'America/Martinique' })).toBe(
				'December 2026'
			);
		});
	});
});
