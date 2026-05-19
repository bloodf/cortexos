import Redis from "ioredis";

let client: Redis | null = null;

export function getRedisClient(): Redis | null {
	const url = process.env.REDIS_URL;
	if (!url) return null;
	if (client) return client;
	client = new Redis(url, {
		lazyConnect: true,
		maxRetriesPerRequest: 3,
		enableReadyCheck: true,
	});
	client.on("error", (err) => {
		process.stderr.write(`[redis] ${err instanceof Error ? err.message : String(err)}\n`);
	});
	void client.connect().catch((err) => {
		process.stderr.write(`[redis] connect failed: ${err instanceof Error ? err.message : String(err)}\n`);
	});
	return client;
}

export async function closeRedisClient(): Promise<void> {
	if (!client) return;
	const current = client;
	client = null;
	await current.quit().catch(() => current.disconnect());
}
