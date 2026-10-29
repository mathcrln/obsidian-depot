export class ProfileError extends Error {
	constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

export class UnknownProfile extends ProfileError {
	constructor(id: string) {
		super(`No storage profile named "${id}"`);
	}
}

export class ProfileDeleted extends ProfileError {
	constructor(id: string) {
		super(`The storage profile "${id}" was deleted`);
	}
}

export class NoDefaultProfile extends ProfileError {
	constructor() {
		super('No default storage profile is configured');
	}
}
