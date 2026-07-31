#!/usr/bin/env node

/**
 * Refresh the featured Apple Music metadata, including the machine-readable
 * catalog release date used by the page's live Wikimedia enrichment.
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
  try {
    const appleUrl = new URL(String(music.apple_url || ""));
    const queryTrackId = appleUrl.searchParams.get("i");
    if (queryTrackId && /^\d+$/.test(queryTrackId)) {
      return queryTrackId;
    }
    const pathMatch = appleUrl.pathname.match(/\/(\d+)\/?$/);
    if (pathMatch) {
      return pathMatch[1];
    }
  } catch (error) {
    // Fall back to the stored ID when the URL is temporarily incomplete.
  }
  if (music.track_id) {
    return String(music.track_id);
  }
  throw new Error("The featured Apple Music URL does not contain a track ID.");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
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
  const proposal = {
    ...nowData.music,
    title: track.trackName,
    artist: track.artistName,
    album: track.collectionName,
    release_date: formatDate(track.releaseDate),
    release_date_iso: new Date(track.releaseDate).toISOString().slice(0, 10),
    apple_url: appleUrl,
    embed_url: appleUrl.replace(
      "https://music.apple.com/",
      "https://embed.music.apple.com/"
    ),
    track_id: String(track.trackId)
  };

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: shouldWrite ? "write" : "preview",
        featured_song: proposal.title,
        album: proposal.album,
        release_date: proposal.release_date,
        release_date_iso: proposal.release_date_iso
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
