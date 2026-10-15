import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, it } from "vitest";
import { RuleTester } from "./test-rule-tester.js";
import { rules } from "./index.js";

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const root = fs.mkdtempSync(path.join(os.tmpdir(), "operation-layout-"));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
const tree = (name, files) => {
  const directory = path.join(root, name);
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    fs.writeFileSync(path.join(directory, file), "export {};");
  }
  return (file) => path.join(directory, file);
};
const flat = tree("flat", ["commands/save.command.ts"]);
const flatCompanions = tree("flat-companions", [
  "commands/save.command.ts",
  "commands/save.command.test.ts",
  "commands/save.command.helper.ts",
]);
const grouped = tree("grouped", [
  "commands/save/save.command.ts",
  "commands/save/save.command.test.ts",
  "commands/save/save.command.integration.test.ts",
  "commands/save/save.command.helper.ts",
]);
const orphan = tree("orphan", ["commands/save/save.command.test.ts"]);
const misplaced = tree("misplaced", [
  "commands/other/save.command.test.ts",
  "commands/other/save.command.ts",
]);
const query = tree("query", ["queries/list/list.query.ts", "queries/list/list.query.spec.ts"]);
const named = (filename, messageId) => ({
  filename,
  code: "export {};",
  ...(messageId ? { errors: [{ messageId }] } : {}),
});

tester.run("operation-folder", rules["operation-folder"], {
  valid: [
    named(flat("commands/save.command.ts")),
    named(grouped("commands/save/save.command.ts")),
    named(grouped("commands/save/save.command.test.ts")),
    named(grouped("commands/save/save.command.integration.test.ts")),
    named(grouped("commands/save/save.command.helper.ts")),
    named(query("queries/list/list.query.spec.ts")),
    named(flat("commands/shared.test.ts")),
    named(flat("commands/score.command.service.ts")),
  ],
  invalid: [
    named(flatCompanions("commands/save.command.ts"), "folder"),
    named(flatCompanions("commands/save.command.test.ts"), "folder"),
    named(flatCompanions("commands/save.command.helper.ts"), "folder"),
    named(orphan("commands/save/save.command.test.ts"), "missing"),
    named(misplaced("commands/other/save.command.test.ts"), "folder"),
    named(flat("commands/saveScores.command.helper.ts"), "name"),
  ],
});
const owner = "/project/commands/save/save.command.test.ts";
const test = (code, filename = owner, messageId) => ({
  filename,
  code,
  ...(messageId ? { errors: [{ messageId }] } : {}),
});
tester.run("operation-test-owner", rules["operation-test-owner"], {
  valid: [
    test('import { SaveCommand } from "./save.command"; SaveCommand({});'),
    test('import { SaveCommand as run } from "@shared/commands"; run({});'),
    test('import type { OtherCommand } from "@shared/commands";'),
    test('import { type OtherQuery, SaveCommand } from "@shared/commands"; SaveCommand({});'),
    test('import { run } from "./save.command.helper"; run({});'),
    test('import * as operation from "./save.command"; operation.SaveCommand({});'),
    test('const operation = await import("./save.command"); operation.SaveCommand({});'),
    test('const operation = require("./save.command"); operation.SaveCommand({});'),
    test(
      'import { OtherCommand } from "./other.command";',
      "/project/commands/save/save.command.ts",
    ),
    test('import { setup } from "../../testing/command.test-fixtures"; setup();'),
    test('import { Effect } from "effect";', "/project/testing/command.test-fixtures.ts"),
    test(
      'import { ListQuery } from "./list.query";',
      "/project/queries/list/list.query.integration.test.ts",
    ),
  ],
  invalid: [
    test('import { SaveCommand, OtherCommand } from "@shared/commands";', owner, "foreign"),
    test('import { OtherCommand as SaveCommand } from "@shared/commands";', owner, "foreign"),
    test('import { run } from "../other/other.command.helper";', owner, "foreign"),
    test('import * as other from "../other/other.command";', owner, "foreign"),
    test('await import("../other/other.command");', owner, "foreign"),
    test('require("../other/other.command");', owner, "foreign"),
    test(
      'import { SaveCommand } from "./save.command";',
      "/project/commands/commands.test.ts",
      "filename",
    ),
    test(
      'import { SaveCommand } from "../commands/save.command";',
      "/project/testing/command.test-fixtures.ts",
      "filename",
    ),
    test("await import(modulePath);", owner, "dynamic"),
    test("require(modulePath);", owner, "dynamic"),
    test(
      'import * as operations from "@shared/commands"; operations.OtherCommand();',
      owner,
      "foreign",
    ),
    test(
      'import * as operations from "@shared/commands"; operations["OtherQuery"]();',
      owner,
      "foreign",
    ),
    test(
      'const { OtherCommand: run } = await import("@shared/commands"); run();',
      owner,
      "foreign",
    ),
  ],
});

// Helpers remain free to export multiple helper functions, including Effect.fn helpers.
for (const rule of ["operation-name", "single-operation", "operation-effect-fn"]) {
  tester.run(`${rule} helper exclusion`, rules[rule], {
    valid: [
      {
        filename: "/project/commands/save/save.command.helper.ts",
        code: 'import { Effect } from "effect"; export const prepare = Effect.fn("prepare")(() => Effect.void); export const persist = () => Effect.void;',
      },
    ],
    invalid: [],
  });
}

// An arbitrary .helper.ts suffix must not bypass operation naming enforcement.
tester.run("unowned helper cannot hide an operation", rules["operation-name"], {
  valid: [],
  invalid: [
    {
      filename: "/project/commands/save.helper.ts",
      code: 'import { Effect } from "effect"; export const SaveCommand = Effect.fn("SaveCommand")(() => Effect.void);',
      errors: [{ messageId: "filename" }],
    },
  ],
});
