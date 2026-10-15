# agent-plugin-conventions

Shared architecture conventions for Oxlint and ESLint. MIT licensed; no runtime dependencies.

## Install

Initially install from GitHub using an immutable commit SHA:

```sh
pnpm add -Dw '@superjose/agent-plugin-conventions@git+https://github.com/superjose/agent-plugin-conventions.git#<FULL_COMMIT_SHA>'
```

For a non-workspace project, omit `-w`. After npm publication, use
`pnpm add -D @superjose/agent-plugin-conventions` instead.

## Oxlint

Register the plugin with an explicit alias. Enable individual rules or extend an optional rules-only preset:

```json
{
  "jsPlugins": [{ "name": "conventions", "specifier": "@superjose/agent-plugin-conventions" }],
  "extends": ["./node_modules/@superjose/agent-plugin-conventions/oxlint/all.json"],
  "rules": { "conventions/react-component-input": "off" }
}
```

Presets: `domain`, `operations`, `effect`, `react`, `tanstack`, `all`.
Each enables its rules at error severity. `operations` covers naming, one operation per file,
folder layout and test ownership. `effect` separately requires named `Effect.fn` initializers.
`all` enables all ten rules. Project settings, ignores, and built-in plugins remain project-owned.

## ESLint

```js
import conventions from "@superjose/agent-plugin-conventions";
export default [conventions.configs.operations, conventions.configs.effect];
```

Configure `@typescript-eslint/parser` and appropriate file globs in the consuming project
for TypeScript/TSX. The plugin does not supply a parser. The same preset names are available
under `configs`; `rules` and `configs` also have named exports. Override a rule in a later config.

## Development

Use Node 22 and pnpm 11.5.0. `pnpm install --frozen-lockfile`, `pnpm test`, and
`pnpm validate:package` validate both runners and a packed, isolated consumer.
Oxlint is pinned to 1.71.0 because its JS plugin API is alpha. ESLint 9 and the
TypeScript parser versions are locked in pnpm-lock.yaml. Upgrade alongside tests.

To test local edits in a sibling project:

```sh
# Install dependencies in this repository first.
pnpm install
# From Notaflash or Senfi:
pnpm link ../agent-plugin-conventions
# When finished, restore the committed dependency:
pnpm install --frozen-lockfile
```

Inspect the consumer manifest and lockfile after linking and restore only link-related
changes if pnpm recorded an override. Never commit a machine-specific link.
Filesystem rules read neighboring files on each lint run; they require actual files on disk.
Rules use syntax and import bindings, not TypeScript type information.

## Releases and npm bootstrap

GitHub releases are initially consumed by full commit SHA. For a release, update package
version and changelog, pass CI, commit, tag `v<version>` and publish GitHub release notes.
The plugin reads its version from package metadata.

npm publication is deferred. An owner must log in, establish permission for the
`@superjose` npm scope, and publish the first version with `npm publish --access public`.
Before doing so, pack and validate the exact release. Then configure npm trusted publishing
for this GitHub repository and add a release workflow with `id-token: write`, a supported
Node/npm runtime, CI checks, and `npm publish --provenance --access public`.
Switch consumers to an exact npm version and commit their updated lockfiles.
No unusable npm publishing workflow or credentials are included in this release.

## Contract

```ts
// get-scores.query.ts
import { Effect } from "effect";

export type GetScoresInput = { readonly classId: string };
export const GetScoresQuery = Effect.fn("GetScoresQuery")(function* (input: GetScoresInput) {
  // ...
});
```

- `operation-name`: require kebab-case `.command.ts` / `.query.ts` filenames and
  matching PascalCase variable and export names, including the `Command` / `Query`
  suffix. Local named exports are supported; default exports are rejected.
- `single-operation`: require exactly one exported operation function. Supporting
  types, interfaces, and constants are allowed. Other exported functions, runtime
  classes/enums/namespaces, and mutable variables belong in separate helper files.
  Private helper functions are allowed.
- `operation-effect-fn`: require a `const` initialized directly by
  `Effect.fn("ExactExportName")(…)`. Both generators and ordinary function bodies
  work. Effect import aliases and namespace imports are resolved by binding;
  unrelated variables called `Effect` do not qualify.

Operation files are recognized by their filename. In other files, exported names
ending in `Command` / `Query` identify operations; inside `commands` / `queries`,
exported Effect.fn functions also identify operations. Ordinary helper functions
are allowed in those folders. Exported Effect.fn helpers must use an owned
`.command.helper.ts` / `.query.helper.ts` file or live outside those folders.
The implementation rules exclude tests (`.test.*` / `.spec.*`), helpers,
declaration files, and `.command.service.*` /
`.query.service.*` aggregation files are excluded. Barrel re-exports are allowed outside operation files. Wildcard value re-exports
inside operation files are rejected because their operation count is unknown.
Existing root ignore patterns still apply.

These checks use syntax and import bindings, not TypeScript type information.
They cannot infer whether an arbitrary helper call returns a function or whether
an ordinary camelCase function in an incorrectly named file is an operation.
Rules do not rename symbols, split files, or offer automatic fixes.

## Development

Run `pnpm --filter oxlint-plugin-conventions test` and
`pnpm --filter oxlint-plugin-conventions lint`. Tests use `oxlint/plugins-dev`
RuleTester with Vitest. Oxlint is pinned to 1.71.0 while its plugin API is alpha;
upgrade it alongside the rule tests. The standard ESLint-compatible `create` API
keeps per-file state isolated without a runtime helper package.

## Operation folders and test ownership

An operation may remain flat until it has a test or helper. Then put its
implementation and all companions in a folder named after its kebab-case stem:

```text
commands/
  set-active-organization.command.ts
  set-bulletin-comment/
    set-bulletin-comment.command.ts
    set-bulletin-comment.command.test.ts
    set-bulletin-comment.command.integration.test.ts
    set-bulletin-comment.command.helper.ts
```

- `operation-folder`: require this grouping when a companion exists, and require
  the matching implementation beside every companion. It checks sibling files
  on disk on each lint run, without retaining directory caches between runs.
- `operation-test-owner`: each test file belongs to one command or query. Runtime
  operation imports must match the filename, including aliased named imports,
  namespace members, static dynamic imports, `require`, and operation helper
  imports. Type-only imports are allowed. Computed module paths in operation
  tests are rejected because their ownership cannot be checked.
- Descriptors such as `.integration.test.ts` and `.transaction.test.ts` are
  allowed. `.spec.ts` is also supported.
- Shared fixtures live in `testing/*.test-fixtures.ts`, provide setup/data only,
  and may not import operations. Shared implementation helpers can remain at the
  commands/queries level. Helpers specific to one operation use its
  `.command.helper.ts` / `.query.helper.ts` suffix and live beside it.

Generic `commands.test.ts` / `queries.test.ts` files cannot import operations.
Split their assertions by owner, including workflow integration tests. Seed
state through repositories or database fixtures instead of invoking a second
operation in the test. These syntax checks cannot prove what arbitrary imported
functions do internally; keep shared fixtures free of operation calls.

The first three implementation rules exclude operation helper files, so helpers
can export multiple functions and use their own Effect.fn trace names. The
folder rule still applies to those files. Run the package/repository lint command
to inspect all companions after adding or moving files; file moves have no
automatic fix because imports and test ownership must be updated together.

## React components

Each exported React component lives in a PascalCase folder and matching file:

```text
components/molecules/AutosaveStatus/
  AutosaveStatus.tsx
  AutosaveStatus.test.tsx
```

- `react-component-file` requires one exported JSX component per implementation
  file and the `ComponentName/ComponentName.tsx` layout. Private subcomponents
  may remain in the file. Component tests use `ComponentName.test.tsx` or
  `ComponentName.spec.tsx` in the same folder. TanStack file-route entrypoints
  are exempt from the layout check.
- `react-component-input` applies to public and private JSX components. With
  three or more props, use a named `ComponentNameInput` type and a single
  `input: ComponentNameInput` parameter. The type may be private or exported;
  destructure inside the function body when useful. Components with zero, one,
  or two props keep their existing parameter style.

These rules recognize components syntactically by a PascalCase function name
whose body contains JSX. They do not use TypeScript type information.

## TanStack server middleware

`tanstack-middleware-file` requires every TypeScript file below a
`server/middleware` folder to identify its role in the filename:

```text
server/middleware/
  env.middleware.ts
  error.middleware.ts
  error.middleware.test.ts
```

Implementation files end in `.middleware.ts`; tests and specs place their test
suffix after `.middleware`. Stems use kebab-case, and nested middleware folders
follow the same convention.

## Domain files

`domain-file-kind` and `domain-folder` apply to every `domain/` folder, at any
depth, and enforce this layout:

```text
src/
  domain/
    member/
      member.entity.ts
      member.entity.test.ts
    school/
      school.aggregate.ts
      school.aggregate.test.ts
  utils/
    cookies.ts
    synthetic-identity.ts
```

- `domain-file-kind`: allow only kebab-case `.entity.ts` and `.aggregate.ts`
  implementations and their matching `.test.ts` / `.spec.ts` companions.
  Test descriptors such as `.integration.test.ts` are supported. Domain barrels,
  standalone types, exceptions, utilities, value objects, and helper files are
  rejected. Supporting types/private helpers may stay in the owning implementation;
  shared types and exceptions live outside `domain`.
- `domain-folder`: every implementation, even without tests, must live in a
  folder matching its filename stem. Every test must have a matching implementation
  beside it. These checks read the filesystem without caching directory state.


Lint checks syntax and layout, not semantic domain roles. File moves have no automatic fix.
