/* =========================================================================
   documentation.js — renders the PDF card grid and the inline viewer.
   Reads window.DOCUMENTS, which docs/manifest.js defines.
   ========================================================================= */

(function () {
  "use strict";

  const docs = Array.isArray(window.DOCUMENTS) ? window.DOCUMENTS.slice() : [];
  const grid     = document.querySelector("[data-grid]");
  const filters  = document.querySelector("[data-filters]");
  const viewer   = document.querySelector("[data-viewer]");
  if (!grid) return;

  let activeTag = null;
  let lastFocused = null;

  /* -------------------------------------------------------------------- */
  /* helpers                                                               */
  /* -------------------------------------------------------------------- */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* "2026-06" / "2026-06-14" / "June 2026" all render as "June 2026". */
  function prettyDate(value) {
    if (!value) return "";
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(value).trim());
    if (!m) return String(value);
    const months = ["January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];
    const month = months[parseInt(m[2], 10) - 1];
    return month ? month + " " + m[1] : String(value);
  }

  /* Newest first; entries with no date sink to the bottom but keep order. */
  function sortDocs(list) {
    return list
      .map(function (d, i) { return { d: d, i: i }; })
      .sort(function (a, b) {
        const da = String(a.d.date || "");
        const db = String(b.d.date || "");
        if (da && db && da !== db) return da < db ? 1 : -1;
        if (da && !db) return -1;
        if (!da && db) return 1;
        return a.i - b.i;
      })
      .map(function (x) { return x.d; });
  }

  /* -------------------------------------------------------------------- */
  /* rendering                                                             */
  /* -------------------------------------------------------------------- */

  function cardHTML(doc, index) {
    const authors = Array.isArray(doc.authors) ? doc.authors.join(", ") : (doc.authors || "");
    const date    = prettyDate(doc.date);
    const metaBits = [date, authors].filter(Boolean).join(" — ");

    const tags = (doc.tags || []).map(function (t) {
      return "<li>#" + esc(t) + "</li>";
    }).join("");

    return `
<button class="card" type="button" data-index="${index}">
  <span class="card__thumb">${thumbnailSVG(doc.file || doc.title || index)}</span>
  <span class="card__body">
    <span class="card__title">${esc(doc.title || doc.file || "Untitled")}</span>
    ${metaBits ? `<span class="card__meta">${esc(metaBits)}</span>` : ""}
    ${doc.venue ? `<span class="card__venue">${esc(doc.venue)}</span>` : ""}
    ${tags ? `<ul class="card__tags">${tags}</ul>` : ""}
  </span>
</button>`;
  }

  function render() {
    const list = sortDocs(
      activeTag ? docs.filter(function (d) { return (d.tags || []).indexOf(activeTag) !== -1; })
                : docs
    );

    if (!list.length) {
      grid.classList.remove("grid");
      grid.innerHTML = docs.length
        ? `<p class="empty">No documents tagged <strong>#${esc(activeTag)}</strong>.</p>`
        : `<p class="empty">No documents yet. Drop PDFs into <code>docs/</code> and add an
           entry for each one in <code>docs/manifest.js</code> — or run
           <code>python3 tools/rebuild_manifest.py</code> to stub them in automatically.</p>`;
      return;
    }

    grid.classList.add("grid");
    grid.innerHTML = list.map(function (doc) {
      return cardHTML(doc, docs.indexOf(doc));
    }).join("");
  }

  function renderFilters() {
    if (!filters) return;
    const all = [];
    docs.forEach(function (d) {
      (d.tags || []).forEach(function (t) { if (all.indexOf(t) === -1) all.push(t); });
    });
    if (all.length < 2) { filters.hidden = true; return; }
    all.sort();

    filters.hidden = false;
    filters.innerHTML =
      `<span class="filters__label">Filter</span>` +
      `<button class="chip" type="button" data-tag="" aria-pressed="true">All</button>` +
      all.map(function (t) {
        return `<button class="chip" type="button" data-tag="${esc(t)}" aria-pressed="false">#${esc(t)}</button>`;
      }).join("");
  }

  /* -------------------------------------------------------------------- */
  /* inline viewer                                                         */
  /* -------------------------------------------------------------------- */

  /* Phones and tablets mostly refuse to embed a PDF — iOS Safari renders only
     the first page and Android Chrome tends to offer a download instead. On
     those, skip the embed and show a clean hand-off panel rather than a
     broken-looking frame. Desktop gets the real inline embed; <object> falls
     back to its own child content if the browser has no PDF handler. */
  function prefersNativeHandoff() {
    return window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
  }

  function openViewer(doc, skipHash) {
    if (!viewer || !doc) return;
    lastFocused = document.activeElement;

    /* Percent-encode for use in href/data — real filenames have spaces in
       them. The raw path stays the identity used for the deep link. */
    const raw = doc.file;
    const url = encodeURI(raw);
    const name = esc(doc.title || raw);

    const handoff = `
    <div class="viewer__fallback">
      <p>Open <strong>${name}</strong> in your PDF reader.</p>
      <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Open document</a>
    </div>`;

    const body = prefersNativeHandoff()
      ? `<div class="viewer__frame">${handoff}</div>`
      : `<div class="viewer__frame">
           <object data="${esc(url)}#view=FitH" type="application/pdf">${handoff}</object>
         </div>`;

    viewer.innerHTML = `
<div class="viewer__bar">
  <h2 class="viewer__title">${name}</h2>
  <div class="viewer__actions">
    <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Open in new tab</a>
    <a class="btn" href="${esc(url)}" download>Download</a>
    <button class="btn btn--primary" type="button" data-close>Close</button>
  </div>
</div>${body}`;

    viewer.hidden = false;
    document.body.classList.add("viewer-open");

    /* Deep link, so an open document can be shared or reloaded. */
    if (!skipHash) {
      try { history.replaceState(null, "", "#doc=" + encodeURIComponent(raw)); } catch (e) {}
    }

    const close = viewer.querySelector("[data-close]");
    if (close) close.focus();
  }

  function closeViewer() {
    if (!viewer || viewer.hidden) return;
    viewer.hidden = true;
    viewer.innerHTML = "";                 /* stop the embedded PDF */
    document.body.classList.remove("viewer-open");
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  /* Open straight into a document when the page is loaded with #doc=… */
  function openFromHash() {
    const m = /#doc=([^&]+)/.exec(location.hash || "");
    if (!m) return;
    let want;
    try { want = decodeURIComponent(m[1]); } catch (e) { return; }
    const hit = docs.filter(function (d) { return d.file === want; })[0];
    if (hit) openViewer(hit, true);
  }

  /* -------------------------------------------------------------------- */
  /* events                                                                */
  /* -------------------------------------------------------------------- */

  grid.addEventListener("click", function (e) {
    const card = e.target.closest(".card");
    if (!card) return;
    openViewer(docs[parseInt(card.dataset.index, 10)]);
  });

  if (filters) {
    filters.addEventListener("click", function (e) {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      activeTag = chip.dataset.tag || null;
      filters.querySelectorAll(".chip").forEach(function (c) {
        c.setAttribute("aria-pressed", String((c.dataset.tag || null) === activeTag));
      });
      render();
    });
  }

  if (viewer) {
    viewer.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) closeViewer();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeViewer();
  });

  /* -------------------------------------------------------------------- */

  renderFilters();
  render();
  openFromHash();
})();
