import fs from "node:fs";
import path from "node:path";

const domainFile = (filename) => {
  const normalized = filename.replaceAll("\\", "/");
  if (!normalized.includes("/domain/")) return null;
  return {
    filename: normalized,
    match:
      /^(?<stem>[a-z][a-z0-9]*(?:-[a-z0-9]+)*)\.(?<kind>entity|aggregate)(?<test>\.(?:[a-z0-9-]+\.)*(?:test|spec))?\.ts$/.exec(
        path.posix.basename(normalized),
      )?.groups,
  };
};

export const domainFileKind = {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      filename:
        "Domain files must use <name>.entity.ts or <name>.aggregate.ts (and matching .test.ts/.spec.ts companions). Move utilities to src/utils and application context/types outside src/domain.",
    },
  },
  create(context) {
    return {
      Program(node) {
        const file = domainFile(context.filename);
        if (file && !file.match) context.report({ node, messageId: "filename" });
      },
    };
  },
};

export const domainFolder = {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      folder: "Place {{implementation}} and its tests in a matching {{stem}}/ folder inside domain.",
      missing: "Domain tests require {{implementation}} in the same folder.",
    },
  },
  create(context) {
    return {
      Program(node) {
        const file = domainFile(context.filename);
        if (!file?.match) return;
        const { stem, kind, test } = file.match;
        const directory = path.posix.dirname(file.filename);
        const implementation = `${stem}.${kind}.ts`;
        if (path.posix.basename(directory) !== stem) {
          context.report({ node, messageId: "folder", data: { implementation, stem } });
        } else if (
          test &&
          !fs.statSync(path.join(directory, implementation), { throwIfNoEntry: false })?.isFile()
        ) {
          context.report({ node, messageId: "missing", data: { implementation } });
        }
      },
    };
  },
};
