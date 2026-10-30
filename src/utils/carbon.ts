export type DateInput = Date | number | string;

export interface CarbonOptions {
	locale?: string;
	timeZone?: string;
}

export const Carbon = {
	parse(value: DateInput): Date {
		const dateOnly = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
		let date: Date;

		if (dateOnly) {
			const year = Number(dateOnly[1]);
			const month = Number(dateOnly[2]) - 1;
			const day = Number(dateOnly[3]);
			date = new Date(0);
			date.setFullYear(year, month, day);
			date.setHours(0, 0, 0, 0);

			if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
				throw new RangeError('Invalid calendar date: ' + String(value));
			}
		} else {
			date = new Date(value instanceof Date ? value.getTime() : value);
		}

		if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date: ' + String(value));

		return date;
	},

	ymd(value: DateInput, options: CarbonOptions = {}): string {
		return Carbon.format(value, 'YYYY-MM-DD', options);
	},

	format(value: DateInput, pattern: string, options: CarbonOptions = {}): string {
		const date = Carbon.parse(value);
		const parts = calendarParts(date, options.timeZone);
		const tokens: Record<string, () => string> = {
			YYYY: () => pad(parts.year, 4),
			M: () => String(parts.month),
			MM: () => pad(parts.month),
			MMM: () => nameOf(date, { month: 'short' }, options),
			MMMM: () => nameOf(date, { month: 'long' }, options),
			D: () => String(parts.day),
			DD: () => pad(parts.day),
			ddd: () => nameOf(date, { weekday: 'short' }, options),
			dddd: () => nameOf(date, { weekday: 'long' }, options),
			H: () => String(parts.hour),
			HH: () => pad(parts.hour),
			m: () => String(parts.minute),
			mm: () => pad(parts.minute),
		};

		return pattern.replace(/\[([^\]]*)\]|YYYY|MMMM|MMM|MM|M|DD|D|dddd|ddd|HH|H|mm|m/g, (token, literal?: string) =>
			literal !== undefined ? literal : (tokens[token]?.() ?? token)
		);
	},

	formatDate(value: DateInput, { locale, timeZone }: CarbonOptions = {}): string {
		return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone }).format(Carbon.parse(value));
	},

	formatMonth(value: DateInput, { locale, timeZone }: CarbonOptions = {}): string {
		return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone }).format(Carbon.parse(value));
	},
};

interface CalendarParts {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
}

function calendarParts(date: Date, timeZone: string | undefined): CalendarParts {
	if (timeZone === undefined) {
		return {
			year: date.getFullYear(),
			month: date.getMonth() + 1,
			day: date.getDate(),
			hour: date.getHours(),
			minute: date.getMinutes(),
		};
	}

	const formatted = new Intl.DateTimeFormat('en-GB', {
		timeZone,
		calendar: 'gregory',
		numberingSystem: 'latn',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		hourCycle: 'h23',
	}).formatToParts(date);
	const parts = new Map(formatted.map((part) => [part.type, Number(part.value)]));

	return {
		year: parts.get('year') ?? 0,
		month: parts.get('month') ?? 0,
		day: parts.get('day') ?? 0,
		hour: parts.get('hour') ?? 0,
		minute: parts.get('minute') ?? 0,
	};
}

function nameOf(date: Date, format: Intl.DateTimeFormatOptions, { locale, timeZone }: CarbonOptions): string {
	return new Intl.DateTimeFormat(locale, { ...format, timeZone, calendar: 'gregory' }).format(date);
}

function pad(value: number, length = 2): string {
	return String(value).padStart(length, '0');
}
