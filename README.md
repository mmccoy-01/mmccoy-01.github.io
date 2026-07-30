# mmccoy-01.github.io

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
| Issue label | empty | The repository does not currently have a `suggested-edit` label. Create it first, then set `issueLabel: "suggested-edit"`. |

Confirm the public book URL if the canonical deployment changes. The only
currently missing optional value is the issue label: create `suggested-edit` in
GitHub before enabling it in the script.

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

[GitHub officially supports `title`, `body`, and `labels` query parameters for a
new issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue#creating-an-issue-from-a-url-query).
A label parameter also requires the reader to have permission to use that label;
this implementation sends no label until an existing label is explicitly
configured.

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
and 44 px minimum touch targets.

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
