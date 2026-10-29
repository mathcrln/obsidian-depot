import type { Http, HttpRequest, HttpResponse } from '@/storages/http';

type Reply = Partial<HttpResponse> | Error;

export class FakeHttp implements Http {
	readonly requests: HttpRequest[] = [];
	private readonly scripted: { method: string; url: string; reply: Reply }[] = [];
	private fallback: Reply = { status: 200 };

	respondWith(reply: Reply): this {
		this.fallback = reply;
		return this;
	}

	on(method: HttpRequest['method'], url: string, reply: Reply): this {
		this.scripted.push({ method, url, reply });
		return this;
	}

	failWith(message: string): this {
		return this.respondWith(new Error(message));
	}

	async send(request: HttpRequest): Promise<HttpResponse> {
		this.requests.push(request);
		const match = this.scripted.find((entry) => entry.method === request.method && entry.url === request.url);
		const reply = match?.reply ?? this.fallback;
		if (reply instanceof Error) throw reply;
		return { status: 200, headers: {}, body: new ArrayBuffer(0), ...reply };
	}
}
