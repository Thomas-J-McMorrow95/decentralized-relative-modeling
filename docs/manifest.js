/* =========================================================================
   docs/manifest.js — the list of documents shown on the Documentation page.

   You normally never edit this by hand. Running

       python3 tools/publish.py

   asks you for the details of any new PDF and fills this in for you.

   If you DO want to hand-edit it, the list below is ordinary JSON, so keep
   the quotes and commas where they are.

     file     required. Path to the PDF, e.g. "docs/thing.pdf".
     title    card heading
     date     "2026-06" or "2026-06-14". Shows as "August 2026", and sorts
              the page newest-first.
     authors  list of names
     venue    the bold line (journal, conference, version, whatever)
     tags     list of strings, shown as #pills and used by the filter row
     dag      which of the eight canonical structures to draw. One of:
              chain, fork, collider, mediator, diamond, instrument,
              backdoor, cascade. Omit and one is picked from the filename.
     figure   draw a statistical figure instead of a DAG. One of:
              didLevels, didLog, didLogit, psOverlap, ipw, lovePlot,
              simpson, rd, eventStudy, survival, roc, forest, funnel, qq,
              bootstrap, power, scienceTable, colliderBias, posterior,
              calibration

   A reserved slot holds a space in the row of three for a document that
   isn't ready yet. It has no file, isn't clickable, and is ignored by the
   tag filter:

     { "placeholder": true, "title": "Third document", "note": "Coming soon" }

   When you add a real document, publish.py removes one reserved slot
   automatically, so the row stays three wide instead of growing to four.
   ========================================================================= */

window.DOCUMENTS =
[
  {
    "file": "docs/Causal Modeling Framework.pdf",
    "title": "Causal Modeling Framework",
    "date": "2026-08",
    "authors": ["Thomas J McMorrow"],
    "venue": "Working draft",
    "tags": ["causal-modeling", "framework"],
    "dag": "fork"
  },
  {
    "file": "docs/Prerequisite Mathematical Definitions.pdf",
    "title": "Prerequisite Mathematical Definitions",
    "date": "2026-08",
    "authors": ["Thomas J McMorrow"],
    "venue": "Reference document",
    "tags": ["definitions", "reference"],
    "dag": "chain"
  },
  {
    "placeholder": true,
    "title": "Continuous Tournament",
    "note": "In preparation",
    "dag": "collider"
  }
];
