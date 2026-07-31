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
  var GITHUB_REPO_COUNT = 3;

  function initPlaylistPicker() {
    var picker = page.querySelector("[data-playlist-picker]");
    if (!picker) {
      return;
    }

    var tabs = Array.prototype.slice.call(
      picker.querySelectorAll("[data-playlist-embed]")
    );
    var panel = picker.querySelector("#now-playlist-panel");
    var emptyState = picker.querySelector("[data-player-empty]");
    var loadButton = picker.querySelector("[data-load-player]");
    var frame = picker.querySelector("[data-player-frame]");
    var externalLink = picker.querySelector("[data-playlist-link]");
    var externalTitle = picker.querySelector("[data-playlist-link-title]");
    var selectedTab = tabs[0];
    var loadedEmbed = "";

    if (!tabs.length || !panel || !frame) {
      return;
    }

    function updateSelection(tab, shouldFocus) {
      selectedTab = tab;
      tabs.forEach(function (candidate) {
        var isSelected = candidate === tab;
        candidate.classList.toggle("is-active", isSelected);
        candidate.setAttribute("aria-selected", String(isSelected));
        candidate.setAttribute("tabindex", isSelected ? "0" : "-1");
      });

      panel.setAttribute("aria-labelledby", tab.id);
      externalLink.href = tab.dataset.playlistUrl;
      externalTitle.textContent = tab.dataset.playlistTitle;
      loadButton.textContent = "Load " + tab.dataset.playlistTitle;

      if (shouldFocus) {
        tab.focus();
      }
    }

    function loadSelectedPlaylist() {
      var embedUrl = selectedTab && selectedTab.dataset.playlistEmbed;
      if (!embedUrl || embedUrl === loadedEmbed) {
        return;
      }

      var iframe = document.createElement("iframe");
      iframe.src = embedUrl;
      iframe.title = selectedTab.dataset.playlistTitle + " on Apple Music";
      iframe.loading = "lazy";
      iframe.setAttribute(
        "allow",
        "autoplay *; encrypted-media *; fullscreen *; clipboard-write"
      );
      iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");

      frame.replaceChildren(iframe);
      frame.hidden = false;
      emptyState.hidden = true;
      loadedEmbed = embedUrl;
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () {
        updateSelection(tab, false);
        loadSelectedPlaylist();
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
        updateSelection(tabs[nextIndex], true);
        loadSelectedPlaylist();
      });
    });

    loadButton.addEventListener("click", loadSelectedPlaylist);
    updateSelection(selectedTab, false);

    if (window.matchMedia("(min-width: 721px)").matches) {
      var schedule = window.requestIdleCallback || function (callback) {
        window.setTimeout(callback, 1);
      };
      schedule(loadSelectedPlaylist);
    }
  }

  function readCache(key) {
    try {
      var cached = JSON.parse(window.localStorage.getItem(key));
      if (
        cached &&
        typeof cached.savedAt === "number" &&
        Date.now() - cached.savedAt < CACHE_TTL_MS
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

  function renderGitHubCard(card, payload, fromCache) {
    var user = payload.user;
    var repos = payload.repos || [];
    var name = card.querySelector("[data-github-name]");
    var avatar = card.querySelector("[data-github-avatar]");
    var bio = card.querySelector("[data-github-bio]");
    var repoCount = card.querySelector("[data-github-repos]");
    var followers = card.querySelector("[data-github-followers]");
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
    repoCount.textContent = String(user.public_repos);
    followers.textContent = String(user.followers);

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
    var cacheKey = "katalepsara-now-github-v1-" + username;
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
          apiUrl + "/repos?sort=updated&direction=desc&per_page=6&type=owner",
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
      var payload = { user: values[0], repos: values[1] };
      writeCache(cacheKey, payload);
      renderGitHubCard(card, payload, false);
    } catch (error) {
      status.textContent =
        "Live GitHub details are unavailable; the profile link still works.";
    }
  }

  initPlaylistPicker();
  initGitHubCard();
})();
