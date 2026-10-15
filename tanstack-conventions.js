import path from "node:path";

export const tanstackMiddlewareFile = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Use the .middleware.ts suffix for TanStack server middleware files",
    },
    schema: [],
    messages: {
      filename:
        "Files in a server/middleware folder must use <name>.middleware.ts; tests use <name>.middleware.test.ts or .spec.ts.",
    },
  },
  create(context) {
    return {
      Program(program) {
        const filename = context.filename.replaceAll("\\", "/");
        if (!filename.includes("/server/middleware/")) return;
        const basename = path.posix.basename(filename);
        if (
          /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.middleware\.ts$/.test(basename) ||
          /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.middleware\.(?:test|spec)\.ts$/.test(basename)
        )
          return;
        context.report({ node: program, messageId: "filename" });
      },
    };
  },
};
