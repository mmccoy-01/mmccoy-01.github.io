#!/usr/bin/env node

/**
 * Convert the repository owner's structured GitHub Issue Form response into a
 * validated update for _data/now.json.
 *
 * Preview: node scripts/apply-now-issue.mjs --event path/to/event.json
 * Apply:   node scripts/apply-now-issue.mjs --event path/to/event.json --write
 */

import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");
const dataPath = path.join(repositoryRoot, "_data", "now.json");
const noResponse = new Set(["", "_No response_", "No response"]);
const maxAnswerLength = 12_000;

const workshopFields = [
  ["Working on", "Working on"],
  ["Reading", "Reading"],
  ["Small pleasure", "Small pleasure"],
  ["Recent discovery", "Recent discovery"],
  ["Looking forward to", "Looking forward to"],
  ["One open question", "One open question"],
  ["Something I recommend", "Something I recommend"]
];

function normalizedHeading(value) {
  return String(value).trim().toLocaleLowerCase("en-US");
}

function getArgumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertHttpUrl(value, label, expectedHost) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a complete HTTPS URL.`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS.`);
  }
  if (expectedHost && parsed.hostname !== expectedHost) {
    throw new Error(`${label} must point to ${expectedHost}.`);
  }
}

export function parseIssueForm(body) {
  const source = String(body || "");
  const matches = [...source.matchAll(/^###\s+(.+?)\s*$/gm)];
  const responses = new Map();

  matches.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? source.length;
    const heading = normalizedHeading(match[1]);
    const answer = source.slice(start, end).trim();
    responses.set(heading, noResponse.has(answer) ? "" : answer);
  });

  return responses;
}

function responseFor(responses, heading) {
  const answer = responses.get(normalizedHeading(heading));
  if (!answer) return undefined;
  if (answer.length > maxAnswerLength) {
    throw new Error(`${heading} is longer than ${maxAnswerLength} characters.`);
  }
  return answer;
}

function formatUpdateDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York"
  }).format(date);
}

function validateAppleMusicUrl(value) {
  assertHttpUrl(value, "Featured Apple Music song", "music.apple.com");
  const parsed = new URL(value);
  const queryTrackId = parsed.searchParams.get("i");
  const validQueryTrackId = queryTrackId && /^\d+$/.test(queryTrackId);
  const pathTrackId = parsed.pathname.match(/\/(\d+)\/?$/)?.[1];
  if (!validQueryTrackId && !pathTrackId) {
    throw new Error(
      "Featured Apple Music song must include a numeric song ID in the path or ?i= query."
    );
  }
}

export function extractImdbId(value) {
  const input = String(value || "").trim();
  if (/^tt\d{7,10}$/i.test(input)) {
    return input.toLocaleLowerCase("en-US");
  }

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("IMDb URL or ID must be a full IMDb title URL or an ID such as tt0083399.");
  }

  const isImdbHost =
    parsed.hostname === "imdb.com" || parsed.hostname.endsWith(".imdb.com");
  const match = parsed.pathname.match(/\/title\/(tt\d{7,10})(?:\/|$)/i);
  if (parsed.protocol !== "https:" || !isImdbHost || !match) {
    throw new Error("IMDb URL or ID must point to an HTTPS imdb.com/title/tt… page.");
  }
  return match[1].toLocaleLowerCase("en-US");
}

function omdbValue(value, fallback = "") {
  return typeof value === "string" && value.trim() && value !== "N/A"
    ? value.trim()
    : fallback;
}

function omdbList(value) {
  const normalized = omdbValue(value);
  return normalized ? normalized.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function splitNotes(value) {
  if (!value) return [];
  return value
    .split(/\r?\n\s*\r?\n/)
    .map((note) => note.trim())
    .filter(Boolean);
}

export async function fetchOmdbTitle(imdbId, apiKey, fetchImplementation = fetch) {
  const key = String(apiKey || "").trim();
  if (!key) {
    throw new Error("The OMDB_API_KEY repository secret is not configured.");
  }

  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("apikey", key);
  url.searchParams.set("i", extractImdbId(imdbId));
  url.searchParams.set("plot", "full");
  url.searchParams.set("r", "json");

  let response;
  try {
    response = await fetchImplementation(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    throw new Error("OMDb could not be reached. Try the form again later.");
  }
  if (!response.ok) {
    throw new Error(`OMDb returned HTTP ${response.status}.`);
  }

  const metadata = await response.json();
  if (metadata.Response !== "True") {
    const message = omdbValue(metadata.Error, "The title could not be found.");
    throw new Error(`OMDb rejected the IMDb title: ${message}`);
  }
  if (extractImdbId(metadata.imdbID) !== extractImdbId(imdbId)) {
    throw new Error("OMDb returned metadata for a different IMDb title.");
  }
  return metadata;
}

export function applyScreenMetadata(
  sourceData,
  metadata,
  responses,
  updateDate = new Date()
) {
  const data = structuredClone(validateNowData(sourceData));
  const imdbId = extractImdbId(metadata.imdbID);
  const title = omdbValue(metadata.Title);
  const type = omdbValue(metadata.Type).toLocaleLowerCase("en-US");
  if (!title) {
    throw new Error("OMDb metadata is missing the title.");
  }
  if (!new Set(["movie", "series", "episode"]).has(type)) {
    throw new Error(`Unsupported OMDb title type: ${type || "unknown"}.`);
  }

  const action = responseFor(responses, "On Screen action") || "Add to the current list";
  const existingIndex = data.screen.findIndex((candidate) => candidate.imdb_id === imdbId);
  const existingItem = existingIndex >= 0 ? data.screen[existingIndex] : undefined;
  const status = responseFor(responses, "Viewing status") || existingItem?.status || "In progress";
  const personalScore =
    responseFor(responses, "Personal score") || existingItem?.personal_score || "";
  const dateLabel = responseFor(responses, "Date label") || existingItem?.date_label || "";
  const personalNotes = responseFor(responses, "Personal notes");
  const notes = personalNotes === undefined
    ? existingItem?.notes || []
    : personalNotes === "[clear]"
      ? []
      : splitNotes(personalNotes);
  const poster = /^https:\/\//i.test(omdbValue(metadata.Poster))
    ? metadata.Poster.trim()
    : existingItem?.poster || "/assets/img/placeholder.png";

  const item = {
    kind: existingItem?.kind || "Watching",
    title,
    status,
    poster,
    imdb_id: imdbId,
    year: omdbValue(metadata.Year, "N/A"),
    type: type[0].toLocaleUpperCase("en-US") + type.slice(1),
    director: omdbValue(metadata.Director),
    genres: omdbList(metadata.Genre),
    cast: omdbList(metadata.Actors),
    plot: omdbValue(metadata.Plot, "No plot summary is available."),
    imdb_score: omdbValue(metadata.imdbRating, "N/A"),
    metascore: omdbValue(metadata.Metascore, "N/A"),
    personal_score: personalScore,
    date_label: dateLabel,
    awards: omdbValue(metadata.Awards, "N/A"),
    box_office: omdbValue(metadata.BoxOffice, "N/A"),
    notes
  };

  if (action === "Replace the current list") {
    data.screen = [item];
  } else if (action === "Add to the current list") {
    if (existingIndex >= 0) {
      data.screen.splice(existingIndex, 1);
    }
    data.screen.unshift(item);
  } else {
    throw new Error(`Unsupported On Screen action: ${action}.`);
  }

  data.last_updated = formatUpdateDate(updateDate);
  validateNowData(data);
  return {
    data,
    change: `${
      action === "Replace the current list"
        ? "Replaced On Screen with"
        : existingItem
          ? "Updated On Screen"
          : "Added to On Screen"
    }: ${title}`
  };
}

export function validateNowData(data) {
  assertPlainObject(data, "Now data");
  if (typeof data.last_updated !== "string" || !data.last_updated.trim()) {
    throw new Error("last_updated must be a non-empty string.");
  }

  assertPlainObject(data.music, "music");
  ["title", "artist", "album", "release_date", "release_date_iso"].forEach(
    (field) => {
      if (typeof data.music[field] !== "string") {
        throw new Error(`music.${field} must be a string.`);
      }
    }
  );
  assertHttpUrl(data.music.apple_url, "music.apple_url", "music.apple.com");
  assertHttpUrl(data.music.embed_url, "music.embed_url", "embed.music.apple.com");

  if (!Array.isArray(data.playlists)) {
    throw new Error("playlists must be an array.");
  }
  if (!Array.isArray(data.screen)) {
    throw new Error("screen must be an array.");
  }
  if (!Array.isArray(data.presently) || data.presently.length === 0) {
    throw new Error("presently must be a non-empty array.");
  }

  data.presently.forEach((item, index) => {
    assertPlainObject(item, `presently[${index}]`);
    if (typeof item.label !== "string" || typeof item.text !== "string") {
      throw new Error(`presently[${index}] requires string label and text values.`);
    }
  });

  data.screen.forEach((item, index) => {
    assertPlainObject(item, `screen[${index}]`);
    if (
      typeof item.title !== "string" ||
      !/^tt\d{7,10}$/.test(item.imdb_id) ||
      !Array.isArray(item.notes) ||
      !Array.isArray(item.genres) ||
      !Array.isArray(item.cast)
    ) {
      throw new Error(
        `screen[${index}] requires a title, IMDb ID, notes, genres, and cast.`
      );
    }
  });

  return data;
}

export function applyIssueResponses(sourceData, responses, updateDate = new Date()) {
  const data = structuredClone(validateNowData(sourceData));
  const changes = [];

  workshopFields.forEach(([heading, itemLabel]) => {
    const answer = responseFor(responses, heading);
    if (answer === undefined) return;

    const item = data.presently.find((candidate) => candidate.label === itemLabel);
    if (!item) {
      throw new Error(`The /now data does not contain the “${itemLabel}” card.`);
    }
    if (item.text !== answer) {
      item.text = answer;
      changes.push(heading);
    }
  });

  const screenNotes = responseFor(responses, "Current screen notes");
  if (screenNotes !== undefined) {
    if (!data.screen[0]) {
      throw new Error("Current screen notes were supplied, but no screen item exists.");
    }
    const notes = screenNotes === "[clear]" ? [] : splitNotes(screenNotes);
    if (JSON.stringify(notes) !== JSON.stringify(data.screen[0].notes)) {
      data.screen[0].notes = notes;
      changes.push("Current screen notes");
    }
  }

  const songUrl = responseFor(responses, "Featured Apple Music song");
  let musicChanged = false;
  if (songUrl !== undefined) {
    validateAppleMusicUrl(songUrl);
    if (data.music.apple_url !== songUrl) {
      data.music.apple_url = songUrl;
      musicChanged = true;
      changes.push("Featured Apple Music song");
    }
  }

  if (changes.length > 0) {
    data.last_updated = formatUpdateDate(updateDate);
  }

  validateNowData(data);
  return { data, changes, musicChanged };
}

async function main() {
  const eventPath = getArgumentValue("--event") || process.env.GITHUB_EVENT_PATH;
  const bodyFile = getArgumentValue("--body-file");
  const shouldWrite = process.argv.includes("--write");

  let issueBody;
  if (bodyFile) {
    issueBody = await readFile(path.resolve(bodyFile), "utf8");
  } else if (eventPath) {
    const event = JSON.parse(await readFile(path.resolve(eventPath), "utf8"));
    const owner = event.repository?.owner?.login;
    const author = event.issue?.user?.login;
    if (owner && author && owner.toLocaleLowerCase("en-US") !== author.toLocaleLowerCase("en-US")) {
      throw new Error("Only the repository owner may submit automated /now updates.");
    }
    issueBody = event.issue?.body;
  } else {
    throw new Error("Supply --event, --body-file, or GITHUB_EVENT_PATH.");
  }

  const sourceData = JSON.parse(await readFile(dataPath, "utf8"));
  const responses = parseIssueForm(issueBody);
  const result = applyIssueResponses(sourceData, responses);
  let finalData = result.data;
  const changes = [...result.changes];

  const imdbInput = responseFor(responses, "IMDb URL or ID");
  if (imdbInput !== undefined) {
    const imdbId = extractImdbId(imdbInput);
    const metadata = await fetchOmdbTitle(imdbId, process.env.OMDB_API_KEY);
    const screenResult = applyScreenMetadata(finalData, metadata, responses);
    finalData = screenResult.data;
    changes.push(screenResult.change);
  }

  if (changes.length === 0) {
    throw new Error("The form did not contain any new /now values.");
  }

  if (shouldWrite) {
    await writeFile(dataPath, `${JSON.stringify(finalData, null, 2)}\n`, "utf8");
  }

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `music_changed=${result.musicChanged}\nscreen_changed=${imdbInput !== undefined}\nchange_count=${changes.length}\n`,
      "utf8"
    );
  }

  process.stdout.write(
    `${shouldWrite ? "Applied" : "Previewed"} /now updates: ${changes.join(", ")}\n`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(`Unable to apply /now form: ${error.message}\n`);
    process.exitCode = 1;
  });
}
