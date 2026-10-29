const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

export function ulid(time = Date.now()): string {
	return encodeTime(time) + encodeRandom();
}

function encodeTime(time: number): string {
	let remaining = time;
	let encoded = '';

	for (let index = 0; index < TIME_LENGTH; index++) {
		encoded = ALPHABET.charAt(remaining % 32) + encoded;
		remaining = Math.floor(remaining / 32);
	}

	return encoded;
}

function encodeRandom(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_LENGTH));
	let encoded = '';

	for (const byte of bytes) {
		encoded += ALPHABET.charAt(byte & 31);
	}

	return encoded;
}
