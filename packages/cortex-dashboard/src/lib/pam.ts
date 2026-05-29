import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);

// Native addon (libpam). The module name is assembled at runtime so the
// bundler (turbopack) cannot statically trace the .node file into the build
// graph — it stays an external runtime require. serverExternalPackages lists
// it too, but this keeps the build robust across bundler versions.
interface AuthenticatePamModule {
  authenticate: (
    username: string,
    password: string,
    cb: (err?: Error | string | null) => void,
    options?: unknown,
  ) => void;
}

export function authenticatePam(username: string, password: string): Promise<void> {
  const moduleName = ["authenticate", "pam"].join("-");
  const pam = nodeRequire(moduleName) as AuthenticatePamModule;
  return new Promise((resolve, reject) => {
    pam.authenticate(username, password, (err?: Error | string | null) => {
      if (err) reject(err instanceof Error ? err : new Error(String(err)));
      else resolve();
    });
  });
}
