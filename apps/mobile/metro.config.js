const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const srcRoot = path.resolve(projectRoot, "../..", "src");

// The file-map crawler skips a directory when ignore() matches it, so the
// allow-list ancestors must stay unmatched. Every other path under src/ matches.
const allowedRelatives = [
  "library",
  "dictionary",
  "i18n",
  "reader",
  path.join("library", "two-books-parse.ts"),
  path.join("dictionary", "glossary.ts"),
  path.join("dictionary", "lookup.ts"),
  path.join("dictionary", "saved-words.ts"),
  path.join("dictionary", "google-translate.ts"),
  path.join("i18n", "types.ts"),
  path.join("i18n", "locale.ts"),
  path.join("reader", "selection.ts"),
  path.join("reader", "tokens.ts"),
];

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

const blockSrc = new RegExp(
  `^${escapeRegExp(srcRoot + path.sep)}(?!(?:${allowedRelatives.map(escapeRegExp).join("|")})$).+`,
);

/** @type {import("expo/metro-config").MetroConfig} */
const config = getDefaultConfig(projectRoot);
const watched = [
  path.join(srcRoot, "library"),
  path.join(srcRoot, "dictionary"),
  path.join(srcRoot, "i18n"),
  path.join(srcRoot, "reader"),
];
config.watchFolders = [...new Set([...(config.watchFolders ?? []), projectRoot, ...watched])];

const currentBlockList = config.resolver?.blockList;
const blockList = Array.isArray(currentBlockList)
  ? currentBlockList
  : currentBlockList
    ? [currentBlockList]
    : [];
config.resolver.blockList = [...blockList, blockSrc];

const previousResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("#/")) {
    const relative = moduleName.slice(2);
    const filePath = path.resolve(srcRoot, relative.endsWith(".ts") ? relative : `${relative}.ts`);
    return { type: "sourceFile", filePath };
  }
  if (previousResolve) return previousResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
