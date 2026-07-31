# mmccoy-01.github.io

## Dynamic color theme

The site and rendered book automatically use the visitor's operating-system
light/dark preference on their first visit. A moon/sun button appears beside
the search control in both the Jekyll header and Quarto chapter toolbar. The
button is keyboard accessible, has a visible focus state, and provides a
44&nbsp;px touch target on mobile and desktop.

After a reader uses the button, the selected mode is stored in
`localStorage` under `katalepsara-color-theme` and follows them between posts
and book chapters. The controller also synchronizes changes between open tabs.
Post comments receive the matching high-contrast Giscus theme.
To return to automatic system behavior, remove that storage entry in browser
site settings or run this in the browser console:

```js
window.SiteTheme.useSystemPreference();
```

The shared files are `assets/js/site-theme.js` and
`assets/css/site-theme.css`. Jekyll loads them globally from
`_includes/head.html`; the book integration script adds root-relative loaders
to every rendered chapter. No theme service, account, cookie, token, or backend
is used.

After replacing `book/` with a newly rendered Quarto `_book/`, run the existing
integration command so both the color theme and highlighting feature are
restored:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/integrate-book-highlight.ps1
```

Static and browser checks for the theme are available at
`tests/site-theme-static.test.mjs`, `tests/site-theme.browser.html`, and
`tests/site-theme-jekyll.browser.html`.

## Highlight-triggered GitHub collaboration

Jekyll posts and the rendered Quarto book in `book/` show a compact
collaboration menu only after a reader selects meaningful article text. The
single shared implementation supports `article.post-content` for posts and
`main.content#quarto-document-content` for book chapters. It offers:

- **Suggest edit**, which opens a GitHub issue with the rendered page, mapped
  `.qmd` source path, exact passage, nearby paragraph context, and a place for
  replacement text.
- **Discuss passage**, which copies a Markdown discussion template and opens
  the repository's New Discussion page in the configured category.

No token, API credential, backend, database, framework, or runtime dependency is
used.

### Configuration

Configuration constants are at the top of
`assets/js/github-highlight.js`:

| Setting | Current value | Notes |
|---|---|---|
| Repository | `mmccoy-01/mmccoy-01.github.io` | Taken from this repository's Git remote. |
| Public site URL | `https://katalepsara.com/` | Fallback for Jekyll posts; rendered posts also receive their canonical URL as metadata. |
| Public book URL | `https://katalepsara.com/book/` | Taken from the repository homepage/CNAME and the deployed `/book/` path. |
| Discussion category | `general` | Discussions are enabled and this category currently exists. |
| Minimum selection | 8 characters | Short or non-word selections do not show the menu. |
| Maximum selection | 1,200 characters | Bounds GitHub issue URL size and clipboard content; longer selections show guidance instead of a menu. |
| Content selectors | Quarto `main.content#quarto-document-content`; Jekyll `article.post-content[role='article']` | Prevents selections elsewhere on the site from triggering the menu. |
| Issue template | `suggested-edit.yml` | Receives the dynamic source, page, passage, and context fields. |
| Issue label | `suggested-edit` | Applied automatically by the repository issue form. |

Confirm the public book URL if the canonical deployment changes.

### Jekyll loader and source mapping

`_includes/head.html` conditionally loads
`assets/css/github-highlight.css` and `assets/js/github-highlight.js` for every
page whose layout is `post`. It also emits the post's Markdown source path from
Jekyll's `page.path` and its canonical public URL. Adding another
`_posts/*.md` file therefore requires no feature-specific HTML or front matter.

Post titles, publication details, cover images, pagination, controls, forms,
code, and surrounding site navigation are excluded from selection handling.

### Quarto loader and source mapping

The repository contains rendered HTML but does not contain the book's Quarto
source project, `_quarto.yml`, or `.qmd` files. The integration script therefore
maps each rendered pathname to the conventional same-path `.qmd` source (for
example, `chapters/04-introduction.html` to
`chapters/04-introduction.qmd`) without using displayed chapter titles.

`scripts/integrate-book-highlight.ps1` injects the source path as per-page
metadata and regenerates `book/page-source-map.json` as a fallback. If any
rendered pathname differs from its source pathname, add that exception to the
script's `$sourceOverrides` table.

After each future Quarto render:

1. Copy the rendered `_book/` directory to this repository as `book/`.
2. From this repository root, run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/integrate-book-highlight.ps1
   ```

The script injects references to the same canonical `/assets/` JS and CSS used
by Jekyll, so no implementation is copied into individual book pages. Each
rendered HTML page only receives a loader reference and its source-path
metadata.

For a source project under active maintenance, the preferred long-term setup is
to load the script during rendering (for example with a Quarto
`include-after-body`) and emit
`<meta name="github-highlight-source" content="path/to/chapter.qmd">` from a
render filter. The JavaScript already gives that metadata precedence over the
JSON fallback, so dependable source-offset metadata can later replace the issue
workflow without redesigning the menu.

### GitHub behavior and limitations

[GitHub officially supports URL parameters for opening issues and prefilling
issue-form fields](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue#creating-an-issue-from-a-url-query).
The `labels` URL parameter requires the reader to have label permission, so this
implementation does not use it. Instead,
`.github/ISSUE_TEMPLATE/suggested-edit.yml` applies the existing
`suggested-edit` label automatically and defines the structured source, page,
passage, context, replacement, and explanation fields.

GitHub documents defaults supplied by repository-owned
[Discussion category forms](https://docs.github.com/en/discussions/managing-discussions-for-your-community/syntax-for-discussion-category-forms),
but does not document reliable visitor-supplied URL parameters for prefilling a
new Discussion's title and body. The feature therefore does not send invented
parameters. It copies a Markdown template containing the title, public URL, and
selected blockquote, opens
`/discussions/new?category=general`, and briefly confirms that the reader can
paste the context into GitHub. It uses `navigator.clipboard.writeText()` on a
secure origin and falls back to the legacy browser copy command.

Readers who are logged out will be asked to sign in by GitHub. The page cannot
create an issue, Discussion, commit, or pull request on the reader's behalf. In
particular, rendered text does not provide dependable `.qmd` offsets, so an
accepted suggestion must be applied by a maintainer as a source commit or pull
request.

### Reader interaction

On desktop, select text with the mouse or keyboard. On mobile, long-press and
adjust the browser's native selection handles; the menu appears after the
selection settles. The selected range and its text are stored before a menu
button is activated, so tapping does not discard the passage context.

The fixed menu clamps itself to the visual viewport. It is not shown for
navigation, headers, footers, controls, forms, or code, and it closes on an
outside press, Escape, a collapsed selection, substantial scrolling, or page
navigation. Press Tab while the menu is visible to move keyboard focus into its
actions. Controls use real buttons, visible focus rings, screen-reader labels,
and 44 px minimum touch targets. On touch devices, actions activate directly on
the first touch release and suppress the browser's delayed synthetic click. The
Discussion action visibly notes that it copies context for the reader to paste.

### Local testing

In the separate Quarto source project, run:

```powershell
quarto render
quarto preview
```

Then test selections near every viewport edge, across multiple lines and
paragraphs, in excluded content, and with keyboard selection plus Escape. Use
responsive device emulation as an initial check, then verify native long-press
selection on iOS Safari and Android Chrome. Also test while logged out of
GitHub, and deny clipboard permission once to exercise the fallback.

To preview Jekyll posts from this repository on a system with Ruby and the
bundle installed:

```powershell
bundle exec jekyll serve
```

The shared implementation and output-only Quarto integration can be checked
without rebuilding either source system:

```powershell
node --check assets/js/github-highlight.js
node tests/github-highlight-static.test.mjs
node --check assets/js/site-theme.js
node tests/site-theme-static.test.mjs
```

For an automated browser smoke test, run Chrome or Edge headlessly against
`tests/github-highlight.browser.html` and
`tests/github-highlight-jekyll.browser.html`; confirm that each
`#test-results` element has `data-status="passed"`.

### Deployment

Render in the source project, copy the contents of its `_book/` directory into
this website repository's `book/` directory, and run the integration script
above. Commit the updated `book/` output, shared `assets/`, source map, loader,
and documentation, then push `main`. GitHub Pages serves the checked-in book at
`/book/` and Jekyll automatically applies the shared loader to every post. No
server configuration or secret is required.

## `/now` page

The site-wide navigation links to a modular page at `/now/`. Its writing,
featured song, personalized Apple Music links, screen notes, “Presently”
entries all live in `_data/now.json`. Edit that file for a routine update; the
layout and responsive presentation do not need to change.

The page uses `_layouts/now.html`, `pages/now.html`, `assets/css/now.css`, and
`assets/js/now.js`. It follows the site's light/dark preference and uses the
existing header, search, menu, and footer. The Now-specific styles are loaded
only for this page.

### Apple Music behavior

The five playlist controls use the supplied personalized Apple Music URLs.
Selecting one lazy-loads Apple's official embedded web player into a single
shared panel, so the page never loads five players at once. No playlist opens
by default. Selecting a Roman-numeral tab opens that playlist; selecting the
same tab again collapses it, and another selection reopens or switches it. The
featured song has its own compact, lazy-loaded Apple player. The players
themselves provide Apple Music navigation, so the page does not add duplicate
outbound links.

Apple controls the embedded track list, regional availability, sign-in, and
playback. Apple states that visitors who are not signed in may hear 30-second
previews, while subscribers may sign in for full playback. Personalized
playlist embeds can still vary by storefront or Apple account. Playback and
outbound navigation remain Apple-managed. The page never autoplays audio and
requires no MusicKit token or secret.

Apple does not document a light/dark theme parameter for its cross-origin
embedded player, so the site does not invent one. The page passes the active
site theme as a standards-based `color-scheme` hint and themes the surrounding
panel, but Apple ultimately controls the contents of its iframe. The hint is
updated when the site theme toggle changes.

### Featured-song and historical context

The committed JSON is the page's durable source of truth. An optional,
dependency-free build-time helper looks up the Apple track by its numeric ID
and refreshes both its displayed and machine-readable catalog release dates:

```powershell
# Preview a proposed update without changing files
node scripts/update-now.mjs

# Apply the verified Apple metadata
node scripts/update-now.mjs --write
```

For a future song, replace `music.apple_url` in `_data/now.json` and run the
helper. It reads either a direct `/song/{id}` URL or the `?i={track-id}` form
used by Apple album links, then updates the stored ID, title, artist, album,
embed URL, and catalog dates together.

The “In the world then” card reads `release_date_iso` and calls Wikimedia's
official key-free “On this day” REST feed in the browser. It first looks for an
event from the release year on the exact release day, then searches outward up
to seven days. Multiple events are ranked deterministically using broad
historical signals; the result and its Wikipedia source are cached for 30 days.
If Wikimedia is unavailable, the card shows a generic release-date message
rather than a manually maintained historical claim. The date is the Apple
catalog release date, not a claim about a separate single release.

Run the page's dependency-free checks with:

```powershell
node --check assets/js/now.js
node --check scripts/update-now.mjs
node tests/now-page-static.test.mjs
```

For a browser smoke test, open `tests/now-page.browser.html` or load it in
Chrome/Edge headlessly and confirm `#test-results` has
`data-status="passed"`. The fixture mocks Wikimedia and uses inert player URLs,
so it is deterministic and makes no external requests.
