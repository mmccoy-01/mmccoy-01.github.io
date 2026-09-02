import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const [
  dataText,
  page,
  layout,
  css,
  script,
  config,
  readme,
  updater,
  issueUpdater,
  issueForm,
  screenIssueForm,
  reminderWorkflow,
  applyWorkflow
] =
  await Promise.all([
    read("_data/now.json"),
    read("pages/now.html"),
    read("_layouts/now.html"),
    read("assets/css/now.css"),
    read("assets/js/now.js"),
    read("_config.yml"),
    read("README.md"),
    read("scripts/update-now.mjs"),
    read("scripts/apply-now-issue.mjs"),
    read(".github/ISSUE_TEMPLATE/now-update.yml"),
    read(".github/ISSUE_TEMPLATE/now-screen-update.yml"),
    read(".github/workflows/now-reminder.yml"),
    read(".github/workflows/apply-now-update.yml")
  ]);

const data = JSON.parse(dataText);

assert.match(data.last_updated, /^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
assert.equal(typeof data.music.title, "string");
assert.match(data.music.track_id, /^\d+$/);
assert.match(data.music.release_date_iso, /^\d{4}-\d{2}-\d{2}$/);
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
assert.ok(data.screen.length >= 1);
assert.ok(data.screen.every((item) => typeof item.title === "string"));
assert.ok(data.screen.every((item) => Array.isArray(item.notes)));
assert.equal(data.presently.length, 7);
assert.equal(data.github, undefined);
assert.equal(data.presently[2].label, "Small pleasure");
assert.equal(data.presently[2].url, undefined);
assert.equal(data.presently[2].link_label, undefined);
assert.deepEqual(
  data.presently.map((item) => item.label),
  [
    "Working on",
    "Reading",
    "Small pleasure",
    "Recent discovery",
    "Looking forward to",
    "One open question",
    "Something I recommend"
  ]
);

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
assert.match(page, /item\.text \| markdownify/);
assert.match(page, /now\.last_updated \| date: '%Y-%m-%d'/);
assert.match(page, /More about \{\{ item\.title \}\}/);
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
assert.match(css, /\.now-present-card[\s\S]*min-width:\s*0/);
assert.match(css, /\.now-present-text[\s\S]*overflow-wrap:\s*anywhere/);

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
assert.match(readme, /Update the `\/now` page from GitHub/);
assert.doesNotMatch(updater, /api\.wikimedia\.org|findHistoricalEvent/);
assert.match(updater, /itunes\.apple\.com\/lookup/);
assert.match(updater, /release_date_iso/);
assert.match(updater, /process\.argv\.includes\("--write"\)/);

assert.match(issueUpdater, /Only the repository owner/);
assert.match(issueUpdater, /validateNowData/);
assert.match(issueUpdater, /America\/New_York/);
assert.match(issueUpdater, /https:\/\/www\.omdbapi\.com\//);
assert.match(issueUpdater, /OMDB_API_KEY/);
assert.match(issueUpdater, /extractImdbId/);
assert.match(issueForm, /name:\s*Update the \/now page/);
assert.match(issueForm, /label:\s*Working on/);
assert.match(issueForm, /label:\s*Featured Apple Music song/);
assert.match(screenIssueForm, /name:\s*Add a movie or series to \/now/);
assert.match(screenIssueForm, /label:\s*IMDb URL or ID/);
assert.match(screenIssueForm, /label:\s*On Screen action/);
assert.match(reminderWorkflow, /name:\s*Monthly \/now reminder/);
assert.match(reminderWorkflow, /cron:\s*"0 15 1 \* \*"/);
assert.match(reminderWorkflow, /updateAlreadyOpen/);
assert.match(reminderWorkflow, /now-screen-update\.yml/);
assert.match(reminderWorkflow, /assignees:\s*\[owner\]/);
assert.match(applyWorkflow, /github\.event\.issue\.user\.login == github\.repository_owner/);
assert.match(applyWorkflow, /OMDB_API_KEY:\s*\$\{\{ secrets\.OMDB_API_KEY \}\}/);
assert.match(applyWorkflow, /npm test/);
assert.match(applyWorkflow, /pull-requests:\s*write/);
assert.doesNotMatch(reminderWorkflow + applyWorkflow, /uses:\s*[^\s]+@(v|main|master)\b/);
assert.doesNotMatch(page + css + script, /OMDB_API_KEY/);

console.log("now-page static checks passed");
