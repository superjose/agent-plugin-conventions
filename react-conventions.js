import path from "node:path";

const isPascalCase = (name) => /^[A-Z][A-Za-z0-9]*$/.test(name);

function containsJsx(node, seen = new Set()) {
  if (!node || typeof node !== "object" || seen.has(node)) return false;
  seen.add(node);
  if (node.type === "JSXElement" || node.type === "JSXFragment") return true;
  for (const [key, value] of Object.entries(node)) {
    if (["parent", "loc", "range", "tokens", "comments"].includes(key)) continue;
    if (Array.isArray(value)) {
      if (value.some((item) => containsJsx(item, seen))) return true;
    } else if (containsJsx(value, seen)) return true;
  }
  return false;
}

function declaredFunctions(program) {
  const functions = new Map();
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "FunctionDeclaration" && node.id)
      functions.set(node.id.name, node);
    if (node.type === "VariableDeclarator" && node.id.type === "Identifier") {
      let value = node.init;
      // Recognize common component wrappers such as memo and forwardRef.
      while (value?.type === "CallExpression") value = value.arguments[0];
      if (["ArrowFunctionExpression", "FunctionExpression"].includes(value?.type))
        functions.set(node.id.name, value);
    }
    if (node.type === "ExportDefaultDeclaration" &&
        ["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"].includes(node.declaration?.type) &&
        !node.declaration.id)
      functions.set("DefaultComponent", node.declaration);
    for (const [key, value] of Object.entries(node)) {
      if (["parent", "loc", "range", "tokens", "comments"].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(visit);
      else visit(value);
    }
  };
  visit(program);
  return functions;
}

function components(program) {
  return [...declaredFunctions(program)]
    .filter(([name, node]) => isPascalCase(name) && containsJsx(node.body))
    .map(([name, node]) => ({ name, node }));
}


function isRoute(filename, program, directories) {
  const normalized = filename.replaceAll("\\", "/");
  if (normalized.includes("/routes/")) return true;
  return program.body.some((node) => node.type === "ExportDefaultDeclaration") &&
    directories.some((directory) => {
      const root = directory.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
      return root && normalized.includes(`/${root}/`);
    });
}

export const reactComponentFile = {
  meta: {
    type: "suggestion",
    docs: { description: "Give each React component its own PascalCase folder and index.tsx" },
    schema: [{
      type: "object",
      properties: { routeDirectories: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true } },
      additionalProperties: false,
    }],
    messages: {
      count: "Declare one React component per file; found {{count}}. Move additional components to their own folders.",
      location: "Move {{name}} to {{name}}/index.tsx.",
      testLocation:
        "Name this component test {{name}}.test.tsx or {{name}}.spec.tsx inside its {{name}} folder.",
    },
  },
  create(context) {
    return {
      "Program:exit"(program) {
        const filename = context.filename.replaceAll("\\", "/");
        if (!filename.endsWith(".tsx")) return;
        const test = /^(.*)\.(test|spec)\.tsx$/.exec(path.posix.basename(filename));
        if (test) {
          const name = path.posix.basename(path.posix.dirname(filename));
          if (!isPascalCase(name) || test[1] !== name)
            context.report({ node: program, messageId: "testLocation", data: { name } });
          return;
        }
        const found = components(program);
        if (found.length === 0) return;
        if (found.length > 1)
          context.report({
            node: program,
            messageId: "count",
            data: { count: String(found.length) },
          });
        if (found.length !== 1 || isRoute(filename, program, context.options[0]?.routeDirectories ?? [])) return;
        const [{ name, node }] = found;
        if (
          path.posix.basename(filename) !== "index.tsx" ||
          path.posix.basename(path.posix.dirname(filename)) !== name
        )
          context.report({ node, messageId: "location", data: { name } });
      },
    };
  },
};

function typeDeclarations(program) {
  const declarations = new Map();
  for (const statement of program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (["TSTypeAliasDeclaration", "TSInterfaceDeclaration"].includes(declaration?.type))
      declarations.set(declaration.id.name, declaration);
  }
  return declarations;
}

function typeName(parameter) {
  const annotation = parameter.typeAnnotation?.typeAnnotation;
  if (annotation?.type !== "TSTypeReference" || annotation.typeName.type !== "Identifier")
    return null;
  return annotation.typeName.name;
}

function propertyCount(parameter, declarations) {
  if (parameter.type === "ObjectPattern") return parameter.properties.length;
  const annotation = parameter.typeAnnotation?.typeAnnotation;
  if (annotation?.type === "TSTypeLiteral") return annotation.members.length;
  const declaration = declarations.get(typeName(parameter));
  if (
    declaration?.type === "TSTypeAliasDeclaration" &&
    declaration.typeAnnotation.type === "TSTypeLiteral"
  )
    return declaration.typeAnnotation.members.length;
  if (declaration?.type === "TSInterfaceDeclaration") return declaration.body.body.length;
  return null;
}

export const reactComponentInput = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Use a named input type and body destructuring for React components with three or more props",
    },
    schema: [],
    messages: {
      input:
        "Components with three or more props must accept input: {{name}}Input. Destructure input inside the function body.",
    },
  },
  create(context) {
    return {
      "Program:exit"(program) {
        if (!context.filename.replaceAll("\\", "/").endsWith(".tsx")) return;
        const declarations = typeDeclarations(program);
        for (const component of components(program)) {
          if (component.node.params.length === 0) continue;
          const parameter = component.node.params[0];
          const count = propertyCount(parameter, declarations);
          if (count !== null && count <= 2) continue;
          const expected = `${component.name}Input`;
          if (
            component.node.params.length !== 1 ||
            parameter.type !== "Identifier" ||
            parameter.name !== "input" ||
            typeName(parameter) !== expected ||
            !declarations.has(expected)
          )
            context.report({
              node: parameter,
              messageId: "input",
              data: { name: component.name },
            });
        }
      },
    };
  },
};
