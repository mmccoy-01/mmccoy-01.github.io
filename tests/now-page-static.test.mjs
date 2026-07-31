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
assert.equal(data.music.release_date_iso, "2001-05-22");
assert.equal(data.music.history, undefined);
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
assert.equal(data.github, undefined);
assert.equal(data.presently[2].label, "Small pleasure");
assert.match(data.presently[2].url, /^https:\/\/www\.facebook\.com\//);
assert.equal(data.presently[2].link_label, undefined);

assert.match(page, /permalink:\s*\/now\//);
assert.match(page, /data-playlist-picker/);
assert.match(page, /role="tablist"/);
assert.match(page, /class="now-song-player"/);
assert.match(page, /data-history-card/);
assert.match(page, /data-release-date=/);
assert.match(page, /data-history-text/);
assert.doesNotMatch(page, /data-github|now-github|GitHub profile/);
assert.match(page, /https:\/\/nownownow\.com\/about/);
assert.match(page, /class="now-inline-link"/);
assert.doesNotMatch(page, /;;/);
assert.doesNotMatch(page, /now-record-art|now-record-label|>BTC</);
assert.doesNotMatch(page, /Open in Apple Music|data-playlist-link/);
assert.doesNotMatch(page, /Select a playlist to load|30-second previews/);
assert.doesNotMatch(page, /I · Audire|II · Videre|III · Opus/);
assert.doesNotMatch(
  page,
  /The music and atmosphere|What I recently watched|The systems, questions/
);
assert.ok(
  page.indexOf('id="now-workshop-title"') <
    page.indexOf('id="now-screen-title"') &&
    page.indexOf('id="now-screen-title"') <
      page.indexOf('id="now-music-title"'),
  "Sections must render Workshop, On Screen, then Heavy Rotation."
);
assert.ok(
  page.indexOf('class="now-playlists"') <
    page.indexOf('class="now-essay"'),
  "Playlist tabs must sit immediately before the current thread."
);

assert.match(layout, /class="has-push-menu now-page"/);
assert.match(layout, /assets\/js\/now\.js/);
assert.match(css, /min-height:\s*44px/);
assert.match(css, /html\[data-theme="dark"\] \.now-page/);
assert.match(css, /@media \(max-width:\s*720px\)/);
assert.match(css, /scroll-snap-type:\s*x mandatory/);
assert.match(css, /focus-visible/);
assert.match(css, /\.now-section-heading h2[\s\S]*Dancing Script/);

assert.match(script, /__katalepsaraNowInitialized/);
assert.match(script, /removeLegacyHeadingLinks/);
assert.doesNotMatch(
  script,
  /requestIdleCallback|data-player-empty|data-load-player/
);
assert.match(script, /localStorage/);
assert.doesNotMatch(script, /github|stargazers_count|accountAge/i);
assert.match(script, /syncApplePlayerColorScheme/);
assert.match(script, /findNearbyHistoricalEvent/);
assert.match(script, /en\.wikipedia\.org\/api\/rest_v1\/feed\/onthisday\/events/);
assert.match(script, /HISTORY_SEARCH_RADIUS_DAYS\s*=\s*7/);
assert.doesNotMatch(script, /token|authorization/i);

assert.match(config, /- title:\s*Now\s+url:\s*\/now\//);
assert.match(readme, /## `\/now` page/);
assert.match(readme, /node scripts\/update-now\.mjs --write/);
assert.doesNotMatch(updater, /api\.wikimedia\.org|findHistoricalEvent/);
assert.match(updater, /itunes\.apple\.com\/lookup/);
assert.match(updater, /release_date_iso/);
assert.match(updater, /process\.argv\.includes\("--write"\)/);

console.log("now-page static checks passed");
