#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const fix = process.argv.includes("--fix");

function docker(args) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function rows() {
  const format = [
    "{{.ID}}",
    "{{.Names}}",
    '{{.Label "com.docker.compose.project"}}',
    '{{.Label "com.docker.compose.service"}}',
    '{{.Label "com.docker.compose.container-number"}}',
    "{{.Status}}",
  ].join("\t");
  const out = docker(["ps", "-a", "--format", format]).trim();
  if (!out) return [];
  return out.split("\n").map((line) => {
    const [id, name, project, service, number, status] = line.split("\t");
    return { id, name, project, service, number, status };
  });
}

function printProblems(problems) {
  for (const item of problems) {
    console.error(`- ${item.type}: ${item.name} (${item.detail})`);
  }
}

let containers;
try {
  containers = rows();
} catch (error) {
  console.error(`Docker name audit could not inspect containers: ${error.message}`);
  process.exit(1);
}

const removable = containers.filter((container) => {
  return container.project && container.service && container.number && container.number !== "1";
});

if (fix && removable.length) {
  for (const container of removable) {
    console.log(`Removing duplicate compose container: ${container.name}`);
    docker(["rm", "-f", container.id]);
  }
  containers = rows();
}

const problems = [];
const serviceCounts = new Map();
for (const container of containers) {
  if (!container.project || !container.service) continue;
  const key = `${container.project}/${container.service}`;
  serviceCounts.set(key, (serviceCounts.get(key) || 0) + 1);
  if (container.number && container.number !== "1") {
    problems.push({
      type: "duplicate compose instance",
      name: container.name,
      detail: `${key} has container-number=${container.number}`,
    });
  }
}

for (const container of containers) {
  if (!/-[0-9]+$/.test(container.name)) continue;
  const key = container.project && container.service ? `${container.project}/${container.service}` : "not compose-labelled";
  problems.push({
    type: "numbered container name",
    name: container.name,
    detail: `${key}; use an explicit container_name and recreate the stack with --remove-orphans`,
  });
}

for (const [key, count] of [...serviceCounts.entries()].sort()) {
  if (count > 1) {
    problems.push({
      type: "multiple containers for one compose service",
      name: key,
      detail: `${count} containers exist for one service`,
    });
  }
}

if (problems.length) {
  console.error(`Docker name audit found ${problems.length} problem(s):`);
  printProblems(problems);
  if (!fix && removable.length) console.error("Run with --fix to remove duplicate compose containers with container-number > 1.");
  process.exit(1);
}

console.log("Docker name audit passed: no numbered or duplicate compose containers found.");
