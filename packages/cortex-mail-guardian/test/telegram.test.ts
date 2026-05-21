import { describe, expect, it } from "vitest";
import { discoverOwnerChatId, type TelegramClient } from "../src/telegram.js";

describe("telegram owner discovery", () => {
	it("finds a private /start chat", async () => {
		const client: TelegramClient = {
			getMe: async () => ({ id: 1 }),
			getChat: async () => ({ id: 1, type: "private" }),
			sendMessage: async () => undefined,
			answerCallbackQuery: async () => undefined,
			getUpdates: async () => [{
				update_id: 1,
				message: { text: "/start", chat: { id: 42, type: "private" } },
			}],
		};
		await expect(discoverOwnerChatId(client)).resolves.toBe("42");
	});
});
