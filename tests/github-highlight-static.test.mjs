import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const book = path.join(root, "book");
const scriptPath = path.join(book, "github-highlight.js");
const sourceMapPath = path.join(book, "page-source-map.json");

const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });

const htmlFiles = walk(book).filter((file) => file.endsWith(".html"));
const sourceMap = JSON.parse(fs.readFileSync(sourceMapPath, "utf8"));
const script = fs.readFileSync(scriptPath, "utf8");

assert.ok(htmlFiles.length > 0, "book must contain rendered HTML pages");
assert.equal(
  Object.keys(sourceMap).length,
  htmlFiles.length,
  "source map must cover every rendered page"
);

for (const htmlPath of htmlFiles) {
  const relative = path.relative(book, htmlPath).replaceAll("\\", "/");
  const html = fs.readFileSync(htmlPath, "utf8");
  const source = sourceMap[relative];
  assert.ok(source, `${relative} must have a source mapping`);
  assert.ok(source.endsWith(".qmd"), `${relative} must map to a qmd source`);
  assert.match(
    html,
    new RegExp(
      `<meta name="github-highlight-source" content="${source.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )}">`
    ),
    `${relative} must contain source metadata`
  );
  assert.equal(
    (html.match(/github-highlight\.js/g) || []).length,
    1,
    `${relative} must load the feature exactly once`
  );

  const offset =
    html.match(/<meta name="quarto:offset" content="([^"]*)">/)?.[1] ?? "./";
  assert.ok(
    fs.existsSync(path.resolve(path.dirname(htmlPath), offset, "github-highlight.js")),
    `${relative} script reference must resolve`
  );
}

for (const requiredBehavior of [
  "selectionchange",
  "touchend",
  "pointerup",
  "visualViewport",
  "navigator.clipboard",
  'document.execCommand("copy")',
  "URLSearchParams",
  "issueLabel",
  "discussionCategory",
  "maximumSelectionLength",
  'event.key === "Escape"',
]) {
  assert.ok(
    script.includes(requiredBehavior),
    `implementation must contain ${requiredBehavior}`
  );
}

console.log(
  `github-highlight static checks passed for ${htmlFiles.length} rendered pages`
);
