import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const book = path.join(root, "book");
const scriptPath = path.join(root, "assets", "js", "github-highlight.js");
const stylePath = path.join(root, "assets", "css", "github-highlight.css");
const sourceMapPath = path.join(book, "page-source-map.json");
const jekyllHeadPath = path.join(root, "_includes", "head.html");
const issueFormPath = path.join(
  root,
  ".github",
  "ISSUE_TEMPLATE",
  "suggested-edit.yml"
);

const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });

const htmlFiles = walk(book).filter((file) => file.endsWith(".html"));
const sourceMap = JSON.parse(fs.readFileSync(sourceMapPath, "utf8"));
const script = fs.readFileSync(scriptPath, "utf8");
const style = fs.readFileSync(stylePath, "utf8");
const jekyllHead = fs.readFileSync(jekyllHeadPath, "utf8");
const issueForm = fs.readFileSync(issueFormPath, "utf8");

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
  assert.match(
    html,
    /<script src="\/assets\/js\/github-highlight\.js" defer><\/script>/,
    `${relative} must load the canonical shared script`
  );
  assert.match(
    html,
    /<link rel="stylesheet" href="\/assets\/css\/github-highlight\.css">/,
    `${relative} must load the canonical shared stylesheet`
  );
}

assert.match(
  jekyllHead,
  /{% if page\.layout == 'post' %}[\s\S]*github-highlight-source[\s\S]*github-highlight-public-url[\s\S]*github-highlight\.css[\s\S]*github-highlight\.js[\s\S]*{% endif %}/,
  "Jekyll post head must emit source/public metadata and shared asset loaders"
);
assert.match(
  script,
  /main\.content#quarto-document-content, article\.post-content/,
  "shared script must support Quarto chapters and Jekyll posts"
);
assert.match(
  style,
  /\.github-highlight-menu[\s\S]*min-height: 44px/,
  "shared stylesheet must include the menu and minimum touch target"
);
assert.match(
  issueForm,
  /labels:\s*\n\s+- suggested-edit[\s\S]*id: source_path[\s\S]*id: selected_passage[\s\S]*id: proposed_replacement/,
  "Suggested edit issue form must apply the label and define structured fields"
);

for (const requiredBehavior of [
  "selectionchange",
  "touchend",
  "pointerup",
  "visualViewport",
  "navigator.clipboard",
  'document.execCommand("copy")',
  "URLSearchParams",
  "issueTemplate",
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
