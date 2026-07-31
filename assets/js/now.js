(function () {
  "use strict";

  if (window.__katalepsaraNowInitialized) {
    return;
  }
  window.__katalepsaraNowInitialized = true;

  var page = document.querySelector("[data-now-page]");
  if (!page) {
    return;
  }

  var CACHE_TTL_MS = 60 * 60 * 1000;
  var HISTORY_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  var HISTORY_SEARCH_RADIUS_DAYS = 7;
  var GITHUB_REPO_COUNT = 3;

  function removeLegacyHeadingLinks() {
    page.querySelectorAll(".anchor").forEach(function (anchor) {
      anchor.remove();
    });
  }

  function currentColorScheme() {
    var theme = document.documentElement.getAttribute("data-theme");
    if (theme === "dark" || theme === "light") {
      return theme;
    }
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function syncApplePlayerColorScheme() {
    var scheme = currentColorScheme();
    page
      .querySelectorAll(".now-song-player, [data-player-frame] iframe")
      .forEach(function (iframe) {
        /*
         * Apple's cross-origin player has no documented theme parameter.
         * color-scheme is a standards-based hint; Apple still owns the
         * iframe's internal presentation.
         */
        iframe.style.colorScheme = scheme;
      });
  }

  function observeColorScheme() {
    syncApplePlayerColorScheme();
    if (typeof MutationObserver !== "function") {
      return;
    }
    var observer = new MutationObserver(function (records) {
      if (
        records.some(function (record) {
          return record.attributeName === "data-theme";
        })
      ) {
        syncApplePlayerColorScheme();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });
  }

  function historyEventScore(event) {
    var text = String(event.text || "").toLowerCase();
    var signals = [
      ["adopt", 8],
      ["treaty", 8],
      ["convention", 8],
      ["independence", 7],
      ["elected", 7],
      ["launch", 6],
      ["discover", 6],
      ["first", 4],
      ["government", 3],
      ["war", 3]
    ];
    return signals.reduce(function (score, signal) {
      return score + (text.includes(signal[0]) ? signal[1] : 0);
    }, Math.min((event.pages || []).length, 4));
  }

  function dateWithOffset(date, dayOffset) {
    var candidate = new Date(date.getTime());
    candidate.setUTCDate(candidate.getUTCDate() + dayOffset);
    return candidate;
  }

  function onThisDayEndpoint(date) {
    var month = String(date.getUTCMonth() + 1).padStart(2, "0");
    var day = String(date.getUTCDate()).padStart(2, "0");
    return (
      "https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/" +
      month +
      "/" +
      day
    );
  }

  function historySourceUrl(event, releaseYear) {
    var page = (event.pages || [])[0];
    return (
      page &&
      page.content_urls &&
      page.content_urls.desktop &&
      page.content_urls.desktop.page
    ) || ("https://en.wikipedia.org/wiki/" + releaseYear);
  }

  async function findNearbyHistoricalEvent(releaseDate) {
    var releaseYear = releaseDate.getUTCFullYear();

    for (
      var distance = 0;
      distance <= HISTORY_SEARCH_RADIUS_DAYS;
      distance += 1
    ) {
      var offsets = distance === 0 ? [0] : [-distance, distance];
      for (var index = 0; index < offsets.length; index += 1) {
        var offset = offsets[index];
        var candidateDate = dateWithOffset(releaseDate, offset);

        try {
          var response = await window.fetch(onThisDayEndpoint(candidateDate), {
            headers: { Accept: "application/json" }
          });
          if (!response.ok) {
            continue;
          }
          var feed = await response.json();
          var matches = (feed.events || [])
            .filter(function (event) {
              return Number(event.year) === releaseYear;
            })
            .sort(function (left, right) {
              return historyEventScore(right) - historyEventScore(left);
            });

          if (matches.length) {
            return {
              event: matches[0],
              offset: offset,
              date: candidateDate,
              sourceUrl: historySourceUrl(matches[0], releaseYear)
            };
          }
        } catch (error) {
          // Try the next nearby date; the committed page remains meaningful.
        }
      }
    }
    return null;
  }

  function formatHistoryText(result) {
    var eventText = String(result.event.text || "")
      .replace(/\s+/g, " ")
      .trim();
    var eventDate = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    }).format(result.date);

    if (result.offset === 0) {
      return "On " + eventDate + ", " + eventText;
    }

    var distance = Math.abs(result.offset);
    var direction = result.offset < 0 ? "before" : "after";
    return (
      distance +
      " day" +
      (distance === 1 ? "" : "s") +
      " " +
      direction +
      " the release, on " +
      eventDate +
      ", " +
      eventText
    );
  }

  function renderHistoricalContext(card, result, fromCache) {
    var text = card.querySelector("[data-history-text]");
    var source = card.querySelector("[data-history-source]");
    var status = card.querySelector("[data-history-status]");
    text.textContent = result.text;
    source.href = result.sourceUrl;
    source.textContent = "Source on Wikipedia ↗";
    status.textContent = fromCache
      ? "Showing recently cached context from Wikimedia’s “On this day” feed."
      : "Selected from Wikimedia’s “On this day” feed using the catalog release date.";
  }

  async function initHistoricalContext() {
    var card = page.querySelector("[data-history-card]");
    if (!card || !window.fetch) {
      return;
    }

    var releaseDate = new Date(card.dataset.releaseDate + "T00:00:00Z");
    if (Number.isNaN(releaseDate.getTime())) {
      return;
    }

    var cacheKey = "katalepsara-now-history-v1-" + card.dataset.releaseDate;
    var cached = readCache(cacheKey, HISTORY_CACHE_TTL_MS);
    if (cached) {
      renderHistoricalContext(card, cached, true);
      return;
    }

    var result = await findNearbyHistoricalEvent(releaseDate);
    if (!result) {
      card.querySelector("[data-history-status]").textContent =
        "Wikipedia context is temporarily unavailable; the release date remains current.";
      return;
    }

    var rendered = {
      text: formatHistoryText(result),
      sourceUrl: result.sourceUrl
    };
    writeCache(cacheKey, rendered);
    renderHistoricalContext(card, rendered, false);
  }

  function initPlaylistPicker() {
    var picker = page.querySelector("[data-playlist-picker]");
    if (!picker) {
      return;
    }

    var tabs = Array.prototype.slice.call(
      picker.querySelectorAll("[data-playlist-embed]")
    );
    var panel = picker.querySelector("#now-playlist-panel");
    var frame = picker.querySelector("[data-player-frame]");
    var selectedTab = null;
    var loadedEmbed = "";

    if (!tabs.length || !panel || !frame) {
      return;
    }

    function updateSelection(tab, isOpen) {
      tabs.forEach(function (candidate) {
        var isSelected = isOpen && candidate === tab;
        candidate.classList.toggle("is-active", isSelected);
        candidate.setAttribute("aria-selected", String(isSelected));
        candidate.setAttribute("aria-expanded", String(isSelected));
      });

      panel.setAttribute("aria-labelledby", tab.id);
      panel.hidden = !isOpen;
    }

    function loadPlaylist(tab) {
      var embedUrl = tab && tab.dataset.playlistEmbed;
      if (!embedUrl || embedUrl === loadedEmbed) {
        return;
      }

      var iframe = document.createElement("iframe");
      iframe.src = embedUrl;
      iframe.title = tab.dataset.playlistTitle + " on Apple Music";
      iframe.loading = "lazy";
      iframe.setAttribute(
        "allow",
        "autoplay *; encrypted-media *; fullscreen *; clipboard-write"
      );
      iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");

      frame.replaceChildren(iframe);
      loadedEmbed = embedUrl;
      syncApplePlayerColorScheme();
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () {
        var shouldCollapse = selectedTab === tab && !panel.hidden;
        selectedTab = tab;
        updateSelection(tab, !shouldCollapse);
        if (shouldCollapse) {
          frame.replaceChildren();
          loadedEmbed = "";
        } else {
          loadPlaylist(tab);
        }
      });

      tab.addEventListener("keydown", function (event) {
        var nextIndex;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          nextIndex = (index + 1) % tabs.length;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          nextIndex = (index - 1 + tabs.length) % tabs.length;
        } else if (event.key === "Home") {
          nextIndex = 0;
        } else if (event.key === "End") {
          nextIndex = tabs.length - 1;
        } else {
          return;
        }

        event.preventDefault();
        tabs.forEach(function (candidate, candidateIndex) {
          candidate.setAttribute(
            "tabindex",
            candidateIndex === nextIndex ? "0" : "-1"
          );
        });
        tabs[nextIndex].focus();
      });
    });
  }

  function readCache(key, ttl) {
    try {
      var cached = JSON.parse(window.localStorage.getItem(key));
      var maximumAge = typeof ttl === "number" ? ttl : CACHE_TTL_MS;
      if (
        cached &&
        typeof cached.savedAt === "number" &&
        Date.now() - cached.savedAt < maximumAge
      ) {
        return cached.value;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function writeCache(key, value) {
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify({ savedAt: Date.now(), value: value })
      );
    } catch (error) {
      // Storage can be disabled in private browsing; the live card still works.
    }
  }

  function formatRepositoryDate(dateValue) {
    var date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(undefined, {
      notation: Number(value) >= 10000 ? "compact" : "standard",
      maximumFractionDigits: 1
    }).format(Number(value) || 0);
  }

  function accountAge(createdAt) {
    var created = new Date(createdAt);
    if (Number.isNaN(created.getTime())) {
      return "—";
    }
    var years =
      (Date.now() - created.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
    return years < 1 ? "<1" : String(Math.floor(years));
  }

  function renderGitHubCard(card, payload, fromCache) {
    var user = payload.user;
    var repos = payload.repos || [];
    var name = card.querySelector("[data-github-name]");
    var avatar = card.querySelector("[data-github-avatar]");
    var bio = card.querySelector("[data-github-bio]");
    var years = card.querySelector("[data-github-years]");
    var repoCount = card.querySelector("[data-github-repos]");
    var stars = card.querySelector("[data-github-stars]");
    var commits = card.querySelector("[data-github-commits]");
    var recent = card.querySelector("[data-github-recent]");
    var list = card.querySelector("[data-github-repo-list]");
    var status = card.querySelector("[data-github-status]");

    if (user.name) {
      name.textContent = user.name;
    }
    if (user.avatar_url) {
      avatar.src = user.avatar_url;
    }
    if (user.bio) {
      bio.textContent = user.bio;
    }
    var starCount = repos
      .filter(function (repository) {
        return !repository.fork;
      })
      .reduce(function (total, repository) {
        return total + Number(repository.stargazers_count || 0);
      }, 0);

    years.textContent = accountAge(user.created_at);
    repoCount.textContent = formatNumber(user.public_repos);
    stars.textContent = formatNumber(starCount);
    commits.textContent =
      typeof payload.commitCount === "number"
        ? "≈" + formatNumber(payload.commitCount)
        : "—";

    list.replaceChildren();
    repos
      .filter(function (repository) {
        return !repository.fork;
      })
      .slice(0, GITHUB_REPO_COUNT)
      .forEach(function (repository) {
        var item = document.createElement("li");
        var link = document.createElement("a");
        var label = document.createElement("span");
        link.href = repository.html_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.append(document.createTextNode(repository.name));
        label.textContent = formatRepositoryDate(repository.updated_at);
        link.appendChild(label);
        item.appendChild(link);
        list.appendChild(item);
      });

    if (list.children.length) {
      recent.hidden = false;
    }
    status.textContent = fromCache
      ? "Showing recently cached public GitHub details."
      : "Public details refreshed from GitHub.";
  }

  async function initGitHubCard() {
    var card = page.querySelector("[data-github-card]");
    if (!card || !window.fetch) {
      return;
    }

    var apiUrl = card.dataset.githubApi;
    var username = page.dataset.githubUser;
    var cacheKey = "katalepsara-now-github-v2-" + username;
    var cached = readCache(cacheKey);

    if (cached) {
      renderGitHubCard(card, cached, true);
      return;
    }

    var status = card.querySelector("[data-github-status]");

    try {
      var responses = await Promise.all([
        window.fetch(apiUrl, {
          headers: { Accept: "application/vnd.github+json" }
        }),
        window.fetch(
          apiUrl + "/repos?sort=updated&direction=desc&per_page=100&type=owner",
          { headers: { Accept: "application/vnd.github+json" } }
        )
      ]);

      if (!responses[0].ok || !responses[1].ok) {
        throw new Error("GitHub returned a non-success response.");
      }

      var values = await Promise.all([
        responses[0].json(),
        responses[1].json()
      ]);
      var commitCount = null;

      try {
        var searchUrl =
          "https://api.github.com/search/commits?q=" +
          encodeURIComponent("author:" + username) +
          "&per_page=1";
        var commitResponse = await window.fetch(searchUrl, {
          headers: { Accept: "application/vnd.github+json" }
        });
        if (commitResponse.ok) {
          var commitSearch = await commitResponse.json();
          commitCount = Number(commitSearch.total_count);
        }
      } catch (commitError) {
        // The lower search rate limit should not prevent core stats rendering.
      }

      var payload = {
        user: values[0],
        repos: values[1],
        commitCount: Number.isFinite(commitCount) ? commitCount : null
      };
      writeCache(cacheKey, payload);
      renderGitHubCard(card, payload, false);
    } catch (error) {
      status.textContent =
        "Live GitHub details are unavailable; the profile link still works.";
    }
  }

  removeLegacyHeadingLinks();
  observeColorScheme();
  initHistoricalContext();
  initPlaylistPicker();
  initGitHubCard();
})();
