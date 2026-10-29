import type { Secrets } from '@/settings/secrets';

export class FakeSecrets implements Secrets {
	constructor(private readonly values: Record<string, string> = {}) {}

	get(id: string): string | null {
		return this.values[id] ?? null;
	}
}
