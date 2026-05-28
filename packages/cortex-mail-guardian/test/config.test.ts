import { describe, expect, it } from "vitest";
import { decodeBase64Secret, loadConfig } from "../src/config.js";

function baseEnv(): NodeJS.ProcessEnv {
	const password = Buffer.from("dummy#password;with.symbols", "utf8").toString("base64");
	return {
		MAIL_GUARDIAN_ACCOUNT_COUNT: "3",
		MAIL_GUARDIAN_ACCOUNT_1_SLUG: "geeks-heitor",
		MAIL_GUARDIAN_ACCOUNT_1_ADDRESS: "heitor@geekspropaganda.com.br",
		MAIL_GUARDIAN_ACCOUNT_1_HOST: "mail.geekspropaganda.com.br",
		MAIL_GUARDIAN_ACCOUNT_1_PORT: "993",
		MAIL_GUARDIAN_ACCOUNT_1_USERNAME: "heitor@geekspropaganda.com.br",
		MAIL_GUARDIAN_ACCOUNT_1_PASSWORD_B64: password,
		MAIL_GUARDIAN_ACCOUNT_2_SLUG: "geeks-contato",
		MAIL_GUARDIAN_ACCOUNT_2_ADDRESS: "contato@geekspropaganda.com.br",
		MAIL_GUARDIAN_ACCOUNT_2_HOST: "mail.geekspropaganda.com.br",
		MAIL_GUARDIAN_ACCOUNT_2_PORT: "993",
		MAIL_GUARDIAN_ACCOUNT_2_USERNAME: "contato@geekspropaganda.com.br",
		MAIL_GUARDIAN_ACCOUNT_2_PASSWORD_B64: password,
		MAIL_GUARDIAN_ACCOUNT_3_SLUG: "heitorramon-eu",
		MAIL_GUARDIAN_ACCOUNT_3_ADDRESS: "eu@heitorramon.com",
		MAIL_GUARDIAN_ACCOUNT_3_HOST: "mail.heitorramon.com",
		MAIL_GUARDIAN_ACCOUNT_3_PORT: "993",
		MAIL_GUARDIAN_ACCOUNT_3_USERNAME: "eu@heitorramon.com",
		MAIL_GUARDIAN_ACCOUNT_3_PASSWORD_B64: password,
		TELEGRAM_BOT_TOKEN: "token",
		NINEROUTER_API_KEY: "key",
	};
}

describe("config", () => {
	it("loads configured base64 password accounts", () => {
		const config = loadConfig(baseEnv());
		expect(config.accounts).toHaveLength(3);
		expect(config.accounts[0].password).toBe("dummy#password;with.symbols");
		expect(config.accounts[2].host).toBe("mail.heitorramon.com");
		expect(config.accounts[2].reviewMailbox).toBe("INBOX.Cortex Mail Guardian Review");
		expect(config.model).toBe("minimax/MiniMax-M2.7-highspeed");
		expect(config.confidenceThreshold).toBe(0.82);
	});

	it("rejects invalid base64", () => {
		expect(() => decodeBase64Secret("SECRET", "not-base64")).toThrow(/base64/);
	});

	it("requires at least one account", () => {
		const input = baseEnv();
		input.MAIL_GUARDIAN_ACCOUNT_COUNT = "0";
		expect(() => loadConfig(input)).toThrow(/positive integer/);
	});
});
