/* =========================================================================
   site.js — shared shell: brand, navigation, background artwork.
   -------------------------------------------------------------------------
   EDIT HERE to rename the site or change the tabs. The nav is rendered from
   the SITE object below into every page, so there is only one copy to keep
   in sync. No build step, no server: this runs straight from file://.
   ========================================================================= */

const SITE = {
  /* Wordmark in the top-left. Split across two spans so the divider between
     them can be styled; set `right` to "" for a single-word brand. */
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

const BRAND_MARK = `
<svg class="brand__mark" viewBox="0 0 60 44" fill="none" aria-hidden="true">
  <g stroke="currentColor" stroke-width="2.1" stroke-linejoin="round">
    <path d="M30 22 4 4v36z"/>
    <path d="M30 22 56 4v36z"/>
  </g>
  <circle cx="30" cy="22" r="3.1" fill="currentColor"/>
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

  const sep = SITE.brand.right
    ? `<span class="sep">|</span>${SITE.brand.right}`
    : "";

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

  /* Close the mobile menu when the viewport grows back to desktop. */
  window.addEventListener("resize", function () {
    if (window.innerWidth > 860) {
      host.dataset.open = "false";
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

/* ---------------------------------------------------------------------- */
/* Procedural artwork                                                      */
/* -----------------------------------------------------------------------
   Card thumbnails and page backgrounds are generated as inline SVG rather
   than shipped as image files: nothing to export, nothing to optimise, and
   every card gets a stable variant derived from its own title.
   ---------------------------------------------------------------------- */

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* A tiny seeded PRNG so a given seed always draws the same picture. */
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

/* The line motif: a tall narrow X, with side rails and/or inward chevrons.
   Four variants, chosen by seed, so a grid of cards reads as a family
   without any two being identical. */
function lineMotif(rand, w, h, stroke) {
  const cx = w / 2, cy = h / 2;
  const half = w * (0.15 + rand() * 0.06);   /* half-width of the X   */
  const rise = h * (0.32 + rand() * 0.07);   /* half-height of the X  */
  const variant = Math.floor(rand() * 4);
  const p = [];

  /* the X — always present */
  p.push(`M${cx - half} ${cy - rise}L${cx + half} ${cy + rise}`);
  p.push(`M${cx + half} ${cy - rise}L${cx - half} ${cy + rise}`);

  /* vertical rails down each side */
  if (variant !== 1) {
    const railPad = variant === 3 ? rise * 0.18 : 0;
    p.push(`M${cx - half} ${cy - rise + railPad}L${cx - half} ${cy + rise - railPad}`);
    p.push(`M${cx + half} ${cy - rise + railPad}L${cx + half} ${cy + rise - railPad}`);
  }

  /* chevrons pointing in toward the centre, top and bottom */
  if (variant === 1 || variant === 2) {
    const drop = rise * 0.34;
    p.push(`M${cx - half} ${cy + rise}L${cx} ${cy + rise - drop}L${cx + half} ${cy + rise}`);
    p.push(`M${cx - half} ${cy - rise}L${cx} ${cy - rise + drop}L${cx + half} ${cy - rise}`);
  }

  /* a single centre spine */
  if (variant === 3) {
    p.push(`M${cx} ${cy - rise}L${cx} ${cy + rise}`);
  }

  return p.map(function (d) {
    return `<path d="${d}" stroke="${stroke}" stroke-width="1" fill="none"
                  stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
  }).join("");
}

/* Thumbnail for a documentation card: deep blue gradient, a violet bloom and
   a teal bloom placed per-seed, with the line motif faint on top. */
function thumbnailSVG(seedText) {
  const seed = hashString(String(seedText));
  const rand = seeded(seed);
  const w = 220, h = 130;
  const id = "t" + seed.toString(36);

  const angle = 95 + Math.floor(rand() * 60);
  const base  = 218 + Math.floor(rand() * 12);   /* navy hue   */
  const tealH = 192 + Math.floor(rand() * 14);   /* teal hue   */

  return `
<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="${id}" gradientTransform="rotate(${angle} .5 .5)">
      <stop offset="0%"   stop-color="hsl(${base} 74% 19%)"/>
      <stop offset="52%"  stop-color="hsl(${base - 10} 66% 30%)"/>
      <stop offset="100%" stop-color="hsl(${tealH} 45% 44%)"/>
    </linearGradient>
    <radialGradient id="${id}v" cx="${22 + rand() * 46}%" cy="${14 + rand() * 34}%" r="62%">
      <stop offset="0%"   stop-color="hsl(258 72% 58%)" stop-opacity=".50"/>
      <stop offset="100%" stop-color="hsl(258 72% 58%)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}c" cx="${8 + rand() * 24}%" cy="${72 + rand() * 22}%" r="58%">
      <stop offset="0%"   stop-color="hsl(${tealH} 70% 56%)" stop-opacity=".42"/>
      <stop offset="100%" stop-color="hsl(${tealH} 70% 56%)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#${id})"/>
  <rect width="${w}" height="${h}" fill="url(#${id}v)"/>
  <rect width="${w}" height="${h}" fill="url(#${id}c)"/>
  <g opacity=".5">${lineMotif(rand, w, h, "#ffffff")}</g>
</svg>`;
}

/* Full-bleed background for the placeholder pages: the same motif, scaled
   up and scattered, so the empty pages still look deliberate. */
function heroArtSVG(seedText) {
  const rand = seeded(hashString(String(seedText)));
  const w = 1440, h = 900;
  let out = "";

  /* one large centred motif */
  out += `<g opacity=".30" transform="translate(${w * 0.5} ${h * 0.5}) scale(3.4) translate(${-w * 0.5} ${-h * 0.5})">`
       + lineMotif(seeded(hashString(seedText + "core")), w, h, "rgba(255,255,255,.9)")
       + `</g>`;

  /* a scattering of smaller ones */
  for (let i = 0; i < 7; i++) {
    const s = 0.28 + rand() * 0.5;
    const x = rand() * w;
    const y = rand() * h;
    out += `<g opacity="${(0.10 + rand() * 0.16).toFixed(2)}" `
         + `transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${s.toFixed(2)}) translate(${-w / 2} ${-h / 2})">`
         + lineMotif(rand, w, h, "rgba(255,255,255,.95)")
         + `</g>`;
  }

  return `
<svg class="hero__art" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  ${out}
</svg>`;
}

function renderHeroArt() {
  const host = document.querySelector("[data-hero-art]");
  if (!host) return;
  host.insertAdjacentHTML("afterbegin", heroArtSVG(host.dataset.heroArt || "art"));
}

/* ---------------------------------------------------------------------- */

function boot() {
  renderNav();
  renderHeroArt();
  const y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
