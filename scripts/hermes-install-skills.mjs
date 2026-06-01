#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const repoRoot = process.cwd();
const templateRoot = resolve(repoRoot, "templates/hermes/skills");
const hermesRoot = process.env.CORTEX_HERMES_ROOT || "/opt/cortexos/hermes";
const profilesRoot = join(hermesRoot, "profiles");
const globalSkillsRoot = join(hermesRoot, "skills");
const cortexFactoryProfiles = new Set(
  (process.env.CORTEX_FACTORY_PROFILES || "default,cortex")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);

const nineRouterSkills = [
  "9router",
  "9router-chat",
  "9router-image",
  "9router-tts",
  "9router-stt",
  "9router-embeddings",
  "9router-web-search",
  "9router-web-fetch",
];

function profileNames() {
  if (!existsSync(profilesRoot)) return [];
  return readdirSync(profilesRoot)
    .filter((name) => {
      const full = join(profilesRoot, name);
      return statSync(full).isDirectory();
    })
    .sort();
}

function installSkill(skillName, skillsRoot) {
  const src = join(templateRoot, skillName);
  if (!existsSync(join(src, "SKILL.md"))) {
    throw new Error(`missing skill template: ${src}/SKILL.md`);
  }
  mkdirSync(skillsRoot, { recursive: true });
  const dest = join(skillsRoot, basename(skillName));
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
}

for (const skill of nineRouterSkills) {
  installSkill(skill, globalSkillsRoot);
}

for (const profile of profileNames()) {
  const skillsRoot = join(profilesRoot, profile, "skills");
  for (const skill of nineRouterSkills) {
    installSkill(skill, skillsRoot);
  }
  if (cortexFactoryProfiles.has(profile)) {
    installSkill("cortex-factory-creation", skillsRoot);
  }
}

console.log(JSON.stringify({
  hermesRoot,
  profiles: profileNames(),
  installedEverywhere: nineRouterSkills,
  cortexFactoryProfiles: [...cortexFactoryProfiles].sort(),
}, null, 2));
