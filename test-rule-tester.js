import { RuleTester as OxlintRuleTester } from "oxlint/plugins-dev";
import { RuleTester as ESLintRuleTester } from "eslint";
import * as parser from "@typescript-eslint/parser";
const Base = process.env.CONVENTIONS_TEST_RUNNER === "eslint" ? ESLintRuleTester : OxlintRuleTester;
export class RuleTester extends Base {
  constructor(options) {
    if (Base === ESLintRuleTester) {
      const { lang, ...parserOptions } = options.languageOptions.parserOptions;
      super({ languageOptions: { parser, parserOptions: { ...parserOptions, ecmaFeatures: { jsx: lang === "tsx" } } } });
    } else super(options);
  }
}
