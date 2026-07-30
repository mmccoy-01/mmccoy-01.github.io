/**
 * Highlight-triggered GitHub collaboration for the rendered Quarto book.
 *
 * This file is intentionally dependency-free. Keep configuration values in this
 * block so the same asset can be copied into future Quarto renders.
 */
(() => {
  "use strict";

  const CONFIG = Object.freeze({
    repositoryOwner: "mmccoy-01",
    repositoryName: "mmccoy-01.github.io",
    discussionCategory: "general",
    publicBookUrl: "https://katalepsara.com/book/",
    minimumSelectionLength: 8,
    maximumSelectionLength: 1200,
    allowedContentSelector: "main.content#quarto-document-content",
    excludedSelectors: [
      "nav",
      "header",
      "footer",
      "button",
      "[role='button']",
      "input",
      "textarea",
      "select",
      "option",
      "label",
      "form",
      "pre",
      "code",
      "kbd",
      "samp",
      ".sourceCode",
      ".code-with-filename",
      ".cell",
      ".github-highlight-menu",
      ".github-highlight-toast",
    ].join(","),
    // Set only after this exact label exists in the configured repository.
    issueLabel: "",
  });

  const INSTANCE_KEY = "__githubHighlightCollaboration";
  if (window[INSTANCE_KEY]) {
    window[INSTANCE_KEY].refresh();
    return;
  }

  const state = {
    content: null,
    menu: null,
    toast: null,
    buttons: {},
    storedSelection: null,
    selectionTimer: 0,
    toastTimer: 0,
    lastLengthNotice: 0,
    menuInteraction: false,
    scrollOrigin: null,
    repositionFrame: 0,
    sourceMapPromise: null,
    sourceMap: {},
  };

  const getElementForNode = (node) =>
    node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;

  const normalizeWhitespace = (value) =>
    value
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[\t\f\v ]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const characterCount = (value) => Array.from(value).length;

  const markdownBlockquote = (value) =>
    value
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");

  const currentBookPath = () => {
    const offset =
      document.querySelector('meta[name="quarto:offset"]')?.content || "./";
    const rootUrl = new URL(offset, document.baseURI);
    const currentUrl = new URL(window.location.href);
    const rootPath = rootUrl.pathname.endsWith("/")
      ? rootUrl.pathname
      : `${rootUrl.pathname}/`;
    let relativePath = currentUrl.pathname.startsWith(rootPath)
      ? currentUrl.pathname.slice(rootPath.length)
      : currentUrl.pathname.split("/book/").pop();

    relativePath = decodeURIComponent(relativePath || "index.html");
    return relativePath.endsWith("/") ? `${relativePath}index.html` : relativePath;
  };

  const publicPageUrl = () =>
    new URL(currentBookPath(), CONFIG.publicBookUrl).toString();

  const pageTitle = () => {
    const heading = state.content?.querySelector(
      ".quarto-title h1.title, .quarto-title h1, h1.title"
    );
    if (heading?.textContent?.trim()) {
      return normalizeWhitespace(heading.textContent);
    }

    const breadcrumb = document.querySelector(
      ".quarto-page-breadcrumbs .chapter-title"
    );
    if (breadcrumb?.textContent?.trim()) {
      return normalizeWhitespace(breadcrumb.textContent);
    }

    return normalizeWhitespace(
      document.title.replace(/\s+[–—-]\s+Katalepsara\s*$/u, "")
    );
  };

  const loadSourceMap = () => {
    if (!state.sourceMapPromise) {
      const offset =
        document.querySelector('meta[name="quarto:offset"]')?.content || "./";
      const mapUrl = new URL(`${offset}page-source-map.json`, document.baseURI);
      state.sourceMapPromise = fetch(mapUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Source map request failed: ${response.status}`);
          }
          return response.json();
        })
        .then((sourceMap) => {
          state.sourceMap = sourceMap;
          return sourceMap;
        })
        .catch(() => ({}));
    }
    return state.sourceMapPromise;
  };

  const sourcePathForPage = () => {
    const metadataPath = document.querySelector(
      'meta[name="github-highlight-source"]'
    )?.content;
    if (metadataPath) {
      return metadataPath;
    }
    return state.sourceMap[currentBookPath()] || "Source path unavailable";
  };

  const rangeTouchesExcludedContent = (range) => {
    const startElement = getElementForNode(range.startContainer);
    const endElement = getElementForNode(range.endContainer);
    if (
      startElement?.closest(CONFIG.excludedSelectors) ||
      endElement?.closest(CONFIG.excludedSelectors)
    ) {
      return true;
    }

    return Array.from(
      state.content.querySelectorAll(CONFIG.excludedSelectors)
    ).some((element) => {
      try {
        return range.intersectsNode(element);
      } catch {
        return false;
      }
    });
  };

  const rangeIsInsideContent = (range) => {
    const startElement = getElementForNode(range.startContainer);
    const endElement = getElementForNode(range.endContainer);
    return (
      state.content?.contains(startElement) &&
      state.content?.contains(endElement) &&
      !rangeTouchesExcludedContent(range)
    );
  };

  const nearestContextBlock = (node) =>
    getElementForNode(node)?.closest(
      "p, li, blockquote, dd, dt, figcaption, h1, h2, h3, h4, h5, h6"
    );

  const contextFragment = (range, beforeSelection) => {
    const block = nearestContextBlock(
      beforeSelection ? range.startContainer : range.endContainer
    );
    if (!block || !state.content.contains(block)) {
      return "";
    }

    const contextRange = document.createRange();
    try {
      if (beforeSelection) {
        contextRange.selectNodeContents(block);
        contextRange.setEnd(range.startContainer, range.startOffset);
      } else {
        contextRange.selectNodeContents(block);
        contextRange.setStart(range.endContainer, range.endOffset);
      }
    } catch {
      return "";
    }

    const normalized = normalizeWhitespace(contextRange.toString());
    const limit = 240;
    if (characterCount(normalized) <= limit) {
      return normalized;
    }

    const characters = Array.from(normalized);
    return beforeSelection
      ? `…${characters.slice(-limit).join("")}`
      : `${characters.slice(0, limit).join("")}…`;
  };

  const snapshotSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount !== 1) {
      return null;
    }

    const range = selection.getRangeAt(0);
    if (!rangeIsInsideContent(range)) {
      return null;
    }

    const text = normalizeWhitespace(selection.toString());
    const length = characterCount(text);
    if (
      length < CONFIG.minimumSelectionLength ||
      !/[\p{L}\p{N}]/u.test(text)
    ) {
      return null;
    }

    if (length > CONFIG.maximumSelectionLength) {
      const now = Date.now();
      if (now - state.lastLengthNotice > 2500) {
        showToast(
          `Please select no more than ${CONFIG.maximumSelectionLength.toLocaleString()} characters.`
        );
        state.lastLengthNotice = now;
      }
      return null;
    }

    const clonedRange = range.cloneRange();
    return {
      text,
      range: clonedRange,
      contextBefore: contextFragment(clonedRange, true),
      contextAfter: contextFragment(clonedRange, false),
      title: pageTitle(),
      pageUrl: publicPageUrl(),
    };
  };

  const selectionRect = (range) => {
    const rects = Array.from(range.getClientRects()).filter(
      (rect) => rect.width || rect.height
    );
    if (rects.length) {
      return rects[rects.length - 1];
    }
    const rect = range.getBoundingClientRect();
    return rect.width || rect.height ? rect : null;
  };

  const positionMenu = () => {
    if (!state.storedSelection || state.menu.hidden) {
      return;
    }

    const rect = selectionRect(state.storedSelection.range);
    if (!rect) {
      hideMenu();
      return;
    }

    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const margin = 10;
    const gap = 10;

    state.menu.style.visibility = "hidden";
    state.menu.hidden = false;
    const menuRect = state.menu.getBoundingClientRect();

    const minLeft = viewportLeft + margin;
    const maxLeft =
      viewportLeft + viewportWidth - menuRect.width - margin;
    const desiredLeft = rect.left + rect.width / 2 - menuRect.width / 2;
    const left = Math.min(Math.max(desiredLeft, minLeft), Math.max(minLeft, maxLeft));

    const above = rect.top - menuRect.height - gap;
    const below = rect.bottom + gap;
    const minTop = viewportTop + margin;
    const maxTop =
      viewportTop + viewportHeight - menuRect.height - margin;
    const top =
      above >= minTop
        ? above
        : Math.min(Math.max(below, minTop), Math.max(minTop, maxTop));

    state.menu.style.left = `${Math.round(left)}px`;
    state.menu.style.top = `${Math.round(top)}px`;
    state.menu.style.visibility = "visible";
  };

  const announceActions = () => {
    state.toast.textContent =
      "Passage selected. Suggest edit and Discuss passage actions are available.";
  };

  const showMenuForSelection = () => {
    if (state.menuInteraction) {
      return;
    }

    const snapshot = snapshotSelection();
    if (!snapshot) {
      hideMenu();
      return;
    }

    state.storedSelection = snapshot;
    state.scrollOrigin = {
      x: window.scrollX,
      y: window.scrollY,
    };
    state.menu.hidden = false;
    positionMenu();
    announceActions();
  };

  const scheduleSelectionCheck = (delay = 180) => {
    window.clearTimeout(state.selectionTimer);
    state.selectionTimer = window.setTimeout(showMenuForSelection, delay);
  };

  const hideMenu = ({ returnFocus = false } = {}) => {
    window.clearTimeout(state.selectionTimer);
    if (!state.menu) {
      return;
    }

    const hadMenuFocus = state.menu.contains(document.activeElement);
    state.menu.hidden = true;
    state.menu.style.visibility = "";
    state.storedSelection = null;
    state.scrollOrigin = null;

    if (returnFocus && hadMenuFocus) {
      state.content?.focus({ preventScroll: true });
    }
  };

  const showToast = (message) => {
    window.clearTimeout(state.toastTimer);
    state.toast.textContent = message;
    state.toast.classList.add("is-visible");
    state.toastTimer = window.setTimeout(() => {
      state.toast.classList.remove("is-visible");
    }, 4200);
  };

  const restoreStoredRange = () => {
    if (!state.storedSelection) {
      return;
    }
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(state.storedSelection.range);
  };

  const openGitHub = (url) => {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      // Browsers using `noopener` can return null even when the tab opened, so
      // avoid falsely reporting a blocked popup. The synchronous call preserves
      // normal popup-blocker compatibility.
    }
  };

  const buildIssueBody = (selection, sourcePath) => {
    const context = [];
    if (selection.contextBefore) {
      context.push(
        "**Immediately before:**",
        "",
        markdownBlockquote(selection.contextBefore),
        ""
      );
    }
    if (selection.contextAfter) {
      context.push(
        "**Immediately after:**",
        "",
        markdownBlockquote(selection.contextAfter),
        ""
      );
    }
    if (!context.length) {
      context.push("_No reliable surrounding paragraph context was available._", "");
    }

    return [
      "## Suggested edit",
      "",
      `**Source file:** \`${sourcePath}\``,
      `**Rendered page:** ${selection.title}`,
      `**Public URL:** ${selection.pageUrl}`,
      "",
      "### Exact selected passage",
      "",
      markdownBlockquote(selection.text),
      "",
      "### Surrounding context",
      "",
      ...context,
      "### Proposed replacement text",
      "",
      "<!-- Replace this comment with the wording you propose. -->",
      "",
      "",
      "### Additional explanation",
      "",
      "<!-- Optional: explain why this change would improve the passage. -->",
      "",
      "",
      "---",
      "",
      "If accepted, this suggestion can be implemented as a source commit or pull request by a repository maintainer. Highlighting rendered HTML does not itself modify the source or create a pull request.",
    ].join("\n");
  };

  const suggestEdit = () => {
    const selection = state.storedSelection;
    if (!selection) {
      return;
    }

    const sourcePath = sourcePathForPage();
    const params = new URLSearchParams({
      title: `Suggested edit: ${selection.title}`,
      body: buildIssueBody(selection, sourcePath),
    });
    if (CONFIG.issueLabel) {
      params.set("labels", CONFIG.issueLabel);
    }

    openGitHub(
      `https://github.com/${encodeURIComponent(
        CONFIG.repositoryOwner
      )}/${encodeURIComponent(CONFIG.repositoryName)}/issues/new?${params}`
    );
    hideMenu();
  };

  const discussionTemplate = (selection) =>
    [
      `# Discussion: ${selection.title}`,
      "",
      `**Page:** [${selection.title}](${selection.pageUrl})`,
      "",
      "## Selected passage",
      "",
      markdownBlockquote(selection.text),
      "",
      "## Comment",
      "",
      "<!-- Add your question or comment here, then paste this template into GitHub. -->",
      "",
    ].join("\n");

  const fallbackCopyText = (text) => {
    const textarea = document.createElement("textarea");
    const activeElement = document.activeElement;
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.fontSize = "16px";
    document.body.append(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }

    textarea.remove();
    activeElement?.focus?.({ preventScroll: true });
    return copied;
  };

  const copyText = async (text) => {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Permission denial and older Safari versions use the fallback below.
      }
    }
    return fallbackCopyText(text);
  };

  const discussPassage = async () => {
    const selection = state.storedSelection;
    if (!selection) {
      return;
    }

    const template = discussionTemplate(selection);
    const copyPromise = copyText(template);
    const category = encodeURIComponent(CONFIG.discussionCategory);
    openGitHub(
      `https://github.com/${encodeURIComponent(
        CONFIG.repositoryOwner
      )}/${encodeURIComponent(
        CONFIG.repositoryName
      )}/discussions/new?category=${category}`
    );
    hideMenu();

    const copied = await copyPromise;
    showToast(
      copied
        ? "Passage context copied. Paste it into the new GitHub Discussion."
        : "GitHub opened, but the browser could not copy the passage context."
    );
  };

  const createInterface = () => {
    const menu = document.createElement("div");
    menu.className = "github-highlight-menu";
    menu.setAttribute("role", "toolbar");
    menu.setAttribute("aria-label", "Actions for the selected passage");
    menu.hidden = true;

    const suggestButton = document.createElement("button");
    suggestButton.type = "button";
    suggestButton.className = "github-highlight-action";
    suggestButton.textContent = "Suggest edit";
    suggestButton.setAttribute(
      "aria-label",
      "Suggest an edit to the selected passage on GitHub"
    );

    const discussButton = document.createElement("button");
    discussButton.type = "button";
    discussButton.className = "github-highlight-action";
    discussButton.textContent = "Discuss passage";
    discussButton.setAttribute(
      "aria-label",
      "Discuss the selected passage on GitHub"
    );

    menu.append(suggestButton, discussButton);

    const toast = document.createElement("div");
    toast.className = "github-highlight-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.setAttribute("aria-atomic", "true");

    document.body.append(menu, toast);
    state.menu = menu;
    state.toast = toast;
    state.buttons = { suggestButton, discussButton };

    menu.addEventListener("pointerdown", () => {
      state.menuInteraction = true;
    });
    menu.addEventListener("mousedown", (event) => {
      event.preventDefault();
      restoreStoredRange();
    });
    menu.addEventListener("pointerup", () => {
      window.setTimeout(() => {
        state.menuInteraction = false;
      }, 0);
    });
    suggestButton.addEventListener("click", suggestEdit);
    discussButton.addEventListener("click", discussPassage);
  };

  const onDocumentKeyDown = (event) => {
    if (event.key === "Escape" && !state.menu.hidden) {
      event.preventDefault();
      hideMenu({ returnFocus: true });
      return;
    }

    if (
      event.key === "Tab" &&
      !state.menu.hidden &&
      !state.menu.contains(document.activeElement)
    ) {
      event.preventDefault();
      state.menuInteraction = true;
      const target = event.shiftKey
        ? state.buttons.discussButton
        : state.buttons.suggestButton;
      target.focus({ preventScroll: true });
      window.setTimeout(() => {
        state.menuInteraction = false;
      }, 0);
    }
  };

  const onScroll = () => {
    if (!state.storedSelection || !state.scrollOrigin) {
      return;
    }
    const distance = Math.hypot(
      window.scrollX - state.scrollOrigin.x,
      window.scrollY - state.scrollOrigin.y
    );
    if (distance > 48) {
      hideMenu();
      return;
    }

    window.cancelAnimationFrame(state.repositionFrame);
    state.repositionFrame = window.requestAnimationFrame(positionMenu);
  };

  const bindEvents = () => {
    document.addEventListener("selectionchange", () =>
      scheduleSelectionCheck(280)
    );
    document.addEventListener("pointerup", (event) => {
      if (!state.menu.contains(event.target)) {
        scheduleSelectionCheck(event.pointerType === "touch" ? 360 : 40);
      }
    });
    document.addEventListener("touchend", (event) => {
      if (!state.menu.contains(event.target)) {
        scheduleSelectionCheck(420);
      }
    });
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (!state.menu.hidden && !state.menu.contains(event.target)) {
          hideMenu();
        }
      },
      true
    );
    document.addEventListener("keydown", onDocumentKeyDown);
    document.addEventListener("keyup", (event) => {
      if (
        event.shiftKey ||
        event.key.startsWith("Arrow") ||
        event.key === "Shift"
      ) {
        scheduleSelectionCheck(40);
      }
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", positionMenu, { passive: true });
    window.visualViewport?.addEventListener("resize", positionMenu, {
      passive: true,
    });
    window.visualViewport?.addEventListener("scroll", onScroll, {
      passive: true,
    });
    ["pagehide", "beforeunload", "popstate", "hashchange"].forEach((name) => {
      window.addEventListener(name, hideMenu);
    });
  };

  const init = () => {
    state.content = document.querySelector(CONFIG.allowedContentSelector);
    if (!state.content) {
      return;
    }
    if (!state.content.hasAttribute("tabindex")) {
      state.content.setAttribute("tabindex", "-1");
    }
    createInterface();
    bindEvents();
    loadSourceMap();
  };

  const api = {
    refresh() {
      hideMenu();
      const nextContent = document.querySelector(CONFIG.allowedContentSelector);
      if (nextContent) {
        state.content = nextContent;
      }
    },
    config: CONFIG,
  };
  window[INSTANCE_KEY] = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
