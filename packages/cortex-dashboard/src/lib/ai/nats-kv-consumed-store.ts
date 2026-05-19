import type { KV } from "nats";
import type { TokenConsumedStore } from "./confirmation-token";

const ENCODER = new TextEncoder();

export class NatsKvConsumedStore implements TokenConsumedStore {
	constructor(private readonly kv: KV) {}

	async has(token: string): Promise<boolean> {
		return (await this.kv.get(token)) !== null;
	}

	async add(token: string, expiresAt: Date): Promise<void> {
		if (expiresAt.getTime() <= Date.now()) return;
		await this.kv.put(token, ENCODER.encode("1"));
	}
}
