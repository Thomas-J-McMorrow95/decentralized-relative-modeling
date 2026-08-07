/* =========================================================================
   art.js — the drawing library.
   -------------------------------------------------------------------------
   Two families, both rendered as inline SVG so there are no image files to
   manage and everything stays crisp at any size:

     ART.dag(name)     causal DAG structures, "haloed" style
     ART.figure(name)  classic statistics / causal-inference figures
     ART.field(seed)   a scattered field of figures, for page backgrounds

   Conventions used throughout, so the whole set reads as one system:
     · amber  — sources and intermediates
     · red    — the thing being caused (sink nodes, treated arms, effects)
     · dashed — anything counterfactual, unobserved or assumed

   Several figures follow the technically correct convention rather than the
   popular one; those are noted inline. Worth preserving if you edit them.
   ========================================================================= */

const ART = (function () {
  "use strict";

  const C = {
    ink:   "#ffb066",   /* amber — sources, controls, observed          */
    line:  "#f0813a",   /* orange — edges, axes, structure              */
    hot:   "#ff5b2e",   /* red — sinks, treated arms, effects           */
    faint: "rgba(240,129,58,.45)",
    base:  "#1a0f0a"
  };

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */

  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < String(str).length; i++) {
      h ^= String(str).charCodeAt(i); h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const n = v => (+v).toFixed(1);

  function line(x1, y1, x2, y2, o) {
    o = o || {};
    return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"
      stroke="${o.c || C.line}" stroke-width="${o.w || 1.4}"
      ${o.dash ? `stroke-dasharray="${o.dash}"` : ""}
      ${o.op ? `opacity="${o.op}"` : ""} stroke-linecap="round"/>`;
  }
  function path(d, o) {
    o = o || {};
    return `<path d="${d}" fill="${o.fill || "none"}"
      ${o.fillOp ? `fill-opacity="${o.fillOp}"` : ""}
      stroke="${o.c || C.line}" stroke-width="${o.w || 1.4}"
      ${o.dash ? `stroke-dasharray="${o.dash}"` : ""}
      ${o.op ? `opacity="${o.op}"` : ""} stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  function dot(x, y, r, o) {
    o = o || {};
    return `<circle cx="${n(x)}" cy="${n(y)}" r="${r}"
      fill="${o.hollow ? "none" : (o.c || C.ink)}"
      ${o.hollow ? `stroke="${o.c || C.ink}" stroke-width="${o.w || 1.3}"` : ""}
      ${o.dash ? `stroke-dasharray="${o.dash}"` : ""}
      ${o.op ? `opacity="${o.op}"` : ""}/>`;
  }
  function rect(x, y, w, h, o) {
    o = o || {};
    return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${o.r || 2}"
      fill="${o.fill || "none"}" ${o.fillOp ? `fill-opacity="${o.fillOp}"` : ""}
      ${o.c ? `stroke="${o.c}" stroke-width="${o.w || 1.2}"` : ""}
      ${o.dash ? `stroke-dasharray="${o.dash}"` : ""}
      ${o.op ? `opacity="${o.op}"` : ""}/>`;
  }
  function label(x, y, t, o) {
    o = o || {};
    return `<text x="${n(x)}" y="${n(y)}" fill="${o.c || C.line}"
      font-family="Chivo, sans-serif" font-size="${o.s || 10}"
      text-anchor="${o.a || "middle"}" ${o.op ? `opacity="${o.op}"` : ""}>${t}</text>`;
  }
  /* axes: L-shape, bottom and left */
  function axes(w, h, p) {
    return line(p, h - p, w - p * .5, h - p, { w: 1.1, op: .5 }) +
           line(p, p * .5, p, h - p, { w: 1.1, op: .5 });
  }
  function arrowTo(x1, y1, x2, y2, o) {
    o = o || {};
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, head = o.head || 7, wd = o.wd || 3.2;
    const bx = x2 - ux * head, by = y2 - uy * head, nx = -uy, ny = ux;
    return line(x1, y1, x2 - ux * head * .7, y2 - uy * head * .7, o) +
      path(`M${n(bx + nx * wd)} ${n(by + ny * wd)}L${n(x2)} ${n(y2)}L${n(bx - nx * wd)} ${n(by - ny * wd)}`,
           { c: o.c || C.line, w: o.w || 1.4 });
  }

  /* ------------------------------------------------------------------ */
  /* DAG structures                                                      */
  /* ------------------------------------------------------------------ */

  const DAGS = {
    chain:      { nodes: [[.14,.5],[.5,.5],[.86,.5]], edges: [[0,1],[1,2]] },
    fork:       { nodes: [[.5,.19],[.16,.81],[.84,.81]], edges: [[0,1],[0,2]] },
    collider:   { nodes: [[.16,.19],[.84,.19],[.5,.81]], edges: [[0,2],[1,2]] },
    mediator:   { nodes: [[.13,.76],[.5,.24],[.87,.76]], edges: [[0,1],[1,2],[0,2]] },
    diamond:    { nodes: [[.5,.13],[.15,.5],[.85,.5],[.5,.87]], edges: [[0,1],[0,2],[1,3],[2,3]] },
    instrument: { nodes: [[.09,.66],[.4,.66],[.75,.66],[.575,.19]], edges: [[0,1],[1,2],[3,1],[3,2]] },
    backdoor:   { nodes: [[.15,.75],[.85,.75],[.35,.22],[.68,.22]], edges: [[2,0],[2,3],[3,1],[0,1]] },
    cascade:    { nodes: [[.1,.3],[.1,.7],[.45,.5],[.78,.28],[.78,.72]], edges: [[0,2],[1,2],[2,3],[2,4]] }
  };
  const DAG_NAMES = Object.keys(DAGS);

  function dag(name, w, h, k) {
    const st = DAGS[name] || DAGS.chain;
    k = k || 1;
    const pad = h * 0.21, R = 5.2 * k, sw = 1.3 * k, head = 8 * k;
    const pts = st.nodes.map(p => [pad + p[0] * (w - 2 * pad), pad + p[1] * (h - 2 * pad)]);
    let out = "";
    st.edges.forEach(([a, b]) => {
      const [x1, y1] = pts[a], [x2, y2] = pts[b];
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const gap = R + 3.5 * k;
      out += arrowTo(x1 + ux * gap, y1 + uy * gap, x2 - ux * gap, y2 - uy * gap,
                     { c: C.line, w: sw, dash: "4 3", head: head, wd: 3.7 * k });
    });
    pts.forEach(([x, y], i) => {
      const sink = !st.edges.some(([a]) => a === i);
      const c = sink ? C.hot : C.ink;
      out += dot(x, y, R * 2.1, { hollow: true, c: c, w: sw * .8, op: .32 });
      out += dot(x, y, R, { c: c });
    });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Figures                                                             */
  /* Each draws into a w × h box. Kept schematic — these are meant to be */
  /* recognised in silhouette, not read.                                 */
  /* ------------------------------------------------------------------ */

  const FIGURES = {

    /* --- the three difference-in-differences functional forms -------- */

    /* Additive: parallel trends in LEVELS.
       NOTE the counterfactual is drawn parallel to the CONTROL trend, not
       flat. A flat counterfactual would be a before/after comparison. */
    didLevels: function (w, h) {
      const p = w * .13, x0 = p + w * .10, x1 = w - p - w * .08, ym = h - p;
      const Y = v => ym - v * (ym - p * .6);
      let o = axes(w, h, p);
      o += line(x0, Y(.24), x1, Y(.46), { c: C.ink, w: 1.8 });                    /* control  */
      o += line(x0, Y(.52), x1, Y(.90), { c: C.hot, w: 2.1 });                    /* treated  */
      o += line(x0, Y(.52), x1, Y(.74), { c: C.ink, w: 1.4, dash: "5 4", op: .85 });/* cf      */
      o += line(x1 - 4, Y(.90), x1 - 4, Y(.74), { c: C.hot, w: 1.6 });            /* effect   */
      [[x0, .24, C.ink], [x1, .46, C.ink], [x0, .52, C.hot], [x1, .90, C.hot]]
        .forEach(([x, v, c]) => o += dot(x, Y(v), 3.4, { c: c }));
      o += dot(x1, Y(.74), 3.4, { hollow: true, c: C.ink, w: 1.3 });
      return o;
    },

    /* Multiplicative: parallel trends in LOGS. Same geometry, but the
       y-axis ticks are log-spaced — bunching toward the top is the tell,
       and on this axis parallel means equal growth RATE. */
    didLog: function (w, h) {
      const p = w * .13, x0 = p + w * .10, x1 = w - p - w * .08, ym = h - p;
      const Y = v => ym - v * (ym - p * .6);
      let o = axes(w, h, p);
      [.12, .34, .56, .78, .97].forEach(v => o += line(p - 4, Y(v), p, Y(v), { w: 1, op: .55 }));
      o += line(x0, Y(.28), x1, Y(.60), { c: C.ink, w: 1.8 });
      o += line(x0, Y(.58), x1, Y(.90), { c: C.hot, w: 2.1 });
      [[x0, .28, C.ink], [x1, .60, C.ink], [x0, .58, C.hot], [x1, .90, C.hot]]
        .forEach(([x, v, c]) => o += dot(x, Y(v), 3.4, { c: c }));
      return o;
    },

    /* Logit / odds-ratio: parallel trends in LOG-ODDS, for binary
       outcomes. Drawn as the ceiling violation — the additive
       counterfactual shoots through p = 1, the logit one bends below it. */
    didLogit: function (w, h) {
      const p = w * .13, x0 = p + w * .10, x1 = w - p - w * .08, ym = h - p;
      const top = p * .5, Y = v => ym - v * (ym - top);
      let o = axes(w, h, p);
      o += line(p, Y(1), w - p * .5, Y(1), { c: C.ink, w: 1.2, op: .55 });        /* ceiling */
      o += label(w - p * .6, Y(1) - 5, "p = 1", { s: 8.5, a: "end", op: .6, c: C.ink });
      o += line(x0, Y(.10), x1, Y(.30), { c: C.ink, w: 1.7 });                    /* control */
      o += line(x0, Y(.90), x1 * .62 + x0 * .38, Y(1.10), { c: C.hot, w: 1.4, dash: "5 4" });
      o += path(`M${n(x0)} ${n(Y(.90))}Q${n((x0 + x1) / 2)} ${n(Y(.985))} ${n(x1)} ${n(Y(.972))}`,
                { c: C.line, w: 1.6, dash: "5 4" });
      o += dot(x0, Y(.90), 3.4, { c: C.hot });
      o += dot(x0, Y(.10), 3.4, { c: C.ink });
      o += dot(x1, Y(.30), 3.4, { c: C.ink });
      o += dot(x1, Y(.972), 3.4, { hollow: true, c: C.line, w: 1.3 });
      return o;
    },

    /* --- propensity scores ------------------------------------------- */

    /* Mirrored histogram: treated up, control down, sharing a centre
       line. The gap on the control side at high scores is the positivity
       violation — that gap is the point of the figure. */
    psOverlap: function (w, h) {
      const p = w * .11, mid = h / 2, bw = (w - 2 * p) / 13;
      const up = [.10,.16,.24,.34,.46,.58,.70,.82,.92,.98,.90,.72,.48];
      const dn = [.96,.92,.84,.72,.58,.46,.34,.24,.16,.09,.04,.01,.00];
      let o = line(p, mid, w - p, mid, { w: 1.2, op: .6 });
      const A = (h / 2 - p * .55);
      up.forEach((v, i) => o += rect(p + i * bw + 1, mid - v * A, bw - 2, v * A,
        { fill: C.hot, fillOp: .30, c: C.hot, w: .9, r: 1 }));
      dn.forEach((v, i) => o += rect(p + i * bw + 1, mid, bw - 2, v * A,
        { fill: C.ink, fillOp: .22, c: C.ink, w: .9, r: 1 }));
      return o;
    },

    /* IPW: covariate distributions offset, then superimposed. */
    ipw: function (w, h) {
      const p = w * .11, ym = h - p, halfW = (w - 2 * p) / 2 - w * .03;
      function hump(ox, mu, amp, c) {
        let d = `M${n(ox)} ${n(ym)}`;
        for (let t = 0; t <= 1.001; t += .05) {
          const x = ox + t * halfW;
          const y = ym - amp * Math.exp(-Math.pow((t - mu) / .21, 2) / 2);
          d += `L${n(x)} ${n(y)}`;
        }
        return path(d + `L${n(ox + halfW)} ${n(ym)}`, { c: c, w: 1.5, fill: c, fillOp: .16 });
      }
      const A = (ym - p * .7) * .82;
      let o = line(p, ym, p + halfW, ym, { w: 1, op: .5 });
      o += hump(p, .34, A, C.ink) + hump(p, .66, A, C.hot);
      const ox = p + halfW + w * .06;
      o += line(ox, ym, ox + halfW, ym, { w: 1, op: .5 });
      o += hump(ox, .49, A, C.ink) + hump(ox, .52, A, C.hot);
      o += arrowTo(p + halfW - 2, p * .8, ox + 2, p * .8, { w: 1.1, op: .5, head: 5, wd: 2.4 });
      return o;
    },

    /* Love plot: paired dots, before scattered right, after collapsed on
       zero, with the 0.1 rule-of-thumb line. */
    lovePlot: function (w, h) {
      const rows = 6, p = w * .10, x0 = p, xEnd = w - p;
      const y0 = h * .17, dy = (h * .66) / (rows - 1);
      const rand = seeded(4021);
      let o = line(x0, y0 - 10, x0, y0 + (rows - 1) * dy + 10, { w: 1.1, op: .55 });
      const thr = x0 + (xEnd - x0) * .18;
      o += line(thr, y0 - 10, thr, y0 + (rows - 1) * dy + 10, { w: 1, dash: "4 4", op: .5 });
      for (let i = 0; i < rows; i++) {
        const y = y0 + i * dy;
        const pre = x0 + (xEnd - x0) * (.42 + rand() * .52);
        const post = x0 + (xEnd - x0) * (rand() * .13);
        o += line(post, y, pre, y, { w: 1, op: .4 });
        o += dot(pre, y, 3.6, { hollow: true, c: C.ink, w: 1.4 });
        o += dot(post, y, 3.6, { c: C.hot });
      }
      return o;
    },

    /* --- other classics ---------------------------------------------- */

    /* Simpson's paradox: steep positive within-group slopes, one long
       negative pooled slope through them. */
    simpson: function (w, h) {
      const p = w * .12, rand = seeded(7717);
      let o = axes(w, h, p);
      const groups = [[.22, .32], [.46, .55], [.72, .76]];
      groups.forEach(([gx, gy]) => {
        const cx = p + gx * (w - 2 * p), cy = (h - p) - gy * (h - p * 1.6);
        for (let i = 0; i < 7; i++) {
          const t = (rand() - .5), u = (rand() - .5);
          o += dot(cx + t * w * .13 + u * w * .02, cy - t * h * .16 + u * h * .05,
                   2.3, { c: C.ink, op: .85 });
        }
        o += line(cx - w * .075, cy + h * .095, cx + w * .075, cy - h * .095, { c: C.ink, w: 1.5 });
      });
      o += line(p + w * .10, (h - p) - .30 * (h - p * 1.6),
                w - p - w * .04, (h - p) - .76 * (h - p * 1.6),
                { c: C.hot, w: 2, dash: "6 4" });
      return o;
    },

    /* RD: binned means, separate fits per side, jump at the cutoff. */
    rd: function (w, h) {
      const p = w * .12, ym = h - p, xc = w / 2, rand = seeded(313);
      const Y = v => ym - v * (ym - p * .6);
      let o = axes(w, h, p);
      for (let i = 0; i < 9; i++) {
        const x = p + 6 + (i / 8) * (xc - p - 12);
        o += dot(x, Y(.26 + (i / 8) * .22 + (rand() - .5) * .08), 2.4, { c: C.ink });
      }
      for (let i = 0; i < 9; i++) {
        const x = xc + 6 + (i / 8) * (w - p - xc - 12);
        o += dot(x, Y(.60 + (i / 8) * .22 + (rand() - .5) * .08), 2.4, { c: C.hot });
      }
      o += line(xc, p * .5, xc, ym, { w: 1.2, dash: "4 4", op: .65 });
      o += line(p + 6, Y(.26), xc, Y(.48), { c: C.ink, w: 1.8 });
      o += line(xc, Y(.60), w - p - 6, Y(.82), { c: C.hot, w: 1.8 });
      return o;
    },

    /* Event study: reference period pinned at zero with no interval. */
    eventStudy: function (w, h) {
      const p = w * .12, ym = h - p, mid = (ym + p * .6) * .55, N = 9;
      const x0 = p + 10, dx = (w - p - 10 - x0) / (N - 1), rand = seeded(881);
      const v = [.02, -.03, .01, 0, -.02, .18, .28, .34, .40];
      let o = axes(w, h, p);
      o += line(p, mid, w - p * .5, mid, { w: 1, dash: "3 4", op: .5 });
      o += line(x0 + 4.5 * dx, p * .5, x0 + 4.5 * dx, ym, { w: 1.1, dash: "4 4", op: .55 });
      v.forEach((val, i) => {
        const x = x0 + i * dx, y = mid - val * (ym - p) * 1.0;
        const c = i < 5 ? C.ink : C.hot, e = i === 3 ? 0 : 7 + rand() * 6;
        if (e) o += line(x, y - e, x, y + e, { c: c, w: 1.3, op: .85 });
        o += dot(x, y, 2.9, { c: c });
      });
      return o;
    },

    /* Kaplan–Meier: descending step functions with censoring ticks. */
    survival: function (w, h) {
      const p = w * .12, ym = h - p, top = p * .6;
      const Y = v => top + (1 - v) * (ym - top);
      let o = axes(w, h, p);
      function curve(vals, c) {
        let d = `M${n(p)} ${n(Y(1))}`, px = p, py = Y(1), s = "";
        vals.forEach(([t, v]) => {
          const x = p + t * (w - p * 1.5 - p);
          d += `L${n(x)} ${n(py)}L${n(x)} ${n(Y(v))}`;
          px = x; py = Y(v);
        });
        d += `L${n(w - p * .6)} ${n(py)}`;
        return path(d, { c: c, w: 1.7 }) + s;
      }
      o += curve([[.12,.93],[.26,.85],[.40,.79],[.56,.72],[.72,.68],[.88,.64]], C.ink);
      o += curve([[.10,.86],[.22,.71],[.36,.58],[.50,.47],[.66,.38],[.82,.31]], C.hot);
      [[.33,.79],[.62,.72]].forEach(([t, v]) =>
        o += line(p + t * (w - p * 2.5), Y(v) - 3.5, p + t * (w - p * 2.5), Y(v) + 3.5, { c: C.ink, w: 1.2 }));
      return o;
    },

    /* ROC: square, chance diagonal, upper-left bulge. */
    roc: function (w, h) {
      const s = Math.min(w, h) - w * .2, ox = (w - s) / 2, oy = (h - s) / 2;
      let o = rect(ox, oy, s, s, { c: C.line, w: 1.1, op: .5 });
      o += line(ox, oy + s, ox + s, oy, { w: 1.1, dash: "4 4", op: .55 });
      o += path(`M${n(ox)} ${n(oy + s)}C${n(ox + s * .08)} ${n(oy + s * .38)} ${n(ox + s * .36)} ${n(oy + s * .07)} ${n(ox + s)} ${n(oy)}`,
                { c: C.hot, w: 2 });
      return o;
    },

    /* Forest plot: whiskered squares straddling a null line, then a
       pooled diamond. x is log-scaled for ratio measures. */
    forest: function (w, h) {
      const rows = 5, p = w * .10, xNull = w * .56;
      const y0 = h * .16, dy = (h * .60) / (rows - 1), rand = seeded(551);
      let o = line(xNull, y0 - 9, xNull, h - p * .9, { w: 1.2, op: .65 });
      for (let i = 0; i < rows; i++) {
        const y = y0 + i * dy, c = xNull + (rand() - .55) * w * .30, e = w * (.07 + rand() * .10);
        o += line(c - e, y, c + e, y, { c: C.ink, w: 1.2 });
        const sz = 2.6 + rand() * 2.2;
        o += rect(c - sz, y - sz, sz * 2, sz * 2, { fill: C.ink, fillOp: .95, r: .5 });
      }
      const dy2 = h - p * 1.1, dcx = xNull - w * .05, dw = w * .10;
      o += path(`M${n(dcx - dw)} ${n(dy2)}L${n(dcx)} ${n(dy2 - 5)}L${n(dcx + dw)} ${n(dy2)}L${n(dcx)} ${n(dy2 + 5)}Z`,
                { c: C.hot, w: 1.3, fill: C.hot, fillOp: .6 });
      return o;
    },

    /* Funnel plot: SE on an inverted y-axis (the correct convention),
       giving the inverted triangle with a missing bottom-left corner. */
    funnel: function (w, h) {
      const p = w * .12, xc = w * .52, ym = h - p, top = p * .6, rand = seeded(1279);
      let o = axes(w, h, p);
      o += line(xc, top, xc - w * .30, ym, { w: 1.1, dash: "4 4", op: .55 });
      o += line(xc, top, xc + w * .30, ym, { w: 1.1, dash: "4 4", op: .55 });
      for (let i = 0; i < 22; i++) {
        const t = rand(), y = top + t * (ym - top), spread = t * w * .28;
        let x = xc + (rand() - .5) * 2 * spread;
        if (x < xc && t > .55 && rand() < .72) continue;   /* publication bias */
        o += dot(x, y, 2.4, { c: t > .6 ? C.hot : C.ink, op: .9 });
      }
      return o;
    },

    /* Q-Q: square, 45° reference, S-shaped departure in the tails. */
    qq: function (w, h) {
      const s = Math.min(w, h) - w * .2, ox = (w - s) / 2, oy = (h - s) / 2;
      let o = rect(ox, oy, s, s, { c: C.line, w: 1.1, op: .45 });
      o += line(ox, oy + s, ox + s, oy, { w: 1.2, dash: "4 4", op: .6 });
      for (let i = 0; i < 16; i++) {
        const t = (i + .5) / 16, bend = Math.pow(t - .5, 3) * 3.1;
        o += dot(ox + t * s, oy + s - (t + bend) * s, 2.3, { c: C.hot });
      }
      return o;
    },

    /* Bootstrap / sampling distribution: histogram with the estimate and
       the 2.5 / 97.5 percentiles marked. */
    bootstrap: function (w, h) {
      const p = w * .11, ym = h - p, bars = 15, bw = (w - 2 * p) / bars;
      let o = line(p, ym, w - p, ym, { w: 1.1, op: .5 });
      const A = ym - p * .65;
      for (let i = 0; i < bars; i++) {
        const t = (i + .5) / bars;
        const v = Math.exp(-Math.pow((t - .5) / .19, 2) / 2);
        o += rect(p + i * bw + 1, ym - v * A, bw - 2, v * A,
                  { fill: C.ink, fillOp: .30, c: C.ink, w: .8, r: 1 });
      }
      o += line(p + (w - 2 * p) * .5, ym - A * 1.06, p + (w - 2 * p) * .5, ym, { c: C.hot, w: 1.8 });
      [.16, .84].forEach(t => o += line(p + (w - 2 * p) * t, ym - A * .72,
                                        p + (w - 2 * p) * t, ym, { c: C.line, w: 1.2, dash: "4 3" }));
      return o;
    },

    /* Power curve: sigmoid with the 0.8 convention line. */
    power: function (w, h) {
      const p = w * .12, ym = h - p, top = p * .6, Y = v => ym - v * (ym - top);
      let o = axes(w, h, p);
      o += line(p, Y(.8), w - p * .5, Y(.8), { w: 1.1, dash: "4 4", op: .55 });
      let d = "";
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, v = .05 + .94 / (1 + Math.exp(-(t - .45) * 11));
        d += (i ? "L" : "M") + n(p + t * (w - p * 1.5)) + " " + n(Y(v));
      }
      o += path(d, { c: C.hot, w: 2 });
      return o;
    },

    /* Science table: the fundamental problem — one cell observed per row. */
    scienceTable: function (w, h) {
      const rows = 4, cw = w * .21, ch = h * .12, gap = h * .05;
      const x0 = w / 2 - cw - w * .045, y0 = (h - (rows * ch + (rows - 1) * gap)) / 2 + h * .05;
      let o = label(x0 + cw / 2, y0 - h * .055, "Y(0)", { s: 9.5, c: C.ink }) +
              label(x0 + cw + w * .09 + cw / 2, y0 - h * .055, "Y(1)", { s: 9.5, c: C.ink });
      for (let r = 0; r < rows; r++) {
        const y = y0 + r * (ch + gap), obs = r % 2;
        [0, 1].forEach(c => {
          const x = x0 + c * (cw + w * .09);
          if (c === obs) o += rect(x, y, cw, ch, { fill: C.line, fillOp: .8, r: 2 });
          else {
            o += rect(x, y, cw, ch, { c: C.line, w: 1.1, dash: "4 3", op: .65, r: 2 });
            o += label(x + cw / 2, y + ch * .74, "?", { s: 10, op: .75 });
          }
        });
      }
      return o;
    },

    /* Collider / selection bias: a round cloud sliced on the diagonal,
       the survivors sloping the wrong way. */
    colliderBias: function (w, h) {
      const p = w * .12, rand = seeded(2273), cx = w / 2, cy = h / 2;
      const rx = (w - 2 * p) / 2, ry = (h - 2 * p) / 2;
      let o = axes(w, h, p);
      const kept = [];
      for (let i = 0; i < 46; i++) {
        const a = rand() * Math.PI * 2, r = Math.sqrt(rand());
        const x = cx + Math.cos(a) * r * rx * .92, y = cy + Math.sin(a) * r * ry * .92;
        const sel = (x - p) / (w - 2 * p) + ((h - p) - y) / (h - 2 * p) > 1.02;
        o += dot(x, y, 2.2, { c: sel ? C.hot : C.ink, op: sel ? .95 : .22 });
        if (sel) kept.push([x, y]);
      }
      o += line(p, p * 1.05, w - p, h - p * 1.05, { w: 1.2, dash: "5 4", op: .6 });
      o += line(cx - rx * .55, cy - ry * .42, cx + rx * .62, cy + ry * .30, { c: C.hot, w: 1.8 });
      return o;
    },

    /* Prior → posterior: three nested humps, posterior tallest. */
    posterior: function (w, h) {
      const p = w * .11, ym = h - p, A = ym - p * .6;
      function hump(mu, sd, amp, c, dash) {
        let d = "";
        for (let i = 0; i <= 30; i++) {
          const t = i / 30, x = p + t * (w - 2 * p);
          const y = ym - amp * A * Math.exp(-Math.pow((t - mu) / sd, 2) / 2);
          d += (i ? "L" : "M") + n(x) + " " + n(y);
        }
        return path(d, { c: c, w: dash ? 1.3 : 1.9, dash: dash });
      }
      let o = line(p, ym, w - p, ym, { w: 1.1, op: .5 });
      o += hump(.34, .26, .52, C.ink, "5 4");
      o += hump(.68, .17, .68, C.line, "2 3");
      o += hump(.57, .13, .97, C.hot, null);
      return o;
    },

    /* Calibration: [0,1] box, diagonal, sagging curve, rug along the base. */
    calibration: function (w, h) {
      const s = Math.min(w, h) - w * .2, ox = (w - s) / 2, oy = (h - s) / 2;
      const rand = seeded(97);
      let o = rect(ox, oy, s, s, { c: C.line, w: 1.1, op: .45 });
      o += line(ox, oy + s, ox + s, oy, { w: 1.2, dash: "4 4", op: .6 });
      let d = "";
      for (let i = 0; i <= 12; i++) {
        const t = i / 12, v = Math.pow(t, 1.55);
        d += (i ? "L" : "M") + n(ox + t * s) + " " + n(oy + s - v * s);
      }
      o += path(d, { c: C.hot, w: 1.9 });
      for (let i = 0; i < 22; i++) {
        const x = ox + rand() * s;
        o += line(x, oy + s, x, oy + s - 5, { c: C.ink, w: .9, op: .5 });
      }
      return o;
    }
  };


  /* ------------------------------------------------------------------ */
  /* Equations                                                           */
  /* -----------------------------------------------------------------------
     Set as SVG text so they scale with everything else. The mini-parser
     handles _sub and ^sup, with {braces} for multi-character groups —
     enough for the notation these formulas need, and no dependency.
     ---------------------------------------------------------------------- */

  function mathText(str, size, color) {
    const spans = [];
    let i = 0, buf = "";
    const flush = () => { if (buf) { spans.push({ t: buf, k: "n" }); buf = ""; } };
    while (i < str.length) {
      const ch = str[i];
      if (ch === "_" || ch === "^") {
        flush();
        const kind = ch === "_" ? "sub" : "sup";
        i++;
        if (str[i] === "{") {
          const close = str.indexOf("}", i);
          spans.push({ t: str.slice(i + 1, close), k: kind });
          i = close + 1;
        } else { spans.push({ t: str[i], k: kind }); i++; }
      } else { buf += ch; i++; }
    }
    flush();

    let off = 0, out = "";
    spans.forEach(s => {
      const want = s.k === "sub" ? 0.30 : s.k === "sup" ? -0.42 : 0;
      const dy = (want - off).toFixed(3);
      off = want;
      const fs = s.k === "n" ? size : size * 0.68;
      out += `<tspan dy="${dy}em" font-size="${fs.toFixed(2)}">${s.t
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")}</tspan>`;
    });
    return { spans: out, color: color };
  }

  /* Short enough to stay legible when scattered small. */
  const EQUATIONS = [
    { s: "τ = 𝔼[Y(1) − Y(0)]",                     w: 11 },
    { s: "e(x) = ℙ(T = 1 | X = x)",                                w: 13 },
    { s: "(Y(0), Y(1)) ⫫ T | X",                                   w: 12 },
    { s: "ℙ(y | do(x)) = ∑_z ℙ(y | x, z) ℙ(z)",     w: 19 },
    { s: "τ = (Ȳ_{11} − Ȳ_{10}) − (Ȳ_{01} − Ȳ_{00})", w: 19 },
    { s: "w_i = T_i / e_i + (1 − T_i) / (1 − e_i)",           w: 19 },
    { s: "ATT = 𝔼[Y(1) − Y(0) | T = 1]",                w: 17 },
    { s: "Y_i = T_i Y_i(1) + (1 − T_i) Y_i(0)",                    w: 18 },
    { s: "𝔼[Y | do(x)] ≠ 𝔼[Y | x]",          w: 14 },
    { s: "δ = Δlog Y_T − Δlog Y_C",                 w: 13 }
  ];

  function equation(idx, size, color) {
    const e = EQUATIONS[idx % EQUATIONS.length];
    const m = mathText(e.s, size, color || C.ink);
    return { svg: `<text x="0" y="0" fill="${color || C.ink}" font-family="Iowan Old Style, Palatino, Georgia, serif" font-style="italic" font-size="${size}">${m.spans}</text>`,
             w: e.w * size * 0.52, h: size * 1.5 };
  }

  const FIG_NAMES = Object.keys(FIGURES);

  /* ------------------------------------------------------------------ */
  /* public API                                                          */
  /* ------------------------------------------------------------------ */

  function svg(inner, w, h, cls) {
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet"
      ${cls ? `class="${cls}"` : ""} role="img" aria-hidden="true">${inner}</svg>`;
  }

  /* a card thumbnail: gradient ground + one motif */
  function tile(kind, name, w, h) {
    w = w || 320; h = h || 184;
    const id = "a" + hash(kind + name).toString(36);
    const inner = kind === "figure" ? (FIGURES[name] || FIGURES.didLevels)(w, h) : dag(name, w, h, 1);
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="${id}" gradientTransform="rotate(118 .5 .5)">
          <stop offset="0%" stop-color="#0d0908"/><stop offset="42%" stop-color="#1a0f0a"/>
          <stop offset="76%" stop-color="#2b1509"/><stop offset="100%" stop-color="#411d0b"/>
        </linearGradient>
        <radialGradient id="${id}b" cx="26%" cy="20%" r="72%">
          <stop offset="0%" stop-color="hsl(22 90% 48%)" stop-opacity=".32"/>
          <stop offset="100%" stop-color="hsl(22 90% 48%)" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#${id})"/>
      <rect width="${w}" height="${h}" fill="url(#${id}b)"/>
      ${inner}</svg>`;
  }

  /* ------------------------------------------------------------------ */
  /* the background field                                                */
  /* -----------------------------------------------------------------------
     A scattered wall of figures, deliberately much lighter than the
     reference "blackboard" images — light enough to read type over.
     The three DiD variants are pinned to widely separated anchors so they
     never cluster; everything else is placed on a jittered grid.
     ---------------------------------------------------------------------- */

  function field(seedText, w, h, opts) {
    opts = opts || {};
    const rand = seeded(hash(seedText || "field"));
    const W = w || 1600, H = h || 1000;
    const baseOp = opts.opacity || .30;
    const FW = 300, FH = 180;

    /* Placement runs inside a margin so nothing is clipped by the viewBox,
       and every figure is checked against the ones already placed so the
       field stays legible rather than piling up. */
    const mx = W * .06, my = H * .07;
    const placed = [];

    /* Rectangles the field must stay out of, in fractional coordinates —
       the hero pages put a large title dead centre. */
    const keepOut = (opts.keepOut || []).map(k => ({
      x0: k.x0 * W, x1: k.x1 * W, y0: k.y0 * H, y1: k.y1 * H }));
    function blocked(cx, cy, rw, rh) {
      return keepOut.some(k =>
        cx + rw > k.x0 && cx - rw < k.x1 && cy + rh > k.y0 && cy - rh < k.y1);
    }

    function fits(cx, cy, sc) {
      const rw = FW * sc * .58, rh = FH * sc * .58;
      if (cx - rw < mx || cx + rw > W - mx || cy - rh < my || cy + rh > H - my) return false;
      if (blocked(cx, cy, rw, rh)) return false;
      return !placed.some(q =>
        Math.abs(q.cx - cx) < (q.rw + rw) * .92 && Math.abs(q.cy - cy) < (q.rh + rh) * .92);
    }
    function put(fnName, cx, cy, sc, op) {
      const g = (FIGURES[fnName] || function () { return ""; })(FW, FH);
      placed.push({ cx: cx, cy: cy, rw: FW * sc * .58, rh: FH * sc * .58,
        svg: `<g opacity="${op.toFixed(2)}" transform="translate(${n(cx - FW * sc / 2)} ${n(cy - FH * sc / 2)}) scale(${sc.toFixed(3)})">${g}</g>` });
    }

    /* The three functional forms are pinned to widely separated thirds so
       they never end up next to each other. */
    [ { fn: "didLevels", x: .18, y: .22 },
      { fn: "didLog",    x: .80, y: .58 },
      { fn: "didLogit",  x: .38, y: .82 },
      { fn: "psOverlap", x: .70, y: .17 },
      { fn: "lovePlot",  x: .12, y: .62 },
      { fn: "simpson",   x: .55, y: .43 }
    ].forEach(pin => {
      const sc = .80 + rand() * .22;
      let cx = pin.x * W, cy = pin.y * H;
      const rw = FW * sc * .58, rh = FH * sc * .58;
      /* if a pin lands on the title, push it vertically clear */
      if (blocked(cx, cy, rw, rh)) cy = cy < H / 2 ? my + rh : H - my - rh;
      put(pin.fn, cx, cy, sc, baseOp * (1.0 + rand() * .22));
    });

    /* Everything else fills the gaps by rejection sampling. */
    const pool = ["rd","eventStudy","survival","roc","forest","funnel","qq",
                  "bootstrap","power","scienceTable","colliderBias","posterior",
                  "calibration","ipw"];
    let k = 0, tries = 0;
    const figTarget = (opts.count || 12) + 6;   /* +6 accounts for the pinned set */
    while (placed.length < figTarget && tries < 1600) {
      tries++;
      const sc = .48 + rand() * .26;
      const cx = mx + rand() * (W - 2 * mx), cy = my + rand() * (H - 2 * my);
      if (!fits(cx, cy, sc)) continue;
      put(pool[(k++) % pool.length], cx, cy, sc, baseOp * (.55 + rand() * .38));
    }

    /* Equations, scattered between the figures — the blackboard reading.
       Deliberately fewer than the figures so they punctuate rather than
       dominate, and never two adjacent. */
    let eqPlaced = 0; tries = 0;
    const eqCount = Math.round((opts.equations == null ? 5 : opts.equations));
    /* shuffle the deck so a field never shows the same formula twice */
    const deck = EQUATIONS.map((_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    while (eqPlaced < Math.min(eqCount, deck.length) && tries < 2500) {
      tries++;
      const size = 15 + rand() * 9;
      const e = equation(deck[eqPlaced], size, rand() < .3 ? C.hot : C.ink);
      const cx = mx + rand() * (W - 2 * mx), cy = my + rand() * (H - 2 * my);
      const rw = e.w / 2, rh = e.h / 2;
      const clash = cx - rw < mx || cx + rw > W - mx || cy - rh < my || cy + rh > H - my ||
        blocked(cx, cy, rw, rh * 2.2) ||
        placed.some(q => Math.abs(q.cx - cx) < (q.rw + rw) * .82 &&
                         Math.abs(q.cy - cy) < (q.rh + rh) * 1.25);
      if (clash) continue;
      placed.push({ cx: cx, cy: cy, rw: rw, rh: rh * 2.2,
        svg: `<g opacity="${(baseOp * (.62 + rand() * .34)).toFixed(2)}" transform="translate(${n(cx - rw)} ${n(cy)})">${e.svg}</g>` });
      eqPlaced++;
    }

    /* A few DAGs threaded through, tying the ground to the card art. */
    let dagsPlaced = 0; tries = 0;
    while (dagsPlaced < 3 && tries < 300) {
      tries++;
      const sc = .46 + rand() * .26;
      const cx = mx + rand() * (W - 2 * mx), cy = my + rand() * (H - 2 * my);
      if (!fits(cx, cy, sc)) continue;
      const name = DAG_NAMES[Math.floor(rand() * DAG_NAMES.length)];
      placed.push({ cx: cx, cy: cy, rw: FW * sc * .58, rh: FH * sc * .58,
        svg: `<g opacity="${(baseOp * (.6 + rand() * .35)).toFixed(2)}" transform="translate(${n(cx - FW * sc / 2)} ${n(cy - FH * sc / 2)}) scale(${sc.toFixed(3)})">${dag(name, FW, FH, 1)}</g>` });
      dagsPlaced++;
    }

    return `<svg class="field" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${placed.map(x => x.svg).join("")}</svg>`;
  }

  return {
    dag: dag, tile: tile, field: field, svg: svg,
    figures: FIGURES, figureNames: FIG_NAMES,
    equation: equation, equations: EQUATIONS,
    dagNames: DAG_NAMES, colors: C, hash: hash
  };
})();

if (typeof window !== "undefined") window.ART = ART;
