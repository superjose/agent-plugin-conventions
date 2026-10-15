import { RuleTester } from "./test-rule-tester.js";
import { describe, it } from "vitest";
import { rules } from "./index.js";

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const filename = "/project/src/commands/set-scores.command.ts";
const prelude = 'import { Effect } from "effect";\n';
const operation = 'export const SetScoresCommand = Effect.fn("SetScoresCommand")(function* () {});';
const example = (code, file = filename) => ({ filename: file, code: prelude + code });
const failure = (code, messageId, file = filename) => ({
  ...example(code, file),
  errors: [{ messageId }],
});

tester.run("operation-name", rules["operation-name"], {
  valid: [
    example(operation),
    example(
      'export const GetScoresQuery = Effect.fn("GetScoresQuery")(() => Effect.void);',
      "/p/queries/get-scores.query.ts",
    ),
    example("export const helper = () => Effect.void;", "/p/commands/helper.ts"),
    example(
      'export const helper = Effect.fn("helper")(() => Effect.void);',
      "/p/internal/helper.ts",
    ),
    example(operation, "/p/commands/example.command.test.ts"),
    example(operation, "/p/queries/example.query.spec.ts"),
    example("export declare const ExampleCommand: unknown;", "/p/example.d.ts"),
    example(
      'export const Service = Effect.fn("Service")(() => Effect.void);',
      "/p/x.command.service.ts",
    ),
    example('export { SetScoresCommand } from "./set-scores.command";', "/p/index.ts"),
  ],
  invalid: [
    failure('export const setScores = Effect.fn("setScores")(() => Effect.void);', "name"),
    failure(operation, "filename", "/p/commands/set-scores.ts"),
    failure(operation, "filename", "/p/set-scores.ts"),
    failure(operation, "filename", "/p/commands/setScores.command.ts"),
    failure(operation, "filename", "/p/commands/set-scores.command.tsx"),
    failure(
      'export const getScores = Effect.fn("getScores")(() => Effect.void);',
      "filename",
      "/p/queries/get-scores.ts",
    ),
    {
      filename: "/p/commands/helper.ts",
      code: 'import { Effect as Fx } from "effect"; export const helper = Fx.fn("helper")(() => Fx.void);',
      errors: [{ messageId: "filename" }],
    },
  ],
});

tester.run("operation-name edge cases", rules["operation-name"], {
  valid: [
    example(
      'import { SetScoresCommand } from "./set-scores.command"; export { SetScoresCommand };',
      "/p/index.ts",
    ),
    {
      filename: "/p/commands/helper.ts",
      code: 'const Effect = { fn: () => () => 1 }; export const helper = Effect.fn("helper")(() => 1);',
    },
    example("export type MissingCommand = string;", "/p/types.ts"),
    example(operation, "C:\\project\\commands\\set-scores.command.ts"),
  ],
  invalid: [
    failure(
      'const local = Effect.fn("SetScoresCommand")(() => Effect.void); export { local as SetScoresCommand };',
      "name",
    ),
  ],
});

tester.run("supporting exports", rules["single-operation"], {
  valid: [example(operation + '\nconst helper = Effect.fn("helper")(() => Effect.void);')],
  invalid: [
    failure(operation + "\nexport class Helper {}", "supporting"),
    failure(operation + "\nexport let LIMIT = 10;", "supporting"),
    failure(operation + "\nexport enum Mode { A }", "supporting"),
    failure(operation + '\nexport * from "./other";', "supporting"),
  ],
});

tester.run("single-operation", rules["single-operation"], {
  valid: [
    example(operation),
    example(
      operation +
        "\nexport type Input = { value: number }; export interface Result { value: number } export const LIMIT = 10; const helper = () => 1;",
    ),
    example(
      operation + '\nexport type { Input } from "./types"; export { LIMIT } from "./constants";',
    ),
    example(
      'const SetScoresCommand = Effect.fn("SetScoresCommand")(() => Effect.void); export { SetScoresCommand };',
    ),
    example("export const helper = () => Effect.void;", "/p/commands/helper.ts"),
  ],
  invalid: [
    failure("export type Input = string;", "count"),
    failure(
      operation + '\nexport const OtherCommand = Effect.fn("OtherCommand")(() => Effect.void);',
      "count",
    ),
    failure(operation + "\nexport function helper() {}", "count"),
    failure(operation + "\nconst helper = () => 1; export { helper };", "count"),
    failure(operation + "\nexport default () => 1;", "count"),
  ],
});

tester.run("operation-effect-fn", rules["operation-effect-fn"], {
  valid: [
    example(operation),
    {
      filename,
      code: 'import { Effect as Fx } from "effect"; export const SetScoresCommand = Fx.fn("SetScoresCommand")(() => Fx.void);',
    },
    {
      filename,
      code: 'import * as FX from "effect"; export const SetScoresCommand = FX.Effect.fn("SetScoresCommand")(() => FX.Effect.void);',
    },
    example(
      'const SetScoresCommand = Effect.fn("SetScoresCommand")(() => Effect.void); export { SetScoresCommand };',
    ),
    example(
      'export const SetScoresCommand = (Effect.fn("SetScoresCommand")(() => Effect.void)) satisfies unknown;',
    ),
  ],
  invalid: [
    failure("export const SetScoresCommand = () => Effect.void;", "initializer"),
    failure(
      'export const SetScoresCommand = Effect.fn("wrong")(() => Effect.void);',
      "initializer",
    ),
    failure("export const SetScoresCommand = Effect.fn()(() => Effect.void);", "initializer"),
    failure(
      "export const SetScoresCommand = Effect.fn(`SetScoresCommand`)(() => Effect.void);",
      "initializer",
    ),
    failure(
      'export const SetScoresCommand = wrap(Effect.fn("SetScoresCommand")(() => Effect.void));',
      "initializer",
    ),
    failure(
      'export let SetScoresCommand = Effect.fn("SetScoresCommand")(() => Effect.void);',
      "initializer",
    ),
    failure("export function SetScoresCommand() {}", "initializer"),
    {
      filename,
      code: 'import { Effect } from "other"; export const SetScoresCommand = Effect.fn("SetScoresCommand")(() => 1);',
      errors: [{ messageId: "initializer" }],
    },
    {
      filename,
      code: 'const Effect = { fn: () => () => 1 }; export const SetScoresCommand = Effect.fn("SetScoresCommand")(() => 1);',
      errors: [{ messageId: "initializer" }],
    },
  ],
});
