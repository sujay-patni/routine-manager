#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const REQUIRED = [20, 9, 0];

function parseVersion(version) {
  const match = version.match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return match.slice(1).map(Number);
}

function isAtLeast(version, required = REQUIRED) {
  const parsed = parseVersion(version);
  if (!parsed) return false;
  for (let i = 0; i < required.length; i += 1) {
    if (parsed[i] > required[i]) return true;
    if (parsed[i] < required[i]) return false;
  }
  return true;
}

function compareVersions(a, b) {
  const pa = parseVersion(a) ?? [0, 0, 0];
  const pb = parseVersion(b) ?? [0, 0, 0];
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pb[i] - pa[i];
  }
  return 0;
}

function readNvmDir() {
  if (process.env.NVM_DIR) return process.env.NVM_DIR;
  return join(homedir(), ".nvm");
}

function findNvmNode() {
  const versionsDir = join(readNvmDir(), "versions", "node");
  if (!existsSync(versionsDir)) return null;

  const candidates = readdirSync(versionsDir)
    .filter((entry) => isAtLeast(entry))
    .sort(compareVersions)
    .map((entry) => join(versionsDir, entry, "bin", "node"))
    .filter((nodePath) => existsSync(nodePath));

  return candidates[0] ?? null;
}

function requiredLabel() {
  try {
    const nvmrc = readFileSync(join(process.cwd(), ".nvmrc"), "utf8").trim();
    return nvmrc || "20";
  } catch {
    return "20";
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-with-required-node.mjs <command> [...args]");
  process.exit(1);
}

if (isAtLeast(process.version)) {
  const result = spawnSync(args[0], args.slice(1), { stdio: "inherit", shell: process.platform === "win32" });
  process.exit(result.status ?? 1);
}

const node20 = findNvmNode();
if (!node20) {
  console.error(
    `Next.js 16 requires Node >=${REQUIRED.join(".")}, but this shell is using ${process.version}.\n` +
    `Install/use Node ${requiredLabel()} first, for example: nvm install && nvm use`
  );
  process.exit(1);
}

const result = spawnSync(node20, args, { stdio: "inherit" });
process.exit(result.status ?? 1);
