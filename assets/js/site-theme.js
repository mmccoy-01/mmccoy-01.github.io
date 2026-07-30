(function () {
  "use strict";

  if (window.__siteThemeInitialized) {
    return;
  }
  window.__siteThemeInitialized = true;

  var STORAGE_KEY = "katalepsara-color-theme";
  var DARK_QUERY = "(prefers-color-scheme: dark)";
  var mediaQuery = typeof window.matchMedia === "function"
    ? window.matchMedia(DARK_QUERY)
    : null;
  var explicitPreference = readPreference();
  var currentTheme = resolveTheme();
  var giscusObserver = null;

  function readPreference() {
    try {
      var value = window.localStorage.getItem(STORAGE_KEY);
      return value === "dark" || value === "light" ? value : null;
    } catch (error) {
      return null;
    }
  }

  function savePreference(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      // The selected theme still applies for this page when storage is blocked.
    }
  }

  function resolveTheme() {
    if (explicitPreference) {
      return explicitPreference;
    }
    return mediaQuery && mediaQuery.matches ? "dark" : "light";
  }

  function setQuartoMode(theme) {
    if (!document.body || !document.body.classList.contains("quarto-light") &&
        !document.body.classList.contains("quarto-dark")) {
      return;
    }

    document.body.classList.toggle("quarto-dark", theme === "dark");
    // Keep Quarto's generated light class because its base stylesheet is built
    // against it; our later stylesheet supplies the dark palette overrides.
    document.body.classList.add("quarto-light");
  }

  function updateThemeColor(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = theme === "dark" ? "#171613" : "#f7f5ef";
  }

  function updateButtons(theme) {
    var dark = theme === "dark";
    var label = dark ? "Switch to light mode" : "Switch to dark mode";

    document.querySelectorAll("[data-site-theme-toggle]").forEach(function (button) {
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      button.setAttribute("aria-pressed", dark ? "true" : "false");
    });
  }

  function syncGiscus(theme) {
    var frame = document.querySelector("iframe.giscus-frame");
    if (!frame || !frame.contentWindow) {
      return false;
    }
    frame.contentWindow.postMessage({
      giscus: {
        setConfig: {
          theme: theme === "dark" ? "dark_high_contrast" : "light_high_contrast"
        }
      }
    }, "https://giscus.app");
    return true;
  }

  function watchForGiscus() {
    if (!document.body || syncGiscus(currentTheme) ||
        typeof MutationObserver !== "function" || giscusObserver) {
      return;
    }
    giscusObserver = new MutationObserver(function () {
      if (syncGiscus(currentTheme)) {
        giscusObserver.disconnect();
        giscusObserver = null;
      }
    });
    giscusObserver.observe(document.body, { childList: true, subtree: true });
  }

  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    setQuartoMode(theme);
    updateThemeColor(theme);
    updateButtons(theme);
    syncGiscus(theme);
  }

  function toggleTheme(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    explicitPreference = currentTheme === "dark" ? "light" : "dark";
    savePreference(explicitPreference);
    applyTheme(explicitPreference);
  }

  function buttonMarkup() {
    return [
      '<svg class="site-theme-icon site-theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true">',
      '<path d="M20.7 14.1A8.5 8.5 0 0 1 9.9 3.3 8.7 8.7 0 1 0 20.7 14.1Z"></path>',
      "</svg>",
      '<svg class="site-theme-icon site-theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true">',
      '<circle cx="12" cy="12" r="4"></circle>',
      '<path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"></path>',
      "</svg>"
    ].join("");
  }

  function createButton() {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "site-theme-toggle";
    button.setAttribute("data-site-theme-toggle", "");
    button.innerHTML = buttonMarkup();
    return button;
  }

  function insertButton(search, location) {
    if (!search || !search.parentNode ||
        document.querySelector(
          '[data-site-theme-location="' + location + '"]'
        )) {
      return;
    }

    var button = createButton();
    button.setAttribute("data-site-theme-location", location);
    search.parentNode.insertBefore(button, search);
  }

  function prepareButton(button) {
    if (button.dataset.siteThemeReady === "true") {
      return;
    }
    button.dataset.siteThemeReady = "true";
    button.addEventListener("click", toggleTheme);
  }

  function ensureToolbarButton() {
    var jekyllSearch = document.querySelector("#search.dosearch");
    var quartoSearch = document.querySelector(".quarto-search-button");
    var sidebarSearch = document.querySelector(".sidebar-search");

    if (!document.querySelector("[data-site-theme-toggle]")) {
      insertButton(jekyllSearch, "jekyll-toolbar");
    }
    insertButton(quartoSearch, "quarto-toolbar");

    if (sidebarSearch &&
        !document.querySelector('[data-site-theme-location="quarto-sidebar"]')) {
      var sidebarButton = createButton();
      sidebarButton.setAttribute("data-site-theme-location", "quarto-sidebar");
      sidebarSearch.appendChild(sidebarButton);
    }

    var buttons = document.querySelectorAll("[data-site-theme-toggle]");
    buttons.forEach(prepareButton);
    setQuartoMode(currentTheme);
    updateButtons(currentTheme);
    watchForGiscus();
  }

  applyTheme(currentTheme);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureToolbarButton, { once: true });
  } else {
    ensureToolbarButton();
  }

  document.addEventListener("quarto:loaded", ensureToolbarButton);
  window.addEventListener("pageshow", function () {
    explicitPreference = readPreference();
    applyTheme(resolveTheme());
    ensureToolbarButton();
  });
  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY) {
      explicitPreference = event.newValue === "dark" || event.newValue === "light"
        ? event.newValue
        : null;
      applyTheme(resolveTheme());
    }
  });

  if (mediaQuery) {
    var handleSystemChange = function () {
      if (!explicitPreference) {
        applyTheme(resolveTheme());
      }
    };
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleSystemChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleSystemChange);
    }
  }

  window.SiteTheme = {
    getTheme: function () {
      return currentTheme;
    },
    useSystemPreference: function () {
      explicitPreference = null;
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        // Storage may be unavailable; the system preference still applies now.
      }
      applyTheme(resolveTheme());
    }
  };
}());
