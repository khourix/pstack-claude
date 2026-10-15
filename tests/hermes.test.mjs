// Hermes Agent build contracts: the mapping names every Claude-specific term
// the skills use, every skill with a Codex note also has a Hermes note, and the
// entry points name the mapping and the sheet path.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { noteSkills } from "../tools/generate.mjs";
import { RUNTIMES } from "../tools/runtimes.mjs";
import { markdownFiles } from "../tools/validate-skills.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const skillsDir = join(repoRoot, "plugins/pstack/skills");
const mapping = readFileSync(join(skillsDir, "poteto-mode/references/hermes-tools.md"), "utf8");
const codex = RUNTIMES.find((runtime) => runtime.name === "Codex");
const hermes = RUNTIMES.find((runtime) => runtime.name === "Hermes Agent");

// Claude-specific terms a skill may name, and the text hermes-tools.md must
// carry to map each one. A term the skills stop using drops out of the check.
const TERMS = [
  ["AskUserQuestion", "`AskUserQuestion`"],
  ["subagent_type", "`subagent_type"],
  ["run_in_background", "`run_in_background: true`"],
  ["TodoWrite", "`TodoWrite`"],
  ["TaskCreate", "`TaskCreate`"],
  ["TaskUpdate", "`TaskUpdate`"],
  ["readonly", "`readonly: true`"],
  ["the `Skill` tool", "the `Skill` tool"],
  ["the `Agent` tool", "the `Agent`/`Task` tool"],
  ["`Read`", "`Read`"],
  ["`loop`", "`loop`"],
  ["/loop", "`/loop`"],
  ["plugin-dev", "`plugin-dev:skill-development`"],
  [".claude/projects", "`~/.claude/projects/"],
  [".claude/skills", "`.claude/skills/`"],
  ["~/.claude/orchestrate", "`~/.claude/orchestrate/`"],
  ["CLAUDE.md", "`CLAUDE.md`"],
  ["mcp__", "`mcp__`"],
  ["pstack:poteto-agent", "`pstack:poteto-agent`"],
  ["pstack:comment-sicko", "`pstack:comment-sicko`"],
  ["general-purpose", "`general-purpose`"],
];

const skillText = markdownFiles(skillsDir)
  .filter((f) => !/\/(codex|copilot|hermes)-tools\.md$/.test(f))
  .map((f) => [relative(skillsDir, f), readFileSync(f, "utf8")]);

describe("hermes-tools.md coverage", () => {
  for (const [term, row] of TERMS) {
    const users = skillText.filter(([, text]) => text.includes(term)).map(([rel]) => rel);
    test(`${term} (${users.length} files) has a Hermes mapping`, () => {
      if (users.length) expect(mapping).toContain(row);
    });
  }

  test("every skill noted for Codex is also noted for Hermes", () => {
    const noted = noteSkills(hermes, mapping);
    const codexNoted = noteSkills(codex, readFileSync(join(repoRoot, codex.tools), "utf8"));
    expect(codexNoted.filter((skill) => !noted.includes(skill))).toEqual([]);
  });
});

describe("Hermes entry points", () => {
  test("poteto-mode's Platform Adaptation names the Hermes mapping", () => {
    const text = readFileSync(join(skillsDir, "poteto-mode/SKILL.md"), "utf8");
    expect(text).toContain("On Hermes Agent, read [`references/hermes-tools.md`](references/hermes-tools.md)");
  });

  test("setup-pstack's runtime table names the Hermes sheet path", () => {
    const text = readFileSync(join(skillsDir, "setup-pstack/SKILL.md"), "utf8");
    expect(text).toContain("| Hermes Agent | `$HERMES_HOME/pstack-models.md`");
  });
});
