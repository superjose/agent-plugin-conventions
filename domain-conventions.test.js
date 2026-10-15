import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, it } from "vitest";
import { RuleTester } from "./test-rule-tester.js";
import { rules } from "./index.js";

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const root = fs.mkdtempSync(path.join(os.tmpdir(), "domain-layout-"));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
for (const file of ["member/member.entity.ts", "school/school.aggregate.ts"]) {
  const filename = path.join(root, "src/domain", file);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, "export {};");
}
const sample = (file, messageId) => ({
  filename: path.join(root, "src", file),
  code: "export {};",
  ...(messageId ? { errors: [{ messageId }] } : {}),
});

tester.run("domain-file-kind", rules["domain-file-kind"], {
  valid: [
    sample("domain/member/member.entity.ts"),
    sample("domain/member/member.entity.test.ts"),
    sample("domain/member/member.entity.integration.spec.ts"),
    sample("domain/school/school.aggregate.ts"),
    sample("domain/school/school.aggregate.test.ts"),
    sample("utils/cookies.ts"),
    sample("context/current-viewer.ts"),
    { filename: "C:\\project\\src\\domain\\member\\member.entity.ts", code: "export {};" },
    { filename: "/project/domain/member/member.entity.ts", code: "export {};" },
  ],
  invalid: [
    {
      filename: "/project/domain/cookies.ts",
      code: "export {};",
      errors: [{ messageId: "filename" }],
    },
    {
      filename: "/project/libs/new/src/domain/cookies.ts",
      code: "export {};",
      errors: [{ messageId: "filename" }],
    },
    ...[
      "cookies.ts",
      "synthetic-identity.test.ts",
      "current-viewer.ts",
      "workspace.value-object.ts",
      "index.ts",
      "member/Member.entity.ts",
      "member/member.entity.helper.ts",
      "member/member.entity.tsx",
      "member/member.entity.d.ts",
    ].map((file) => sample(`domain/${file}`, "filename")),
    {
      filename: "C:\\project\\src\\domain\\cookies.ts",
      code: "export {};",
      errors: [{ messageId: "filename" }],
    },
  ],
});

tester.run("domain-folder", rules["domain-folder"], {
  valid: [
    sample("domain/member/member.entity.ts"),
    sample("domain/member/member.entity.test.ts"),
    sample("domain/member/member.entity.integration.spec.ts"),
    sample("domain/school/school.aggregate.test.ts"),
    sample("domain/cookies.ts"),
    sample("utils/member.entity.ts"),
  ],
  invalid: [
    sample("domain/member.entity.ts", "folder"),
    sample("domain/member.entity.test.ts", "folder"),
    sample("domain/other/member.entity.ts", "folder"),
    sample("domain/school.aggregate.ts", "folder"),
    {
      filename: "/project/domain/member.entity.ts",
      code: "export {};",
      errors: [{ messageId: "folder" }],
    },
    sample("domain/orphan/orphan.entity.test.ts", "missing"),
    sample("domain/orphan/orphan.aggregate.spec.ts", "missing"),
  ],
});
