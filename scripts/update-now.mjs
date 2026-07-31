#!/usr/bin/env node

/**
 * Refresh the featured Apple Music metadata and propose a nearby historical
 * event from Wikipedia. This is deliberately a build-time task: readers never
 * depend on these services, and the generated sentence can be reviewed before
 * publication.
 *
 * Preview: node scripts/update-now.mjs
 * Apply:   node scripts/update-now.mjs --write
 */

import { readFile, writeFile } from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const dataPath = path.join(repositoryRoot, "_data", "now.json");
const shouldWrite = process.argv.includes("--write");
const userAgent =
  "KatalepsaraNowPage/1.0 (https://katalepsara.com/now/; public metadata refresh)";

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": userAgent
        }
      },
      (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          requestJson(new URL(response.headers.location, url).href).then(
            resolve,
            reject
          );
          return;
        }

        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(
              new Error(
                `Request failed (${response.statusCode}) for ${url}: ${body.slice(0, 180)}`
              )
            );
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Invalid JSON returned by ${url}`));
          }
        });
      }
    );
    request.setTimeout(15000, () => {
      request.destroy(new Error(`Request timed out for ${url}`));
    });
    request.on("error", reject);
  });
}

function getTrackId(music) {
  if (music.track_id) {
    return String(music.track_id);
  }
  const match = String(music.apple_url || "").match(/\/(\d+)(?:\?|$)/);
  if (!match) {
    throw new Error("The featured Apple Music URL does not contain a track ID.");
  }
  return match[1];
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

function scoreEvent(event) {
  const text = String(event.text || "").toLowerCase();
  const signals = [
    ["adopt", 8],
    ["treaty", 8],
    ["convention", 8],
    ["elected", 7],
    ["launch", 6],
    ["discover", 6],
    ["independence", 6],
    ["first", 4],
    ["war", 3],
    ["government", 3]
  ];
  return signals.reduce(
    (score, [term, weight]) => score + (text.includes(term) ? weight : 0),
    Math.min((event.pages || []).length, 4)
  );
}

async function findHistoricalEvent(releaseDate) {
  const target = new Date(releaseDate);
  const targetYear = target.getUTCFullYear();

  for (let distance = 0; distance <= 7; distance += 1) {
    const offsets = distance === 0 ? [0] : [-distance, distance];
    for (const offset of offsets) {
      const candidate = new Date(target);
      candidate.setUTCDate(candidate.getUTCDate() + offset);
      const month = String(candidate.getUTCMonth() + 1).padStart(2, "0");
      const day = String(candidate.getUTCDate()).padStart(2, "0");
      const endpoint =
        `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/${month}/${day}`;
      const feed = await requestJson(endpoint);
      const matches = (feed.events || [])
        .filter((event) => Number(event.year) === targetYear)
        .sort((left, right) => scoreEvent(right) - scoreEvent(left));

      if (!matches.length) {
        continue;
      }

      const event = matches[0];
      const page = (event.pages || [])[0];
      const sourceUrl =
        page &&
        page.content_urls &&
        page.content_urls.desktop &&
        page.content_urls.desktop.page
          ? page.content_urls.desktop.page
          : `https://en.wikipedia.org/wiki/${targetYear}`;
      const lead =
        offset === 0
          ? `On this day in ${targetYear}: `
          : `Within ${Math.abs(offset)} day${Math.abs(offset) === 1 ? "" : "s"} of the release, `;

      return {
        text: lead + String(event.text || "").replace(/\s+/g, " ").trim(),
        source_url: sourceUrl,
        source_label: "Historical context on Wikipedia"
      };
    }
  }

  return {
    text: `Explore notable events from ${target.getUTCMonth() + 1}/${targetYear} on Wikipedia.`,
    source_url: `https://en.wikipedia.org/wiki/${targetYear}`,
    source_label: `Events of ${targetYear} on Wikipedia`
  };
}

async function main() {
  const nowData = JSON.parse(await readFile(dataPath, "utf8"));
  const trackId = getTrackId(nowData.music);
  const lookupUrl =
    `https://itunes.apple.com/lookup?id=${encodeURIComponent(trackId)}&country=us`;
  const lookup = await requestJson(lookupUrl);
  const track = (lookup.results || []).find(
    (item) => String(item.trackId) === trackId
  );

  if (!track) {
    throw new Error(`Apple did not return song metadata for track ${trackId}.`);
  }

  const appleUrl = `https://music.apple.com/us/song/${track.trackId}`;
  const history = await findHistoricalEvent(track.releaseDate);
  const proposal = {
    ...nowData.music,
    title: track.trackName,
    artist: track.artistName,
    album: track.collectionName,
    release_date: formatDate(track.releaseDate),
    apple_url: appleUrl,
    embed_url: appleUrl.replace(
      "https://music.apple.com/",
      "https://embed.music.apple.com/"
    ),
    track_id: String(track.trackId),
    history
  };

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: shouldWrite ? "write" : "preview",
        featured_song: proposal.title,
        album: proposal.album,
        release_date: proposal.release_date,
        historical_context: proposal.history
      },
      null,
      2
    )}\n`
  );

  if (shouldWrite) {
    nowData.music = proposal;
    await writeFile(dataPath, `${JSON.stringify(nowData, null, 2)}\n`, "utf8");
    process.stdout.write(`Updated ${path.relative(repositoryRoot, dataPath)}.\n`);
  } else {
    process.stdout.write("No files changed. Re-run with --write after reviewing the preview.\n");
  }
}

main().catch((error) => {
  process.stderr.write(`Unable to refresh /now metadata: ${error.message}\n`);
  process.exitCode = 1;
});
