const PATTERN = /^[a-z][a-z0-9-]*$/;

const RESERVED = new Set(['http', 'https', 'file', 'mailto', 'obsidian', 'app', 'data', 'blob', 'capacitor']);

export class InvalidProfileId extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidProfileId';
	}
}

export class ProfileId {
	private constructor(readonly value: string) {}

	static parse(value: string): ProfileId {
		const problem = ProfileId.problemWith(value);

		if (problem !== undefined) {
			throw new InvalidProfileId(problem);
		}

		return new ProfileId(value);
	}

	static isValid(value: string): boolean {
		return ProfileId.problemWith(value) === undefined;
	}

	equals(other: ProfileId | string): boolean {
		return this.value === (typeof other === 'string' ? other : other.value);
	}

	toString(): string {
		return this.value;
	}

	private static problemWith(value: string): string | undefined {
		if (value === '') {
			return 'A profile identifier cannot be empty.';
		}

		if (!/^[a-z]/.test(value)) {
			return 'A profile identifier must start with a lowercase letter.';
		}

		if (!PATTERN.test(value)) {
			return 'A profile identifier can only contain lowercase letters, digits, and hyphens.';
		}

		if (RESERVED.has(value)) {
			return `"${value}" is a reserved name and cannot be used as a profile identifier.`;
		}

		return undefined;
	}
}
