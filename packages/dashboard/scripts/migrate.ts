#!/usr/bin/env node
import { runMigrations } from "../src/lib/db/migrate";

async function main() {
  const ran = await runMigrations();
  if (ran.length === 0) {
    console.log("No pending migrations");
  } else {
    console.log(`Applied: ${ran.join(", ")}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
