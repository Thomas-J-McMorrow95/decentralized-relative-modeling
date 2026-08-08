/* =========================================================================
   site.js — shared shell: brand, navigation, page background.
   -------------------------------------------------------------------------
   EDIT HERE to rename the site or change the tabs. The nav is rendered from
   the SITE object below into every page, so there is only one copy to keep
   in sync. No build step, no server: this runs straight from file://.

   The artwork lives in art.js, which must load first.
   ========================================================================= */

const SITE = {
  /* Wordmark in the top-left. Set `right` to "" for a single-run brand. */
  brand: { left: "Decentralized Relative Modeling", right: "" },

  /* The tabs, left to right. `id` must match the `data-page` attribute on
     that page's <body>. Add or remove entries here and every page updates. */
  pages: [
    { id: "documentation",         label: "Documentation",         href: "index.html" },
    { id: "casual-rosetta",        label: "Casual Rosetta",        href: "casual-rosetta.html" },
    { id: "continuous-tournament", label: "Continuous Tournament", href: "continuous-tournament.html" }
  ]
};

/* ---------------------------------------------------------------------- */
/* Navigation                                                              */
/* ---------------------------------------------------------------------- */

/* A collider: two causes meeting one effect. Arrows point in. */
const BRAND_MARK = `
<svg class="brand__mark" viewBox="0 0 60 44" fill="none" aria-hidden="true">
  <path d="M13 14L25.5 29.5M47 14L34.5 29.5" stroke="#f0813a" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M22 25.5L26.5 31L32 28" stroke="#f0813a" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>
  <circle cx="9"  cy="9"  r="4.6" fill="#ffb066"/>
  <circle cx="51" cy="9"  r="4.6" fill="#ffb066"/>
  <circle cx="30" cy="35" r="4.6" fill="#ff5b2e"/>
  <circle cx="30" cy="35" r="9.4" fill="none" stroke="#ff5b2e" stroke-width="1" opacity=".38"/>
</svg>`;

function renderNav() {
  const host = document.querySelector("[data-nav]");
  if (!host) return;

  const active = document.body.dataset.page || "";
  const home = SITE.pages[0] ? SITE.pages[0].href : "index.html";

  const links = SITE.pages.map(function (p) {
    const current = p.id === active ? ' aria-current="page"' : "";
    return `<li><a class="nav__link" href="${p.href}"${current}>${p.label}</a></li>`;
  }).join("");

  const sep = SITE.brand.right ? `<span class="sep">|</span>${SITE.brand.right}` : "";

  host.innerHTML = `
    <div class="nav__inner">
      <a class="brand" href="${home}" aria-label="${SITE.brand.left} ${SITE.brand.right} — home">
        ${BRAND_MARK}
        <span class="brand__text">${SITE.brand.left}${sep}</span>
      </a>
      <button class="nav__toggle" type="button"
              aria-label="Toggle navigation" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <ul class="nav__links">${links}</ul>
    </div>`;

  const toggle = host.querySelector(".nav__toggle");
  toggle.addEventListener("click", function () {
    const open = host.dataset.open === "true";
    host.dataset.open = open ? "false" : "true";
    toggle.setAttribute("aria-expanded", open ? "false" : "true");
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 860) {
      host.dataset.open = "false";
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

/* ---------------------------------------------------------------------- */
/* Page background                                                         */
/* ---------------------------------------------------------------------- */

function renderFieldArt() {
  document.querySelectorAll("[data-field]").forEach(function (host) {
    if (typeof ART === "undefined") return;
    const seed = host.dataset.field || "field";
    const dens = parseFloat(host.dataset.fieldDensity || "1");
    const op   = parseFloat(host.dataset.fieldOpacity || "0.17");
    const eqs  = host.dataset.fieldEquations == null
      ? 5 : parseInt(host.dataset.fieldEquations, 10);
    const cnt  = host.dataset.fieldCount == null
      ? 12 : parseInt(host.dataset.fieldCount, 10);
    /* "title" keeps the centre band clear for a large page heading */
    const ko = host.dataset.fieldKeepout === "title"
      ? [{ x0: .20, x1: .80, y0: .36, y1: .64 }] : [];
    host.insertAdjacentHTML("afterbegin", ART.field(seed, 1600, 1000,
      { density: dens, opacity: op, equations: eqs, count: cnt, keepOut: ko }));
  });
}

/* ---------------------------------------------------------------------- */

function boot() {
  renderNav();
  renderFieldArt();
  const y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
