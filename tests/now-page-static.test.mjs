import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const [dataText, page, layout, css, script, config, readme, updater] =
  await Promise.all([
    read("_data/now.json"),
    read("pages/now.html"),
    read("_layouts/now.html"),
    read("assets/css/now.css"),
    read("assets/js/now.js"),
    read("_config.yml"),
    read("README.md"),
    read("scripts/update-now.mjs")
  ]);

const data = JSON.parse(dataText);

assert.equal(data.last_updated, "July 30, 2026");
assert.equal(data.music.title, "Warm Safe Place");
assert.equal(data.music.track_id, "263065402");
assert.match(data.music.apple_url, /^https:\/\/music\.apple\.com\//);
assert.match(data.music.embed_url, /^https:\/\/embed\.music\.apple\.com\//);
assert.equal(data.playlists.length, 5);
assert.equal(new Set(data.playlists.map((item) => item.url)).size, 5);
assert.ok(
  data.playlists.every(
    (item) =>
      item.url.startsWith("https://music.apple.com/") &&
      item.embed_url.startsWith("https://embed.music.apple.com/")
  )
);
assert.equal(data.screen.length, 2);
assert.equal(data.presently.length, 7);
assert.equal(data.github.username, "mmccoy-01");

assert.match(page, /permalink:\s*\/now\//);
assert.match(page, /data-playlist-picker/);
assert.match(page, /role="tablist"/);
assert.match(page, /class="now-song-player"/);
assert.match(page, /data-github-card/);
assert.match(page, /https:\/\/nownownow\.com\/about/);
assert.doesNotMatch(page, /;;/);

assert.match(layout, /class="has-push-menu now-page"/);
assert.match(layout, /assets\/js\/now\.js/);
assert.match(css, /min-height:\s*44px/);
assert.match(css, /html\[data-theme="dark"\] \.now-page/);
assert.match(css, /@media \(max-width:\s*720px\)/);
assert.match(css, /scroll-snap-type:\s*x mandatory/);
assert.match(css, /focus-visible/);

assert.match(script, /__katalepsaraNowInitialized/);
assert.match(script, /requestIdleCallback/);
assert.match(script, /localStorage/);
assert.match(script, /dataset\.githubApi/);
assert.match(script, /noopener noreferrer/);
assert.doesNotMatch(script, /token|authorization/i);

assert.match(config, /- title:\s*Now\s+url:\s*\/now\//);
assert.match(readme, /## `\/now` page/);
assert.match(readme, /node scripts\/update-now\.mjs --write/);
assert.match(updater, /api\.wikimedia\.org/);
assert.match(updater, /itunes\.apple\.com\/lookup/);
assert.match(updater, /process\.argv\.includes\("--write"\)/);

console.log("now-page static checks passed");
