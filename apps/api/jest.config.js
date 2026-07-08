const path = require("node:path");

/** Jest cho unit tests (domain rules, use cases). Integration tests them sau. */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testMatch: ["**/*.spec.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  // marked@18 la ESM-only (ERR_PACKAGE_PATH_NOT_EXPORTED voi require) — ts-jest
  // chay CommonJS nen doi sang ban UMD (CJS-compatible) chi trong test.
  moduleNameMapper: {
    "^marked$": path.join(
      path.dirname(require.resolve("marked/package.json")),
      "lib/marked.umd.js",
    ),
  },
};
