import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const book = path.join(root, "book");
const script = fs.readFileSync(
  path.join(root, "assets", "js", "site-theme.js"),
  "utf8"
);
const style = fs.readFileSync(
  path.join(root, "assets", "css", "site-theme.css"),
  "utf8"
);
const head = fs.readFileSync(path.join(root, "_includes", "head.html"), "utf8");
const header = fs.readFileSync(
  path.join(root, "_includes", "header.html"),
  "utf8"
);
const defaultLayout = fs.readFileSync(
  path.join(root, "_layouts", "default.html"),
  "utf8"
);
const comments = fs.readFileSync(
  path.join(root, "_includes", "comments.html"),
  "utf8"
);

const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });

const htmlFiles = walk(book).filter((file) => file.endsWith(".html"));

assert.ok(htmlFiles.length > 0, "book must contain rendered HTML pages");

for (const htmlPath of htmlFiles) {
  const relative = path.relative(book, htmlPath).replaceAll("\\", "/");
  const html = fs.readFileSync(htmlPath, "utf8");

  assert.equal(
    (html.match(/site-theme\.js/g) || []).length,
    1,
    `${relative} must load the theme controller exactly once`
  );
  assert.equal(
    (html.match(/site-theme\.css/g) || []).length,
    1,
    `${relative} must load the theme stylesheet exactly once`
  );
  assert.match(
    html,
    /<script src="\/assets\/js\/site-theme\.js"><\/script>/,
    `${relative} must use the shared root-relative theme script`
  );
  assert.match(
    html,
    /<link rel="stylesheet" href="\/assets\/css\/site-theme\.css">/,
    `${relative} must use the shared root-relative theme stylesheet`
  );
}

assert.match(
  head,
  /site-theme\.js[\s\S]*styles\.css[\s\S]*site-theme\.css/,
  "Jekyll must apply the controller before paint and load theme overrides last"
);
assert.match(
  header,
  /<button[\s\S]*data-site-theme-toggle[\s\S]*site-theme-icon-moon[\s\S]*site-theme-icon-sun[\s\S]*<\/button>[\s\S]*id="search"/,
  "Jekyll toolbar must place a real theme button next to search"
);
assert.ok(
  !defaultLayout.includes("nightModeToggle"),
  "obsolete page-level theme button must be removed"
);

for (const requiredBehavior of [
  "prefers-color-scheme: dark",
  "localStorage",
  "storage",
  "pageshow",
  "quarto:loaded",
  ".quarto-search-button",
  "#search.dosearch",
  ".sidebar-search",
  'setAttribute("aria-label"',
  'setAttribute("aria-pressed"',
  "__siteThemeInitialized",
  "useSystemPreference",
  "iframe.giscus-frame",
  "https://giscus.app",
]) {
  assert.ok(
    script.includes(requiredBehavior),
    `theme controller must contain ${requiredBehavior}`
  );
}

assert.match(
  comments,
  /data-theme="preferred_color_scheme"/,
  "Giscus must start with the system theme before the controller synchronizes it"
);

assert.match(
  style,
  /\.site-theme-toggle[\s\S]*height: 44px[\s\S]*width: 44px/,
  "theme button must provide a 44px touch target"
);
assert.match(
  style,
  /\.site-theme-toggle:focus-visible/,
  "theme button must have a visible keyboard focus state"
);
assert.match(
  style,
  /html\[data-theme="dark"\][\s\S]*body\.quarto-dark/,
  "theme stylesheet must include Quarto dark-mode surfaces"
);
assert.match(
  style,
  /body:not\(\.main-page\):not\(\.phd-dashboard-page\)/,
  "theme stylesheet must include normal Jekyll content without overriding bespoke pages"
);

console.log(
  `site-theme static checks passed for ${htmlFiles.length} rendered pages`
);
