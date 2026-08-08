# Decentralized Relative Modeling

Three pages — Documentation, Casual Rosetta, Continuous Tournament — behind a
single navigation bar. Documentation shows your PDFs as cards, three across.

You only ever need one command. **You do not need to open any of the code.**

---

## Before you start

You need `git` and `python3`. Check by running:

```bash
git --version
python3 --version
```

If either is missing: git from [git-scm.com](https://git-scm.com/downloads),
Python from [python.org](https://www.python.org/downloads/).

Optional but makes setup completely hands-off: the GitHub CLI,
[cli.github.com](https://cli.github.com/). If it's installed and you've run
`gh auth login` once, the script creates the repository and switches on
hosting by itself. Without it you'll do two clicks in a browser instead.

---

## Putting it online (once)

Open a terminal, go to this folder, and run:

```bash
cd path/to/site
python3 tools/publish.py
```

It asks for a site name, sets up the repository, and gives you a public
address that looks like:

```
https://yourusername.github.io/decentralized-relative-modeling/
```

The very first deploy takes a few minutes. After that, updates appear within
about a minute.

---

## Adding a document

1. Put the PDF in the `docs/` folder.
2. Run `python3 tools/publish.py`

It notices the new file and asks you about it. Press Enter to accept anything
shown in brackets:

```
rosetta-protocol-notes.pdf
  Title     [Rosetta Protocol Notes]
  Date      [2026-08]
  Authors   [Thomas J McMorrow]
  Venue     (optional)
  Tags      (optional)
```

- **Date** sorts the page, newest first.
- **Venue** is the bold line — journal, conference, version, whatever you like.
- **Tags** are comma-separated. Two or more tags across your documents and a
  filter row appears at the top of the page automatically.

Then it publishes. That's the whole loop.

**Deleting** a document is the same: remove the PDF from `docs/`, run the
command, say yes when it offers to drop the entry.

Other flags:

```bash
python3 tools/publish.py --preview     # look at it locally, publish nothing
python3 tools/publish.py --no-push     # save changes, don't put them online yet
```

---

## Changing the name in the top-left

The first run asks you for it. To change it later, or to rename a tab, open
`assets/js/site.js` — the first ten lines are just the name and the three tab
labels, and they're the only part you'd touch:

```js
const SITE = {
  brand: { left: "Decentralized Relative Modeling", right: "" },
  pages: [
    { id: "documentation",         label: "Documentation",         href: "index.html" },
    { id: "casual-rosetta",        label: "Casual Rosetta",        href: "casual-rosetta.html" },
    { id: "continuous-tournament", label: "Continuous Tournament", href: "continuous-tournament.html" }
  ]
};
```

Change a `label` and it updates on all three pages. (If you rename a tab, the
`id` and the `href` should stay as they are — those are wiring, not text.)

---

## If something goes wrong

| What you see | What to do |
|---|---|
| `git isn't installed` | Install git, reopen the terminal, run it again. |
| It asks for your name and email | One-time git setup. Type them and it continues. |
| Asks for a GitHub username/password on push | GitHub wants a token, not a password. Easiest fix is installing the GitHub CLI and running `gh auth login`. |
| Page is live but blank | Give it another minute, then hard-refresh (Cmd/Ctrl + Shift + R). |
| `manifest.js has a formatting error on line N` | Only happens if it was hand-edited. Open `docs/manifest.js`, fix that line (usually a missing comma or quote), run again. |

Nothing the script does is destructive — every version is kept in git, so a
bad change can always be undone.

---

## Later, when you want to change how it looks

Not needed now. For when you come back to it:

```
index.html                    Documentation page
casual-rosetta.html           background artwork only
continuous-tournament.html    background artwork only
assets/css/style.css          all styling — colours are the tokens at the top
assets/css/fonts.css          generated, don't edit
assets/js/site.js             site name, tabs, and the generated artwork
assets/js/documentation.js    the card grid and the PDF viewer
docs/manifest.js              your document list (the script writes this)
tools/publish.py              the command above
CLAUDE.md                     notes for Claude, not for you
```

A few decisions in here that will look odd until you know why:

- **`manifest.js`, not `manifest.json`.** Chrome refuses to `fetch()` local
  JSON over `file://`, so a JSON file would leave the page blank when you
  double-click `index.html`. A `<script>` tag has no such restriction. The
  contents are still ordinary JSON, which is how `publish.py` reads them.
- **The font is embedded** as base64 in `fonts.css`, for the same reason —
  Chrome blocks web-font requests over `file://`, so a linked font silently
  falls back to Arial.
- **Card thumbnails are generated, not image files** — inline SVG seeded from
  each filename, so a given PDF always draws the same picture.
- **The PDF viewer uses the browser's own renderer.** Phones get an "Open
  document" hand-off instead, because iOS Safari renders only the first page
  in a frame and Android Chrome usually refuses outright.
- **Documents are deep-linkable**: opening one sets
  `#doc=docs/your-file.pdf` in the address bar, so you can share a link
  straight to it.
- **Stylesheet and script links carry a `?v=…`.** GitHub Pages tells browsers
  to hold on to those files for ten minutes, so a publish can look like
  nothing happened. `publish.py` writes a short hash of each file into its
  link, so the address changes exactly when the file does and the browser
  fetches it again. It maintains those itself; you never type them.
