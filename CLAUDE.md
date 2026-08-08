# Notes for Claude

Operational notes for a Claude session working on this repository through the
Cowork device bridge. Read this before editing files or running git.

## Publishing is the user's step

`python3 tools/publish.py`, run from a Windows terminal in this folder. It
syncs `docs/manifest.js` against the PDFs in `docs/`, stamps cache-busting
hashes into the page asset links, then does `git add -A`, commit, push.

Claude cannot run the push. The Linux VM that mounts this folder has no git
identity, no credential helper, and its outbound proxy answers CONNECT to
github.com with HTTP 403. Make the edits, then hand the command back.

Standing instruction from the user: hold for an explicit go before committing.

## Never run bare `git` here

Any git command that refreshes the index writes `.git/index.lock` and then
deletes it. The mount allows writes but refuses deletes, so the lock survives
and every subsequent git command on the user's machine fails with
`Unable to create index.lock: File exists`.

Use `git --no-optional-locks ...` for everything. It never takes the lock.

If a lock does get stranded, `rm` will not remove it. Move it aside with
`mv .git/index.lock .git/index.lock.dead` and tell the user to delete it.

Writing commands are worse. A `git add` / `commit` / `rm --cached` run from
here does work, but leaves `.git/HEAD.lock`, `.git/objects/maintenance.lock`
and a scatter of `.git/objects/**/tmp_obj_*` behind, and `HEAD.lock` blocks
the user's next commit outright. If you are given explicit permission to
commit, sweep afterwards:

    find .git -maxdepth 3 -name "*.lock" -print0 |
      while IFS= read -r -d '' f; do mv "$f" "$f.dead-claude"; done

The `tmp_obj_*` files cannot be removed from here. They are inert; `git gc`
on the user's machine clears them.

Pushing is not possible at all: the VM's outbound proxy answers CONNECT to
github.com with HTTP 403. Commit if asked, then hand `git push origin main`
back to the user.

## `git status` misreports modifications

Every tracked file shows as modified. `git diff -w` comes back empty, so the
difference is CRLF versus LF and not content: Windows git normalises on
commit, the Linux side does not. Do not "fix" it by rewriting files.

Consequence for editing: read and write as bytes and preserve CRLF. A
whole-file rewrite with LF endings looks like a real change and buries the
actual edit in thousands of phantom lines.

`stamp_assets()` in publish.py handles this correctly: it reads bytes and
writes back whatever endings the file already had. `write_manifest()` does
not. It uses `write_text`, which follows the host's convention, so running it
from the Linux side would silently convert `docs/manifest.js` to LF. It is
only reached when a PDF is added or removed, which the user does on Windows.

## GitHub Pages caching

Assets are served with `Cache-Control: max-age=600`. Before the cache stamps
existed, a publish looked like nothing had happened for up to ten minutes,
twice costing the user a confusing detour. `stamp_assets()` in publish.py now
writes `?v=<md5[:8]>` into the `href`/`src` of every stylesheet and script,
so a changed file gets a new address and an unchanged one still comes from
cache.

Still unstamped: the PDFs under `docs/`. They are referenced through the
`file` values in `manifest.js`, which double as the deep-link identity
(`#doc=docs/...pdf`) and as the key publish.py matches against files on disk,
so a version query cannot simply be appended there. Replacing a PDF in place
can serve a stale copy for ten minutes; a hard refresh clears it.

## Repository visibility

The account is on GitHub Free, where making the repository private
automatically unpublishes the Pages site. GitHub Pro allows a private repo
with a publicly reachable site; a site that is itself private needs
Enterprise Cloud. The user has asked about this. Do not change visibility
without confirming the plan first.

## The site

- `docs/manifest.js` is the document list. Cards render in array order: all
  the dates are equal, the sort is stable, so the array is the order.
  Placeholder entries always sort last.
- Card artwork follows the document, not the slot. The `dag` field travels
  with its entry when the order changes.
- publish.py rewrites the manifest only when a PDF has appeared or vanished.
  Hand edits to titles, venues, tags, order and `dag` survive a publish.
- "Casual Rosetta" is spelled deliberately, a nod to the *Casual Inference*
  podcast. It is not a typo for "Causal". Never correct it.
- `manifest.js` rather than `manifest.json`, and the font embedded as base64
  in `fonts.css`, both because Chrome blocks those requests over `file://`.
- `--shell` in `style.css` is 1920px with 48px padding and a 48px column gap,
  so the three cards span the page with the outer margin equal to the gaps.
  Card titles fit on one line at that width; the widest needs 357px.

## Known and unfixed

- `Causal Modeling Framework.tex` still has an empty
  `\begin{abstract}\end{abstract}` at lines 31-32. The article class prints
  the heading regardless, so page one of the published PDF shows a bare
  "Abstract" with nothing under it. The user removed the same block from the
  Prerequisite document but not from this one.
- Three byte-identical copies of each `.tex` are tracked (`X.tex`,
  `X - Copy.tex`, `X - Copy - Copy.tex`), along with their PDFs. Do not tidy
  these without asking.
- `.gitignore` covers `.aux`, `.log`, `.out` and `.gz`; LaTeX build artefacts
  in the working folder are correctly ignored.
