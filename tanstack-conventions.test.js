import { RuleTester } from "./test-rule-tester.js";
import { describe, it } from "vitest";
import { rules } from "./index.js";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("tanstack-middleware-file", rules["tanstack-middleware-file"], {
  valid: [
    { filename: "/project/src/server/middleware/auth.middleware.ts", code: "export {};" },
    {
      filename: "/project/src/server/middleware/auth.middleware.test.ts",
      code: "export {};",
    },
    {
      filename: "/project/src/server/middleware/nested/request-id.middleware.spec.ts",
      code: "export {};",
    },
    { filename: "/project/src/server/auth.ts", code: "export {};" },
  ],
  invalid: [
    {
      filename: "/project/src/server/middleware/auth-middleware.ts",
      code: "export {};",
      errors: [{ messageId: "filename" }],
    },
    {
      filename: "/project/src/server/middleware/auth.test.ts",
      code: "export {};",
      errors: [{ messageId: "filename" }],
    },
    {
      filename: "/project/src/server/middleware/Auth.middleware.ts",
      code: "export {};",
      errors: [{ messageId: "filename" }],
    },
  ],
});
