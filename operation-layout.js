import fs from "node:fs";
import path from "node:path";

export const operationFile = (filename) =>
  /^(?<stem>[^/]+)\.(?<kind>command|query)(?:\.(?<labels>[a-z-]+(?:\.[a-z-]+)*))?\.ts$/.exec(
    path.posix.basename(filename.replaceAll("\\", "/")),
  )?.groups;
export const operationName = ({ stem, kind }) =>
  stem
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("") + (kind === "command" ? "Command" : "Query");
const companion = (file) => file?.labels && /(?:^|\.)(?:test|spec|helper)$/.test(file.labels);

export const operationFolder = {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      folder: "Place {{operation}} and its tests/helpers together in a {{stem}}/ folder.",
      missing: "Companion files require the matching operation beside them: {{operation}}.",
      name: "Use the matching operation’s kebab-case stem for this companion filename.",
    },
  },
  create(context) {
    return {
      Program(node) {
        const filename = context.filename.replaceAll("\\", "/");
        const file = operationFile(filename);
        if (!file || (file.labels && !companion(file))) return;
        if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(file.stem)) {
          context.report({ node, messageId: "name" });
          return;
        }
        const directory = path.dirname(filename);
        const operation = `${file.stem}.${file.kind}.ts`;
        const isCompanion = companion(file);
        const entries = fs.existsSync(directory)
          ? fs.readdirSync(directory, { withFileTypes: true })
          : [];
        const hasCompanions = entries.some((entry) => {
          const other = operationFile(entry.name);
          return (
            entry.isFile() &&
            other?.stem === file.stem &&
            other.kind === file.kind &&
            companion(other)
          );
        });
        if ((isCompanion || hasCompanions) && path.basename(directory) !== file.stem) {
          context.report({ node, messageId: "folder", data: { operation, stem: file.stem } });
        } else if (
          isCompanion &&
          !fs.statSync(path.join(directory, operation), { throwIfNoEntry: false })?.isFile()
        ) {
          context.report({ node, messageId: "missing", data: { operation } });
        }
      },
    };
  },
};

// A test's callable operation imports must all belong to its filename's owner.
// Named imports retain identity even when locally aliased or imported via barrels.
export const operationTestOwner = {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      filename:
        "Operation tests must be named <operation>.command[.<label>].test.ts or <operation>.query[.<label>].test.ts and test only that operation. Shared fixtures must not import operations.",
      foreign: "This test belongs to {{owner}}. Test {{imported}} in its own operation test file.",
      dynamic: "Use a static module path so this test's operation ownership can be checked.",
    },
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");
    const isTest = /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(filename);
    const isFixture = filename.endsWith(".test-fixtures.ts");
    if (!isTest && !isFixture) return {};
    const file = operationFile(filename);
    const owner =
      file &&
      /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(file.stem) &&
      /(?:^|\.)(?:test|spec)$/.test(file.labels ?? "")
        ? operationName(file)
        : null;
    const references = [];
    const sourceOwner = (value) => {
      const normalized = value.replaceAll("\\", "/").replace(/\.[cm]?[jt]sx?$/, "");
      const found = operationFile(normalized + ".ts");
      return found && (!found.labels || /(?:^|\.)helper$/.test(found.labels))
        ? operationName(found)
        : null;
    };
    const addSource = (node, source) => {
      if (typeof source !== "string") {
        if (owner) context.report({ node, messageId: "dynamic" });
        return;
      }
      const name = sourceOwner(source);
      if (name) references.push({ node, name });
    };
    return {
      ImportDeclaration(node) {
        if (node.importKind === "type") return;
        const values = node.specifiers.filter((spec) => spec.importKind !== "type");
        for (const spec of values) {
          const name = spec.imported?.name ?? spec.imported?.value;
          if (/^[A-Z]\w*(?:Command|Query)$/.test(name ?? "")) references.push({ node: spec, name });
        }
        if (
          values.length === 0 ||
          values.some((spec) => spec.type !== "ImportSpecifier") ||
          /\.helper(?:\.ts)?$/.test(node.source.value)
        )
          addSource(node, node.source.value);
      },
      VariableDeclarator(node) {
        if (node.id.type !== "ObjectPattern") return;
        for (const property of node.id.properties) {
          const name = property.key?.name ?? property.key?.value;
          if (/^[A-Z]\w*(?:Command|Query)$/.test(name ?? ""))
            references.push({ node: property, name });
        }
      },
      MemberExpression(node) {
        const name = node.computed ? node.property.value : node.property.name;
        if (/^[A-Z]\w*(?:Command|Query)$/.test(name ?? "")) references.push({ node, name });
      },
      ImportExpression(node) {
        addSource(node, node.source.value);
      },
      CallExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "require")
          addSource(node, node.arguments[0]?.value);
      },
      "Program:exit"(node) {
        if (!references.length) return;
        if (!owner) {
          context.report({ node, messageId: "filename" });
          return;
        }
        const reported = new Set();
        for (const ref of references)
          if (ref.name !== owner && !reported.has(ref.name)) {
            context.report({
              node: ref.node,
              messageId: "foreign",
              data: { owner, imported: ref.name },
            });
            reported.add(ref.name);
          }
      },
    };
  },
};
