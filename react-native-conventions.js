import fs from "node:fs";
import path from "node:path";

function isNativePackage(filename) {
  let directory = path.dirname(filename);
  while (true) {
    const manifest = path.join(directory, "package.json");
    if (fs.existsSync(manifest)) {
      const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
      return [pkg.dependencies, pkg.peerDependencies, pkg.devDependencies]
        .some((dependencies) => dependencies && "react-native" in dependencies);
    }
    const parent = path.dirname(directory);
    if (parent === directory) return false;
    directory = parent;
  }
}

export const reactNativeDynamicTheme = {
  meta: {
    type: "suggestion",
    docs: { description: "Use the active Unistyles theme in React Native packages" },
    schema: [{
      type: "object",
      properties: {
        nativeDirectories: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
      },
      additionalProperties: false,
    }],
    messages: {
      theme: "Use the active Unistyles theme via StyleSheet.create(theme => …) or useUnistyles().theme instead of importing {{name}}.",
    },
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");
    const directories = context.options[0]?.nativeDirectories ?? [];
    const native = directories.some((directory) => {
      const root = directory.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
      return root && filename.includes(`/${root}/`);
    }) || isNativePackage(filename);
    if (!native) return {};
    const fixedThemes = new Set(["lightTheme", "darkTheme", "theme"]);
    return {
      ImportDeclaration(node) {
        if (node.importKind === "type") return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
          const name = specifier.imported.name ?? specifier.imported.value;
          if (fixedThemes.has(name)) context.report({ node: specifier, messageId: "theme", data: { name } });
        }
      },
      MemberExpression(node) {
        // Also catch namespace imports (including computed property access).
        const name = node.computed ? node.property.value : node.property.name;
        if (!fixedThemes.has(name) || node.object.type !== "Identifier") return;
        let scope = context.sourceCode.getScope(node);
        while (scope) {
          const binding = scope.set.get(node.object.name);
          if (binding) {
            if (binding.defs.some((def) => def.node.type === "ImportNamespaceSpecifier"))
              context.report({ node, messageId: "theme", data: { name } });
            break;
          }
          scope = scope.upper;
        }
      },
    };
  },
};
