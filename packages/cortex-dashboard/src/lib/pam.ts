import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function authenticatePam(username: string, password: string): Promise<void> {
  const pam = require(["authenticate", "pam"].join("-")) as typeof import("authenticate-pam");
  return new Promise((resolve, reject) => {
    pam.authenticate(username, password, (err?: Error | string | null) => {
      if (err) reject(err instanceof Error ? err : new Error(String(err)));
      else resolve();
    });
  });
}
