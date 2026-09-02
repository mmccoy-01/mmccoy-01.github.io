import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyIssueResponses,
  applyScreenMetadata,
  extractImdbId,
  fetchOmdbTitle,
  parseIssueForm,
  validateNowData
} from "../scripts/apply-now-issue.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(await readFile(path.join(root, "_data", "now.json"), "utf8"));

const responses = parseIssueForm(`
### Working on

A focused test project.

### Reading

_No response_

### Current screen notes

First paragraph.

Second paragraph.

### Featured Apple Music song

https://music.apple.com/us/song/example/1234567890

### Ready to update

- [x] Ready
`);

assert.equal(responses.get("working on"), "A focused test project.");
assert.equal(responses.get("reading"), "");

const result = applyIssueResponses(
  source,
  responses,
  new Date("2026-09-02T16:00:00Z")
);

assert.equal(result.data.presently[0].text, "A focused test project.");
assert.equal(result.data.presently[1].text, source.presently[1].text);
assert.deepEqual(result.data.screen[0].notes, ["First paragraph.", "Second paragraph."]);
assert.equal(
  result.data.music.apple_url,
  "https://music.apple.com/us/song/example/1234567890"
);
assert.equal(result.data.last_updated, "September 2, 2026");
assert.equal(result.musicChanged, true);
assert.deepEqual(result.changes, [
  "Working on",
  "Current screen notes",
  "Featured Apple Music song"
]);
assert.equal(validateNowData(result.data), result.data);

const invalidSong = parseIssueForm(`
### Featured Apple Music song

https://example.com/not-apple-music
`);
assert.throws(
  () => applyIssueResponses(source, invalidSong),
  /must point to music\.apple\.com/
);

assert.equal(extractImdbId("tt0083399"), "tt0083399");
assert.equal(
  extractImdbId("https://www.imdb.com/title/tt0083399/?ref_=fn_all_ttl_1"),
  "tt0083399"
);
assert.throws(() => extractImdbId("https://example.com/title/tt0083399"), /imdb\.com/);

const screenResponses = parseIssueForm(`
### IMDb URL or ID

https://www.imdb.com/title/tt0117571/

### On Screen action

Add to the current list

### Viewing status

Finished

### Personal score

9/10

### Date label

Watched September 2026

### Personal notes

The opening scene remains perfect.

Still funny and tense.
`);

const omdbMetadata = {
  Title: "Scream",
  Year: "1996",
  Genre: "Horror, Mystery",
  Director: "Wes Craven",
  Actors: "Neve Campbell, Courteney Cox, David Arquette",
  Plot: "A masked killer targets a group of teenagers.",
  Awards: "11 wins & 11 nominations",
  Poster: "https://m.media-amazon.com/images/example.jpg",
  Metascore: "65",
  imdbRating: "7.4",
  imdbID: "tt0117571",
  Type: "movie",
  BoxOffice: "$103,046,663",
  Response: "True"
};

const screenResult = applyScreenMetadata(
  source,
  omdbMetadata,
  screenResponses,
  new Date("2026-09-02T16:00:00Z")
);
assert.equal(screenResult.data.screen[0].title, "Scream");
assert.equal(screenResult.data.screen[0].imdb_id, "tt0117571");
assert.equal(screenResult.data.screen[0].status, "Finished");
assert.equal(screenResult.data.screen[0].personal_score, "9/10");
assert.deepEqual(screenResult.data.screen[0].genres, ["Horror", "Mystery"]);
assert.deepEqual(screenResult.data.screen[0].cast, [
  "Neve Campbell",
  "Courteney Cox",
  "David Arquette"
]);
assert.deepEqual(screenResult.data.screen[0].notes, [
  "The opening scene remains perfect.",
  "Still funny and tense."
]);
assert.equal(screenResult.data.screen.length, source.screen.length + 1);

const duplicateResult = applyScreenMetadata(
  screenResult.data,
  omdbMetadata,
  parseIssueForm(`
### IMDb URL or ID

tt0117571

### On Screen action

Add to the current list
`)
);
assert.equal(
  duplicateResult.data.screen.filter((item) => item.imdb_id === "tt0117571").length,
  1
);
assert.equal(duplicateResult.data.screen[0].personal_score, "9/10");
assert.deepEqual(duplicateResult.data.screen[0].notes, [
  "The opening scene remains perfect.",
  "Still funny and tense."
]);
assert.match(duplicateResult.change, /^Updated On Screen:/);

const replaceResponses = parseIssueForm(`
### On Screen action

Replace the current list
`);
const replaceResult = applyScreenMetadata(source, omdbMetadata, replaceResponses);
assert.equal(replaceResult.data.screen.length, 1);
assert.equal(replaceResult.data.screen[0].title, "Scream");

let requestedUrl;
const fetchedMetadata = await fetchOmdbTitle(
  "tt0117571",
  "test-secret",
  async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      json: async () => omdbMetadata
    };
  }
);
assert.equal(fetchedMetadata.Title, "Scream");
assert.equal(requestedUrl.hostname, "www.omdbapi.com");
assert.equal(requestedUrl.searchParams.get("i"), "tt0117571");
assert.equal(requestedUrl.searchParams.get("apikey"), "test-secret");
await assert.rejects(() => fetchOmdbTitle("tt0117571", ""), /OMDB_API_KEY/);

console.log("now issue-update checks passed");
