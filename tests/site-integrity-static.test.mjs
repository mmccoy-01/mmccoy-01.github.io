import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const rssPostPath = new URL("../_posts/2023-12-28-rss-feeds.md", import.meta.url);
const rssArchivePath = new URL("../assets/files/rss-feed.zip", import.meta.url);
const bundledScriptsPath = new URL("../assets/js/scripts.min.js", import.meta.url);

const [rssPost, rssArchive, bundledScripts] = await Promise.all([
  readFile(rssPostPath, "utf8"),
  readFile(rssArchivePath),
  readFile(bundledScriptsPath, "utf8"),
]);

assert.match(
  rssPost,
  /href="\{\{ '\/assets\/files\/rss-feed\.zip' \| relative_url \}\}"/,
  "The RSS post must link to the published, baseurl-aware archive.",
);
assert.equal(
  rssArchive.subarray(0, 4).toString("hex"),
  "504b0304",
  "The published RSS download must be a valid ZIP archive.",
);
assert.match(
  bundledScripts,
  /noopener/,
  "The production script bundle must protect external links from opener access.",
);
assert.match(
  bundledScripts,
  /noreferrer/,
  "The production script bundle must suppress referrer data on external links.",
);

console.log(`site-integrity static checks passed for ${root}`);
