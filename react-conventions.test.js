import { RuleTester } from "./test-rule-tester.js";
import { describe, it } from "vitest";
import { rules } from "./index.js";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

tester.run("react-component-file", rules["react-component-file"], {
  valid: [
    {
      filename: "/project/components/Button/index.tsx",
      code: "export function Button() { return <button />; }",
    },
    {
      filename: "/project/routes/app.index.tsx",
      code: "export function Page() { return <main />; }",
    },
    {
      filename: "/project/router.tsx",
      code: "export const getRouter = () => ({ routeTree: true });",
    },
    {
      filename: "/project/components/Button/Button.test.tsx",
      code: "export function Harness() { return <button />; }",
    },
  ],
    // Route entries keep framework filenames, but ordinary components do not.
  invalid: [
    {
      filename: "/project/components/Button/Button.tsx",
      code: "export function Button() { return <button />; }",
      errors: [{ messageId: "location" }],
    },
    {
      filename: "/project/components/button.tsx",
      code: "export function Button() { return <button />; }",
      errors: [{ messageId: "location" }],
    },
    {
      filename: "/project/components/States/States.tsx",
      code: [
        "export function EmptyState() { return <p />; }",
        "export function PendingState() { return <p />; }",
      ].join("\n"),
      errors: [{ messageId: "count" }],
    },
    {
      filename: "/project/components/button.test.tsx",
      code: "it('renders', () => {});",
      errors: [{ messageId: "testLocation" }],
    },
  ],
});

tester.run("react-component-input", rules["react-component-input"], {
  valid: [
    {
      filename: "/project/AutosaveStatus.tsx",
      code: [
        "type AutosaveStatusInput = { snapshot: string; retry(): void; discard(): void };",
        "export function AutosaveStatus(input: AutosaveStatusInput) {",
        "  const { snapshot, retry, discard } = input;",
        "  return <button onClick={retry}>{snapshot + String(discard)}</button>;",
        "}",
      ].join("\n"),
    },
    {
      filename: "/project/Message.tsx",
      code: "export function Message({ title, body }: { title: string; body: string }) { return <p>{title}{body}</p>; }",
    },
    {
      filename: "/project/Generic.tsx",
      code: [
        "export type GenericInput<T> = { value: T; label: string; render(value: T): string };",
        "export function Generic<T>(input: GenericInput<T>) { return <p>{input.render(input.value)}</p>; }",
      ].join("\n"),
    },
    {
      filename: "/project/Empty.tsx",
      code: "export function Empty() { return <p />; }",
    },
  ],
  invalid: [
    {
      filename: "/project/AutosaveStatus.tsx",
      code: "export function AutosaveStatus({ snapshot, retry, discard }: { snapshot: string; retry(): void; discard(): void }) { return <p>{snapshot + String(retry) + String(discard)}</p>; }",
      errors: [{ messageId: "input" }],
    },
    {
      filename: "/project/AutosaveStatus.tsx",
      code: "type Props = { snapshot: string; retry(): void; discard(): void }; export function AutosaveStatus(props: Props) { return <p>{props.snapshot}</p>; }",
      errors: [{ messageId: "input" }],
    },
  ],
});

tester.run("configured route directories", rules["react-component-file"], {
  valid: [
    { filename: "/project/apps/mobile/app/(tabs)/[id].tsx", options: [{ routeDirectories: ["apps/mobile/app"] }], code: "export default function Detail() { return <main />; }" },
    { filename: "C:\\project\\apps\\mobile\\app\\_layout.tsx", options: [{ routeDirectories: ["apps/mobile/app"] }], code: "export default function Layout() { return <main />; }" },
    { filename: "/project/apps/mobile/app/+not-found.tsx", options: [{ routeDirectories: ["apps/mobile/app"] }], code: "export default function Missing() { return <main />; }" },
  ],
  invalid: [
    { filename: "/project/apps/mobile/app/Button.tsx", options: [{ routeDirectories: ["apps/mobile/app"] }], code: "export function Button() { return <button />; }", errors: [{ messageId: "location" }] },
    { filename: "/project/apps/mobile/application/home.tsx", options: [{ routeDirectories: ["apps/mobile/app"] }], code: "export default function Home() { return <main />; }", errors: [{ messageId: "location" }] },
    { filename: "/project/apps/mobile/app/home.tsx", code: "export default function Home() { return <main />; }", errors: [{ messageId: "location" }] },
  ],
});
