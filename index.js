import path from "node:path";
import { readFileSync } from "node:fs";
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
import { domainFileKind, domainFolder } from "./domain-conventions.js";
import { operationFolder, operationTestOwner } from "./operation-layout.js";
import { reactComponentFile, reactComponentInput } from "./react-conventions.js";
import { tanstackMiddlewareFile } from "./tanstack-conventions.js";

const unwrap = (node) => {
  while (
    node &&
    [
      "TSAsExpression",
      "TSSatisfiesExpression",
      "TSNonNullExpression",
      "ParenthesizedExpression",
    ].includes(node.type)
  )
    node = node.expression;
  return node;
};
const functionNode = (node) =>
  ["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"].includes(
    unwrap(node)?.type,
  );
const suffixKind = (name) => /^[A-Z][A-Za-z0-9]*(Command|Query)$/.exec(name)?.[1]?.toLowerCase();

// Resolve the actual import binding, including aliases and shadowed identifiers.
function imported(context, node, importedName) {
  if (node?.type !== "Identifier") return false;
  let scope = context.sourceCode.getScope(node);
  while (scope) {
    const variable = scope.set.get(node.name);
    if (variable)
      return variable.defs.some((def) => {
        const spec = def.node;
        if (def.parent?.source?.value !== "effect") return false;
        return (
          (spec.type === "ImportSpecifier" && spec.imported.name === importedName) ||
          (spec.type === "ImportNamespaceSpecifier" && importedName === "*")
        );
      });
    scope = scope.upper;
  }
  return false;
}
function effectFn(context, node) {
  node = unwrap(node);
  if (node?.type !== "CallExpression") return null;
  const factory = unwrap(node.callee);
  if (factory?.type !== "CallExpression") return null;
  const member = unwrap(factory.callee);
  if (member?.type !== "MemberExpression" || member.computed || member.property.name !== "fn")
    return null;
  const object = unwrap(member.object);
  const isEffect =
    imported(context, object, "Effect") ||
    (object?.type === "MemberExpression" &&
      !object.computed &&
      object.property.name === "Effect" &&
      imported(context, object.object, "*"));
  return isEffect ? factory : null;
}
function analyze(context, program) {
  const filename = context.filename.replaceAll("\\", "/");
  if (
    /\.(?:test|spec)\.[cm]?[jt]sx?$|\.(?:command|query)(?:\.[a-z-]+)*\.helper\.ts$|\.d\.[cm]?ts$|\.(?:command|query)\.service\.[cm]?[jt]s$/.test(
      filename,
    )
  )
    return null;
  const basename = path.posix.basename(filename);
  const match = /^(.*)\.(command|query)\.[cm]?[jt]sx?$/.exec(basename);
  const folder = /\/(commands|queries)\//.exec(filename)?.[1];
  const locals = new Map();
  for (const statement of program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (declaration?.type === "VariableDeclaration")
      for (const item of declaration.declarations) {
        if (item.id.type === "Identifier")
          locals.set(item.id.name, {
            node: item,
            localName: item.id.name,
            init: item.init,
            constant: declaration.kind === "const",
          });
      }
    if (declaration?.type === "FunctionDeclaration")
      locals.set(declaration.id.name, {
        node: declaration,
        localName: declaration.id.name,
        init: declaration,
      });
  }
  const exports = [];
  const unsupported = [];
  for (const statement of program.body) {
    if (match && statement.type === "ExportAllDeclaration" && statement.exportKind !== "type")
      unsupported.push(statement);
    if (statement.type === "ExportDefaultDeclaration")
      exports.push({ name: "default", node: statement, init: statement.declaration });
    if (statement.type !== "ExportNamedDeclaration" || statement.exportKind === "type") continue;
    if (
      ["ClassDeclaration", "TSEnumDeclaration", "TSModuleDeclaration"].includes(
        statement.declaration?.type,
      )
    )
      unsupported.push(statement);
    if (
      statement.declaration?.type === "VariableDeclaration" &&
      statement.declaration.kind !== "const"
    )
      unsupported.push(statement);
    if (statement.declaration?.type === "VariableDeclaration") {
      for (const item of statement.declaration.declarations) {
        if (item.id.type === "Identifier")
          exports.push({ name: item.id.name, ...locals.get(item.id.name) });
      }
    } else if (statement.declaration?.type === "FunctionDeclaration") {
      const name = statement.declaration.id.name;
      exports.push({ name, ...locals.get(name) });
    }
    for (const spec of statement.specifiers) {
      if (
        spec.exportKind === "type" ||
        (!match && (statement.source || !locals.has(spec.local.name)))
      )
        continue;
      exports.push({
        name: spec.exported.name ?? spec.exported.value,
        node: spec,
        ...(!statement.source && locals.get(spec.local.name)),
      });
    }
  }
  const operations = exports.filter(
    (item) => suffixKind(item.name) || (folder && effectFn(context, item.init)),
  );
  if (!match && operations.length === 0) return null;
  const functions = exports.filter(
    (item) =>
      functionNode(item.init) ||
      effectFn(context, item.init) ||
      suffixKind(item.name) ||
      item.name === "default",
  );
  const kind =
    match?.[2] ??
    (folder === "commands"
      ? "command"
      : folder === "queries"
        ? "query"
        : suffixKind(operations[0]?.name));
  const stem = match?.[1];
  const expected =
    stem
      ?.split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("") + (kind === "command" ? "Command" : "Query");
  return { basename, match, kind, expected, functions, stem, unsupported };
}
function rule(description, messages, check) {
  return {
    meta: { type: "suggestion", docs: { description }, schema: [], messages },
    create(context) {
      return {
        "Program:exit"(program) {
          const info = analyze(context, program);
          if (info) check(context, program, info);
        },
      };
    },
  };
}
export const rules = {
  "domain-file-kind": domainFileKind,
  "domain-folder": domainFolder,
  "tanstack-middleware-file": tanstackMiddlewareFile,
  "react-component-file": reactComponentFile,
  "react-component-input": reactComponentInput,
  "operation-folder": operationFolder,
  "operation-test-owner": operationTestOwner,
  "operation-name": rule(
    "Match command/query filenames and exported names",
    {
      filename: "Use a kebab-case filename ending in .{{kind}}.ts for this operation.",
      name: "Export this operation as {{expected}} to match its filename.",
    },
    (context, program, info) => {
      if (
        !info.match ||
        !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(info.stem) ||
        !info.basename.endsWith(`.${info.kind}.ts`)
      ) {
        context.report({ node: program, messageId: "filename", data: { kind: info.kind } });
        return;
      }
      for (const item of info.functions)
        if (item.name !== info.expected || (item.localName && item.localName !== info.expected))
          context.report({ node: item.node, messageId: "name", data: { expected: info.expected } });
    },
  ),
  "single-operation": rule(
    "Export exactly one operation, plus supporting types and constants",
    {
      supporting:
        "Supporting exports must be explicit types or constants. Move runtime classes, enums, namespaces, mutable bindings, and wildcard value re-exports to separate files.",
      count:
        "Export exactly one command/query function; found {{count}}. Split additional operations or move exported helpers to separate files.",
    },
    (context, program, info) => {
      for (const node of info.unsupported) context.report({ node, messageId: "supporting" });
      if (info.functions.length !== 1)
        context.report({
          node: program,
          messageId: "count",
          data: { count: String(info.functions.length) },
        });
    },
  ),
  "operation-effect-fn": rule(
    "Initialize operations directly with a matching named Effect.fn",
    {
      initializer:
        'Declare export const {{name}} = Effect.fn("{{name}}")(…); use the Effect import from "effect".',
    },
    (context, _program, info) => {
      for (const item of info.functions) {
        const factory = effectFn(context, item.init);
        if (
          !item.constant ||
          !factory ||
          factory.arguments.length !== 1 ||
          factory.arguments[0].type !== "Literal" ||
          factory.arguments[0].value !== item.name
        ) {
          context.report({ node: item.node, messageId: "initializer", data: { name: item.name } });
        }
      }
    },
  ),
};
const plugin = { meta: { name: "conventions", version }, rules, configs: {} };
for (const name of ["domain", "operations", "effect", "react", "tanstack", "all"]) {
  const preset = JSON.parse(readFileSync(new URL(`./oxlint/${name}.json`, import.meta.url), "utf8"));
  plugin.configs[name] = { plugins: { conventions: plugin }, rules: preset.rules };
}
export const configs = plugin.configs;
export default plugin;
