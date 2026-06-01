import { createRequire } from "node:module";
import { join } from "node:path";

// Resolve the require base from the process working directory, NOT
// import.meta.url: the production server is an esbuild CJS bundle where
// import.meta.url is stripped to undefined, which makes createRequire throw.
// The systemd unit runs with WorkingDirectory = this package, and `next dev`
// also runs from here, so cwd/node_modules resolves authenticate-pam in both.
const nodeRequire = createRequire(join(process.cwd(), "server.js"));

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
