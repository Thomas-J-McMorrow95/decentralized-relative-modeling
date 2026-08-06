#!/usr/bin/env python3
"""
publish.py — the only command you need.

    python3 tools/publish.py

First time you run it, it names the site, creates a GitHub repository, turns
on GitHub Pages and pushes. Every time after that, it notices any PDF you've
dropped into docs/, asks you a few questions about it, and publishes.

Useful flags:

    --preview     open the site locally in your browser; publish nothing
    --no-push     do everything except send it to GitHub
    --message "…" set the commit message yourself
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import webbrowser
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
MANIFEST = DOCS / "manifest.js"
SITE_JS = ROOT / "assets" / "js" / "site.js"

# --------------------------------------------------------------------------
# small terminal helpers
# --------------------------------------------------------------------------

_TTY = sys.stdout.isatty()


def c(text, code):
    return f"\033[{code}m{text}\033[0m" if _TTY else text


def bold(t):  return c(t, "1")
def dim(t):   return c(t, "2")
def green(t): return c(t, "32")
def blue(t):  return c(t, "36")
def red(t):   return c(t, "31")


def say(msg=""):
    print(msg)


def die(msg, hint=None):
    print(f"\n{red('Stopped:')} {msg}", file=sys.stderr)
    if hint:
        print(f"\n{hint}", file=sys.stderr)
    sys.exit(1)


def ask(label, default="", width=9):
    """Prompt with an Enter-to-accept default."""
    shown = f"  {label.ljust(width)} "
    shown += f"{dim('[' + default + ']')} " if default else dim("(optional) ")
    try:
        got = input(shown).strip()
    except EOFError:
        # Reached the end of piped input, or running with no terminal at all.
        say()
        die("This script needs to ask you some questions, but there's no "
            "keyboard input available.",
            "Run it directly in a terminal:  python3 tools/publish.py")
    return got or default


def confirm(question, default=True):
    suffix = "[Y/n]" if default else "[y/N]"
    try:
        got = input(f"{question} {dim(suffix)} ").strip().lower()
    except EOFError:
        return default
    if not got:
        return default
    return got.startswith("y")


def run(cmd, capture=False, check=True, cwd=None):
    """Run a command. Returns stdout when capture=True, else the exit code."""
    try:
        p = subprocess.run(
            cmd, cwd=str(cwd or ROOT), check=False, text=True,
            stdout=subprocess.PIPE if capture else None,
            stderr=subprocess.PIPE if capture else None,
        )
    except FileNotFoundError:
        die(f"'{cmd[0]}' isn't installed.")
    if check and p.returncode != 0:
        detail = (p.stderr or p.stdout or "").strip() if capture else ""
        die(f"`{' '.join(cmd)}` failed." + (f"\n\n{detail}" if detail else ""))
    return (p.stdout or "").strip() if capture else p.returncode


def have(binary):
    return shutil.which(binary) is not None


# --------------------------------------------------------------------------
# manifest read / write
# --------------------------------------------------------------------------

MARKER = "window.DOCUMENTS"


def read_manifest():
    """The list is plain JSON. Anchor on the assignment rather than on the
    first '[' in the file — the explanatory comment above it mentions
    brackets, and searching blindly would parse the comment."""
    if not MANIFEST.exists():
        return [], f"{MARKER} ="
    text = MANIFEST.read_text(encoding="utf-8")

    at = text.find(MARKER)
    if at == -1:
        die(f"{MANIFEST.name} doesn't look right — no '{MARKER}' in it.",
            "Restore it from GitHub, or ask for a fresh copy.")
    try:
        start = text.index("[", at)
        end = text.rindex("]")
    except ValueError:
        die(f"{MANIFEST.name} doesn't look right — the [ … ] list is incomplete.",
            "If you edited it by hand, check for a missing bracket.")

    try:
        entries = json.loads(text[start:end + 1])
    except json.JSONDecodeError as e:
        # Report the line number in the file, not in the slice.
        line = text[:start].count("\n") + e.lineno
        die(f"{MANIFEST.name} has a formatting error on line {line}: {e.msg}",
            "Usually a missing comma or a missing quote. Fix that line and "
            "run this again.")
    return entries, text[:start].rstrip()


def write_manifest(entries, header):
    body = json.dumps(entries, indent=2, ensure_ascii=False)
    body = re.sub(r'\[\s+((?:"[^"]*",?\s*)+)\]',
                  lambda m: "[" + " ".join(m.group(1).split()) + "]", body)
    MANIFEST.write_text(f"{header}\n{body};\n", encoding="utf-8")


def title_from_filename(stem):
    words = re.split(r"[-_\s]+", stem.strip())
    small = {"a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or",
             "the", "to", "vs", "with"}
    out = []
    for i, w in enumerate(words):
        if not w:
            continue
        if w.isupper() or (len(w) > 1 and w[1:].lower() != w[1:]):
            out.append(w)                       # keep ALLCAPS / CamelCase as typed
        elif i and w.lower() in small:
            out.append(w.lower())
        else:
            out.append(w[:1].upper() + w[1:])
    return " ".join(out)


def split_list(raw):
    return [p.strip() for p in re.split(r"[,;]", raw) if p.strip()]


# --------------------------------------------------------------------------
# collecting new documents
# --------------------------------------------------------------------------

def sync_documents(entries, assume_yes=False):
    """Prompt for any PDF in docs/ that isn't in the manifest; offer to drop
    entries whose file has disappeared. Returns (entries, changed)."""
    # Reserved slots hold a space in the grid and have no file behind them,
    # so they're excluded from both checks below.
    real = [e for e in entries if not e.get("placeholder")]
    listed = {e.get("file") for e in real}
    on_disk = sorted(p for p in DOCS.glob("*.pdf") if p.is_file())
    on_disk_rel = {f"docs/{p.name}" for p in on_disk}
    new = [p for p in on_disk if f"docs/{p.name}" not in listed]
    missing = [e for e in real if e.get("file") not in on_disk_rel]

    changed = False

    if missing:
        say()
        say(f"{bold('These are listed but the file is gone:')}")
        for e in missing:
            say(f"  - {e.get('title') or e.get('file')}  {dim(e.get('file',''))}")
        if assume_yes or confirm("Remove them from the site?"):
            gone = {e.get("file") for e in missing}
            entries = [e for e in entries if e.get("file") not in gone]
            changed = True

    if new:
        # Sensible defaults carried over from the most recent entry.
        prev_authors = next((e.get("authors") for e in entries if e.get("authors")), [])
        known_tags = sorted({t for e in entries for t in e.get("tags", [])})

        say()
        say(f"{bold(f'Found {len(new)} new PDF' + ('s' if len(new) > 1 else '') + ' in docs/')}"
            f"  {dim('press Enter to accept anything in brackets')}")
        if known_tags:
            say(dim(f"  tags already in use: {', '.join('#' + t for t in known_tags)}"))

        for p in new:
            say()
            say(f"{blue(p.name)}")
            entry = {"file": f"docs/{p.name}"}
            entry["title"] = ask("Title", title_from_filename(p.stem))
            entry["date"] = ask("Date", date.today().strftime("%Y-%m"))
            authors = ask("Authors", ", ".join(prev_authors))
            entry["authors"] = split_list(authors)
            entry["venue"] = ask("Venue")
            entry["tags"] = split_list(ask("Tags"))
            if entry["authors"]:
                prev_authors = entry["authors"]
            entries.append(entry)
            changed = True

            # A real document takes over a reserved slot, so the row of three
            # stays a row of three instead of growing to four.
            for i, e in enumerate(entries):
                if e.get("placeholder"):
                    entries.pop(i)
                    break

    if not new and not missing:
        say(f"{dim('docs/ and the manifest already agree.')}")

    return entries, changed


# --------------------------------------------------------------------------
# first-run setup
# --------------------------------------------------------------------------

def set_site_name(name):
    """Rewrite the wordmark in site.js. Splits on the last space so
    'Casual Rosetta' renders as 'Casual | Rosetta'."""
    text = SITE_JS.read_text(encoding="utf-8")
    left, _, right = name.rpartition(" ")
    if not left:
        left, right = name, ""
    new = f'brand: {{ left: {json.dumps(left)}, right: {json.dumps(right)} }},'
    patched, n = re.subn(r"brand:\s*\{[^}]*\},", new, text, count=1)
    if n:
        SITE_JS.write_text(patched, encoding="utf-8")


def ensure_git_identity():
    """git refuses to commit without a name and email. On a machine that has
    never used git this is the first thing that goes wrong, so ask rather
    than let the commit fail somewhere further down."""
    def cfg(key):
        p = subprocess.run(["git", "config", "--get", key],
                           cwd=str(ROOT), capture_output=True, text=True)
        return p.stdout.strip()

    if cfg("user.name") and cfg("user.email"):
        return

    say()
    say(f"{bold('git needs to know who you are')} {dim('(one time, on this machine)')}")
    name = ""
    while not name:
        name = ask("Your name", width=11)
    email = ""
    while not email or "@" not in email:
        email = ask("Your email", width=11)
    run(["git", "config", "--global", "user.name", name])
    run(["git", "config", "--global", "user.email", email])


def gh_ready():
    if not have("gh"):
        return False
    p = subprocess.run(["gh", "auth", "status"], capture_output=True, text=True)
    return p.returncode == 0


def git_initialised():
    return (ROOT / ".git").is_dir()


def current_remote():
    p = subprocess.run(["git", "remote", "get-url", "origin"],
                       cwd=str(ROOT), capture_output=True, text=True)
    return p.stdout.strip() if p.returncode == 0 else ""


def pages_url(remote):
    """Turn a GitHub remote into the https://user.github.io/repo/ address."""
    m = re.search(r"github\.com[:/]+([^/]+)/([^/.]+)", remote or "")
    if not m:
        return ""
    return f"https://{m.group(1).lower()}.github.io/{m.group(2)}/"


def first_run():
    say()
    say(bold("First run — let's get this online."))
    say()

    name = ask("Site name", "Casual Rosetta", width=11)
    set_site_name(name)

    default_repo = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "site"
    repo = ask("Repo name", default_repo, width=11)

    if not have("git"):
        die("git isn't installed.",
            "Install it from https://git-scm.com/downloads, then run this again.")

    ensure_git_identity()

    if not git_initialised():
        run(["git", "init", "-q"])
    (ROOT / ".nojekyll").write_text("", encoding="utf-8")   # tells Pages to serve files as-is
    run(["git", "add", "-A"])
    subprocess.run(["git", "commit", "-q", "-m", "Initial site"],
                   cwd=str(ROOT), capture_output=True, text=True)
    # Normalise the branch name; GitHub Pages defaults to main.
    run(["git", "branch", "-M", "main"], check=False, capture=True)

    if gh_ready():
        say()
        say(f"{dim('Creating the repository…')}")
        run(["gh", "repo", "create", repo, "--public", "--source=.",
             "--remote=origin", "--push"], capture=True)
        remote = current_remote()
        say(f"{dim('Turning on GitHub Pages…')}")
        p = subprocess.run(
            ["gh", "api", "-X", "POST", f"repos/{{owner}}/{repo}/pages",
             "-f", "source[branch]=main", "-f", "source[path]=/"],
            cwd=str(ROOT), capture_output=True, text=True)
        if p.returncode != 0 and "already exists" not in (p.stderr or ""):
            say()
            say(f"{bold('One manual step:')} open the repository's Settings → Pages,")
            say("set Source to 'Deploy from a branch', branch 'main', folder '/ (root)', Save.")
        return remote

    # No gh CLI — walk them through the browser instead.
    say()
    say(bold("Two things to do in your browser, then come back here:"))
    say()
    say("  1. Go to  https://github.com/new")
    say(f"     Name it {bold(repo)}, make it Public, and DON'T tick any of the")
    say("     'Add a README / .gitignore / license' boxes. Click Create.")
    say("  2. Copy the URL from your browser's address bar.")
    say()
    if confirm("Open github.com/new for you?", default=True):
        try:
            webbrowser.open("https://github.com/new")
        except Exception:
            pass
    say()
    url = ""
    while not re.search(r"github\.com[:/]+[^/]+/[^/]+", url):
        url = ask("Paste the repo URL", width=17)
        if not url:
            die("Nothing pasted — run this again when the repo exists.")
    url = url.rstrip("/")
    if not url.endswith(".git"):
        url += ".git"

    run(["git", "remote", "remove", "origin"], check=False, capture=True)
    run(["git", "remote", "add", "origin", url])
    say()
    say(f"{dim('Pushing…')}")
    run(["git", "push", "-u", "origin", "main"])

    say()
    say(bold("Last manual step, once:"))
    say(f"  Open {url[:-4]}/settings/pages")
    say("  Set Source to 'Deploy from a branch', branch 'main', folder '/ (root)', Save.")
    say()
    if confirm("Open that settings page for you?", default=True):
        try:
            webbrowser.open(f"{url[:-4]}/settings/pages")
        except Exception:
            pass
    return url


# --------------------------------------------------------------------------

def preview():
    import http.server
    import socketserver
    import threading

    os.chdir(ROOT)
    port = 8765
    for attempt in range(10):
        try:
            httpd = socketserver.TCPServer(("", port + attempt),
                                           http.server.SimpleHTTPRequestHandler)
            port += attempt
            break
        except OSError:
            continue
    else:
        die("Couldn't find a free port to preview on.")

    url = f"http://localhost:{port}/index.html"
    say()
    say(f"Previewing at {bold(url)}")
    say(dim("Press Ctrl-C when you're done."))
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        say("\nStopped.")


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--preview", action="store_true",
                    help="open the site locally; publish nothing")
    ap.add_argument("--no-push", action="store_true",
                    help="update and commit, but don't send it to GitHub")
    ap.add_argument("--message", "-m", default="", help="commit message")
    ap.add_argument("--yes", "-y", action="store_true",
                    help="don't ask before removing entries with no file")
    args = ap.parse_args()

    if args.preview:
        return preview()

    setup_ran = False
    if not git_initialised() or not current_remote():
        first_run()
        setup_ran = True

    entries, header = read_manifest()
    entries, changed = sync_documents(entries, assume_yes=args.yes)
    if changed:
        write_manifest(entries, header)

    say()
    if args.no_push:
        run(["git", "add", "-A"])
        subprocess.run(["git", "commit", "-q", "-m", args.message or "Update documents"],
                       cwd=str(ROOT), capture_output=True, text=True)
        say(f"{green('Saved locally.')} Run without --no-push to put it online.")
        return

    if not have("git"):
        die("git isn't installed.")

    run(["git", "add", "-A"])
    committed = subprocess.run(
        ["git", "commit", "-q", "-m", args.message or "Update documents"],
        cwd=str(ROOT), capture_output=True, text=True).returncode == 0

    ahead = subprocess.run(["git", "log", "--oneline", "origin/main..HEAD"],
                           cwd=str(ROOT), capture_output=True, text=True).stdout.strip()

    if not committed and not ahead:
        say(f"{dim('Nothing has changed — already up to date.')}")
    else:
        say(f"{dim('Publishing…')}")
        run(["git", "push", "-q", "origin", "main"])
        say(f"{green('Published.')}")

    url = pages_url(current_remote())
    if url:
        say()
        say(f"  {bold(url)}")
        say(dim("  Changes usually appear within a minute."
                + ("  First deploy can take a few." if setup_ran else "")))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        say("\nCancelled — nothing was published.")
        sys.exit(130)
