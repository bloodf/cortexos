import { runAlerts } from "./lib/alerts.js";

const invokedDirectly = process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href;
if (invokedDirectly) {
  runAlerts().catch((e) => {
    process.stderr.write(`[alerts] fatal: ${e.stack || e.message}\n`);
    process.exit(1);
  });
}

export { runAlerts };
