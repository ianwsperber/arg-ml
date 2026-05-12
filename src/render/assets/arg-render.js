(function () {
  const NS = "urn:argml:v1";

  const xmlText = document.getElementById("argml-source").textContent.trim();
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");

  const perr = doc.querySelector("parsererror");
  if (perr) {
    document.body.innerHTML =
      '<pre style="padding:32px">' + perr.textContent + "</pre>";
    return;
  }

  // ---------- helpers ----------
  const $ = (sel, r = document) => r.querySelector(sel);
  const $$ = (sel, r = document) => [...r.querySelectorAll(sel)];
  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const escapeAttr = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const parseList = (s) => (s ? s.trim().split(/\s+/).filter(Boolean) : []);
  const childrenByName = (el, name) =>
    [...el.children].filter((c) => c.localName === name);
  const firstChild = (el, name) => childrenByName(el, name)[0];
  const mdLinks = (s) =>
    s.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, t, u) =>
        `<a href="${escapeAttr(u)}" target="_blank" rel="noopener">${escapeHtml(t)}</a>`,
    );
  const formatDate = (d) => {
    try {
      return new Date(d).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return d;
    }
  };

  // ---------- collect declarations ----------
  const meta = (() => {
    const md = doc.querySelector("metadata");
    return {
      title: md.querySelector("title")?.textContent || "",
      author: md.querySelector("author")?.textContent || "",
      date: md.querySelector("date")?.textContent || "",
      source: md.querySelector("source")?.textContent || "",
      epistemicStatus:
        md.querySelector("epistemic-status")?.textContent.trim() || null,
    };
  })();

  const imports = {};
  for (const i of $$("imports > import", doc))
    imports[i.getAttribute("prefix")] = i.getAttribute("doc");

  const terms = {};
  for (const t of $$("terms > term", doc)) {
    const id = t.getAttribute("id");
    terms[id] = {
      id,
      canonical: t.getAttribute("canonical"),
      scope: t.getAttribute("scope"),
      gloss: firstChild(t, "gloss")?.textContent.trim() || null,
      aliases: childrenByName(t, "alias").map((a) => a.textContent.trim()),
    };
  }

  const assumptions = {};
  for (const a of $$("assumptions > assumption", doc)) {
    assumptions[a.getAttribute("id")] = {
      id: a.getAttribute("id"),
      text: a.textContent.trim(),
      restsOn: a.getAttribute("rests-on"),
    };
  }

  const claims = {}; // id -> claim record
  const inferences = {};
  const notes = []; // {idx, html, editorial}
  let noteCounter = 1;

  // ---------- render body recursively ----------
  function renderNode(node) {
    if (node.nodeType === Node.TEXT_NODE)
      return mdLinks(escapeHtml(node.nodeValue));
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const name = node.localName;
    const inner = [...node.childNodes].map(renderNode).join("");

    switch (name) {
      case "section":
        return `<section>${inner}</section>`;
      case "heading": {
        const lvl = Math.min(
          6,
          Math.max(1, parseInt(node.getAttribute("level") || "1") + 1),
        );
        return `<h${lvl}><span class="h-rule"></span>${inner}</h${lvl}>`;
      }
      case "p":
        return `<p>${inner}</p>`;
      case "em":
        return `<em>${inner}</em>`;
      case "strong":
        return `<strong>${inner}</strong>`;
      case "code":
        return `<code>${inner}</code>`;
      case "a":
        return `<a href="${escapeAttr(node.getAttribute("href") || "")}" target="_blank" rel="noopener">${inner}</a>`;

      case "term": {
        const ref = node.getAttribute("ref") || "";
        const isExternal = ref.includes(":");
        return `<span class="ann ann-term" data-ref="${escapeAttr(ref)}" data-external="${isExternal}">${inner}</span>`;
      }

      case "claim": {
        const id = node.getAttribute("id");
        const rec = {
          id,
          supports: parseList(node.getAttribute("supports")),
          attacks: parseList(node.getAttribute("attacks")),
          restsOn: parseList(node.getAttribute("rests-on")),
          via: node.getAttribute("via"),
          credence: node.getAttribute("credence"),
          attackType: node.getAttribute("attack-type") || "rebut",
          defeasible: node.getAttribute("defeasible") ?? "true",
          scheme: node.getAttribute("scheme"),
        };
        claims[id] = rec;
        return `<span class="ann ann-claim"
          id="claim-${escapeAttr(id)}"
          data-id="${escapeAttr(id)}"
          data-defeasible="${escapeAttr(rec.defeasible)}">${inner}</span>`;
      }

      case "evidence": {
        const ref = node.getAttribute("ref") || "";
        const type = node.getAttribute("type") || "src";
        const gloss = firstChild(node, "gloss")?.textContent.trim() || "";
        return `<a class="ann ann-evidence" href="${escapeAttr(ref)}" target="_blank" rel="noopener"
          data-type="${escapeAttr(type)}" data-gloss="${escapeAttr(gloss)}">${escapeHtml(type)}</a>`;
      }

      case "note": {
        const idx = noteCounter++;
        const status = node.getAttribute("status") || "";
        notes.push({ idx, html: inner, editorial: status === "editorial" });
        return `<a class="ann ann-note-marker" href="#fn-${idx}" data-idx="${idx}">${idx}</a>`;
      }

      case "inference": {
        const id = node.getAttribute("id");
        const from = parseList(node.getAttribute("from"));
        const to = node.getAttribute("to");
        const scheme = node.getAttribute("scheme");
        const strength = node.getAttribute("strength");
        const defeasible = node.getAttribute("defeasible") ?? "true";
        inferences[id] = {
          id,
          from,
          to,
          scheme,
          strength,
          defeasible,
          warrant: inner,
        };
        const meta = [
          from.length ? from.join(" + ") + " → " + to : null,
          scheme || null,
          strength ? "strength: " + strength : null,
          defeasible === "false" ? "strict" : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return `<aside class="inference-block" id="inf-${escapeAttr(id)}" data-id="${escapeAttr(id)}">
          <span class="inf-head">Inference ${escapeHtml(id)} <span class="inf-meta">${escapeHtml(meta)}</span></span>
          ${inner}
        </aside>`;
      }

      case "conflict": {
        const id = node.getAttribute("id");
        const attackType = node.getAttribute("attack-type") || "rebut";
        const attacker =
          node.querySelector("attacker")?.getAttribute("idref") || "";
        const target =
          node.querySelector("target")?.getAttribute("idref") || "";
        const resp = node.querySelector("response");
        const respHtml = resp
          ? [...resp.childNodes].map(renderNode).join("")
          : "";
        return `<aside class="inference-block" id="conf-${escapeAttr(id)}">
          <span class="inf-head">Conflict ${escapeHtml(id)} <span class="inf-meta">${escapeHtml(attackType)}: ${escapeHtml(attacker)} → ${escapeHtml(target)}</span></span>
          ${respHtml}
        </aside>`;
      }

      default:
        return inner;
    }
  }

  const bodyEl = doc.querySelector("body");
  const proseHtml = [...bodyEl.childNodes].map(renderNode).join("");

  // ---------- compose page ----------
  document.title = meta.title || "ArgML";

  const root = $("#root");
  root.innerHTML = `
    <header class="doc-header">
      <div class="doc-eyebrow">An ArgML rendering · ${escapeHtml(meta.date ? new Date(meta.date).getFullYear() : "")}</div>
      <h1 class="doc-title">${escapeHtml(meta.title)}</h1>
      <div class="doc-byline">
        <span>${escapeHtml(meta.author)}</span>
        <span class="sep">·</span>
        <span>${escapeHtml(formatDate(meta.date))}</span>
        ${meta.source ? `<span class="sep">·</span><a href="${escapeAttr(meta.source)}" target="_blank" rel="noopener">original</a>` : ""}
      </div>
    </header>
    ${
      meta.epistemicStatus
        ? `
      <aside class="epistemic-banner">
        <span class="label">Epistemic status</span>
        ${escapeHtml(meta.epistemicStatus)}
      </aside>`
        : ""
    }
    <nav class="toolbar" role="toolbar" aria-label="Reader controls">
      <span class="brand">ArgML</span>
      <div class="group">
        <button class="btn" data-toggle="frontmatter" aria-pressed="false"><span class="dot"></span>Frontmatter</button>
        <button class="btn" data-toggle="annotations" aria-pressed="false"><span class="dot"></span>Annotations</button>
        <button class="btn" data-toggle="graph" aria-pressed="false"><span class="dot"></span>Graph</button>
      </div>
    </nav>
    <section class="frontmatter">${renderFrontmatter()}</section>
    <div class="reader">
      <aside class="left-gutter graph-panel">
        <div class="graph-legend">
          <div class="row"><span class="swatch supports"></span>supports</div>
          <div class="row"><span class="swatch attacks"></span>attacks</div>
          <div class="row"><span class="swatch rests-on"></span>rests on</div>
        </div>
        <svg class="graph-svg" xmlns="http://www.w3.org/2000/svg"></svg>
      </aside>
      <article class="prose">${proseHtml}</article>
      <aside class="right-gutter"></aside>
      <svg class="arrows" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <marker id="ah-supports" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#4a6a3e"/>
          </marker>
          <marker id="ah-attacks" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#8a3434"/>
          </marker>
          <marker id="ah-rests" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#6a614a"/>
          </marker>
        </defs>
      </svg>
    </div>
    ${
      notes.length
        ? `
      <section class="footnotes" id="footnotes">
        <h2>Notes</h2>
        <ol>${notes.map((n) => `<li id="fn-${n.idx}" data-editorial="${n.editorial}">${n.html}</li>`).join("")}</ol>
      </section>`
        : ""
    }
  `;

  // ---------- frontmatter HTML ----------
  function renderFrontmatter() {
    let out = "";

    if (Object.keys(imports).length) {
      out += `<div class="fm-block"><h3>Imports <span class="count">${Object.keys(imports).length}</span></h3>`;
      for (const [pref, url] of Object.entries(imports)) {
        out += `<div class="fm-row"><div class="key">${escapeHtml(pref)}:</div>
          <div class="desc"><a href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a></div></div>`;
      }
      out += `</div>`;
    }

    if (Object.keys(terms).length) {
      out += `<div class="fm-block"><h3>Terms <span class="count">${Object.keys(terms).length}</span></h3>`;
      for (const t of Object.values(terms)) {
        const aliases = t.aliases.length
          ? `<div>${t.aliases.map((a) => `<span class="alias">${escapeHtml(a)}</span>`).join("")}</div>`
          : "";
        const canon = t.canonical
          ? `<span class="canon">canonical: ${escapeHtml(t.canonical)}${t.scope === "local" ? " · local scope" : ""}</span>`
          : t.scope === "local"
            ? `<span class="canon">local scope</span>`
            : "";
        out += `<div class="fm-row">
          <div class="key">${escapeHtml(t.id)}</div>
          <div class="desc">${t.gloss ? escapeHtml(t.gloss) : "<em>(no gloss)</em>"}${aliases}${canon}</div>
        </div>`;
      }
      out += `</div>`;
    }

    if (Object.keys(assumptions).length) {
      out += `<div class="fm-block"><h3>Assumptions <span class="count">${Object.keys(assumptions).length}</span></h3>`;
      for (const a of Object.values(assumptions)) {
        out += `<div class="fm-row">
          <div class="key">${escapeHtml(a.id)}</div>
          <div class="desc">${escapeHtml(a.text)}${a.restsOn ? `<span class="canon">rests on: ${escapeHtml(a.restsOn)}</span>` : ""}</div>
        </div>`;
      }
      out += `</div>`;
    }

    return out;
  }

  // ---------- gloss chips ----------
  const rightGutter = $(".right-gutter");

  function refLabel(ref) {
    if (!ref) return "";
    if (ref.includes(":")) {
      const [pref, rest] = ref.split(":");
      return `<span class="pref">${escapeHtml(pref)}</span>:${escapeHtml(rest)}`;
    }
    return escapeHtml(ref);
  }

  function buildClaimGloss(id) {
    const c = claims[id];
    if (!c) return "";
    const cred = c.credence
      ? `<span class="cred"><span class="cred-dot cred-${c.credence}"></span>${escapeHtml(c.credence)}</span>`
      : "";
    const rels = [];
    if (c.supports.length) {
      rels.push(
        `<div class="rel supports"><div class="key">supports</div><div class="vals">${c.supports
          .map(
            (r) =>
              `<a data-target="${escapeAttr(r)}" data-rel="supports">${refLabel(r)}</a>`,
          )
          .join("")}</div></div>`,
      );
    }
    if (c.attacks.length) {
      rels.push(
        `<div class="rel attacks"><div class="key">${escapeHtml(c.attackType)}s</div><div class="vals">${c.attacks
          .map(
            (r) =>
              `<a data-target="${escapeAttr(r)}" data-rel="attacks">${refLabel(r)}</a>`,
          )
          .join("")}</div></div>`,
      );
    }
    if (c.restsOn.length) {
      rels.push(
        `<div class="rel rests-on"><div class="key">rests on</div><div class="vals">${c.restsOn
          .map(
            (r) =>
              `<a data-target="${escapeAttr(r)}" data-rel="rests-on">${refLabel(r)}</a>`,
          )
          .join("")}</div></div>`,
      );
    }
    if (c.via) {
      rels.push(
        `<div class="rel"><div class="key">via</div><div class="vals"><a data-target="${escapeAttr(c.via)}">${escapeHtml(c.via)}</a></div></div>`,
      );
    }
    return `
      <div class="gloss-head">
        <span class="id">${escapeHtml(id)}</span>
        ${cred}
        ${c.defeasible === "false" ? '<span class="cred">strict</span>' : ""}
      </div>
      ${rels.join("")}
    `;
  }

  function buildTermGloss(ref) {
    if (ref.includes(":")) {
      const [pref, rest] = ref.split(":");
      const url = imports[pref] || "";
      return `<div class="gloss-head"><span class="id">${escapeHtml(ref)}</span><span class="cred">imported</span></div>
        <div class="term-def">Cross-document reference. Prefix <code style="font-family:inherit">${escapeHtml(pref)}</code> bound to ${escapeHtml(url || "(unbound)")}.</div>`;
    }
    const t = terms[ref];
    if (!t)
      return `<div class="gloss-head"><span class="id">${escapeHtml(ref)}</span><span class="cred">undefined</span></div>`;
    return `
      <div class="gloss-head">
        <span class="id">term:${escapeHtml(t.id)}</span>
        ${t.scope === "local" ? '<span class="cred">local</span>' : '<span class="cred">canonical</span>'}
      </div>
      ${t.gloss ? `<div class="term-def">${escapeHtml(t.gloss)}</div>` : ""}
      ${t.aliases.length ? `<div class="term-aliases">aka ${t.aliases.map((a) => "“" + escapeHtml(a) + "”").join(", ")}</div>` : ""}
      ${t.canonical ? `<div class="term-aliases">canonical: ${escapeHtml(t.canonical)}</div>` : ""}
    `;
  }

  function buildInferenceGloss(id) {
    const inf = inferences[id];
    if (!inf) return "";
    return `<div class="gloss-head">
      <span class="id">${escapeHtml(id)}</span>
      ${inf.strength ? `<span class="cred"><span class="cred-dot str-${inf.strength}"></span>${escapeHtml(inf.strength)}</span>` : ""}
    </div>
    <div class="rel supports"><div class="key">from</div><div class="vals">${inf.from.map((r) => `<a data-target="${escapeAttr(r)}">${escapeHtml(r)}</a>`).join("")}</div></div>
    <div class="rel supports"><div class="key">to</div><div class="vals"><a data-target="${escapeAttr(inf.to)}">${escapeHtml(inf.to)}</a></div></div>
    ${inf.scheme ? `<div class="rel"><div class="key">scheme</div><div class="vals">${escapeHtml(inf.scheme)}</div></div>` : ""}
    `;
  }

  function buildEvidenceGloss(a) {
    const type = a.getAttribute("data-type") || "evidence";
    const gloss = a.getAttribute("data-gloss") || "";
    return `<div class="gloss-head"><span class="id">evidence</span><span class="cred">${escapeHtml(type)}</span></div>
      ${gloss ? `<div class="term-def">${escapeHtml(gloss)}</div>` : ""}
      <div class="term-aliases">${escapeHtml(a.getAttribute("href") || "")}</div>`;
  }

  // Build gloss for every annotated element
  const proseEl = $(".prose");
  const allAnn = $$(".ann", proseEl);
  const glossMap = new Map(); // ann element -> gloss-row div
  const claimGlossById = new Map(); // id (or 'term:X') -> gloss-row div
  const groupMap = new Map(); // host block -> gloss-group div
  const seenTerms = new Set();

  function hostBlockFor(el) {
    return (
      el.closest(
        ".claim-wrap, p, li, h1, h2, h3, h4, figure, blockquote, .inference-block, .conflict-block, .evidence-block",
      ) || el.parentElement
    );
  }
  function ensureGroup(host) {
    let g = groupMap.get(host);
    if (g) return g;
    g = document.createElement("div");
    g.className = "gloss-group";
    g.dataset.host = host?.id || "";
    rightGutter.appendChild(g);
    groupMap.set(host, g);
    return g;
  }
  function makeRow(host, kind, id, html) {
    const grp = ensureGroup(host);
    const row = document.createElement("div");
    row.className = "gloss-row";
    row.dataset.kind = kind;
    if (id) row.dataset.id = id;
    row.innerHTML = html;
    grp.appendChild(row);
    return row;
  }

  for (const ann of allAnn) {
    const host = hostBlockFor(ann);
    let row = null;
    if (ann.classList.contains("ann-claim")) {
      const id = ann.dataset.id;
      // dedupe by id: first occurrence makes the row, subsequent map to same
      if (claimGlossById.has(id)) {
        glossMap.set(ann, claimGlossById.get(id));
        continue;
      }
      row = makeRow(host, "claim", id, buildClaimGloss(id));
      claimGlossById.set(id, row);
    } else if (ann.classList.contains("ann-term")) {
      const ref = ann.dataset.ref;
      const key = "term:" + ref;
      if (seenTerms.has(ref)) {
        const r = claimGlossById.get(key);
        if (r) glossMap.set(ann, r);
        continue;
      }
      seenTerms.add(ref);
      row = makeRow(host, "term", null, buildTermGloss(ref));
      row.dataset.ref = ref;
      claimGlossById.set(key, row);
    } else if (ann.classList.contains("ann-evidence")) {
      row = makeRow(host, "evidence", null, buildEvidenceGloss(ann));
    } else if (ann.classList.contains("ann-note-marker")) {
      const idx = ann.dataset.idx;
      const n = notes.find((x) => String(x.idx) === idx);
      const html = `<div class="gloss-head"><span class="id">note ${escapeHtml(idx)}</span>${n?.editorial ? '<span class="cred">editorial</span>' : ""}</div><div class="term-def">${n?.html || ""}</div>`;
      row = makeRow(host, "note", null, html);
    }
    if (row) glossMap.set(ann, row);
  }

  // Inference glosses
  for (const inf of $$(".inference-block", proseEl)) {
    const id = inf.dataset.id;
    const host = hostBlockFor(inf);
    const row = makeRow(host, "inference", id, buildInferenceGloss(id));
    glossMap.set(inf, row);
    claimGlossById.set(id, row);
  }

  // ---------- positioning ----------
  function repositionGutter() {
    const reader = $(".reader");
    const readerRect = reader.getBoundingClientRect();
    // First pass: position each gloss-group at its host block's top; cap height to host
    const placed = [];
    for (const [host, grp] of groupMap.entries()) {
      if (!host) continue;
      const r = host.getBoundingClientRect();
      const y = r.top - readerRect.top + reader.scrollTop;
      grp.style.top = y + "px";
      grp.style.setProperty("--host-h", r.height + "px");

      // Measure natural row heights, then hide rows past the host cap unless expanded.
      const rowEls = [...grp.children].filter((c) => c.classList.contains("gloss-row"));
      for (const row of rowEls) row.style.display = "";
      const cap = r.height;
      const expanded = grp.classList.contains("is-expanded-all");
      // Compute how many rows would be hidden if collapsed, regardless of current state.
      let wouldHide = 0;
      let acc = 0;
      for (const row of rowEls) {
        acc += row.offsetHeight + 1;
        if (acc > cap) wouldHide++;
      }
      if (!expanded) {
        acc = 0;
        for (const row of rowEls) {
          acc += row.offsetHeight + 1;
          if (acc > cap) row.style.display = "none";
        }
      }
      grp.classList.toggle("is-overflow", wouldHide > 0);
      if (wouldHide > 0) grp.setAttribute("data-overflow", String(wouldHide));
      else grp.removeAttribute("data-overflow");

      // Manage the clickable "+N more" / "show less" button
      let moreBtn = grp.querySelector(".gloss-more");
      if (wouldHide > 0) {
        if (!moreBtn) {
          moreBtn = document.createElement("button");
          moreBtn.type = "button";
          moreBtn.className = "gloss-more";
          moreBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const wasOpen = grp.classList.contains("is-expanded-all");
            grp.classList.toggle("is-expanded-all", !wasOpen);
            requestAnimationFrame(repositionGutter);
          });
          grp.appendChild(moreBtn);
        }
        moreBtn.textContent = expanded ? "show less" : "+" + wouldHide + " more";
      } else if (moreBtn) {
        moreBtn.remove();
        grp.classList.remove("is-expanded-all");
      }

      placed.push({ host, grp, top: y, hostH: r.height });
    }

    // Second pass: prevent vertical overlap between gloss-groups.
    // Sort by current top, then push each subsequent group down so it does not
    // overlap the visible extent of the previous one.
    placed.sort((a, b) => a.top - b.top);
    const gap = 8;
    let floor = -Infinity;
    for (const item of placed) {
      const newTop = Math.max(item.top, floor);
      item.grp.style.top = newTop + "px";
      const expanded = item.grp.classList.contains("is-expanded-all");
      const contentH = item.grp.scrollHeight;
      const cap = item.hostH || contentH;
      const visibleH = expanded ? contentH : Math.min(cap, contentH);
      floor = newTop + visibleH + gap;
    }
    // Size svg overlays
    const arrowsSvg = $(".arrows");
    arrowsSvg.style.width = readerRect.width + "px";
    arrowsSvg.style.height = reader.offsetHeight + "px";
    arrowsSvg.setAttribute(
      "viewBox",
      `0 0 ${readerRect.width} ${reader.offsetHeight}`,
    );
  }

  // ---------- narrow-screen detection ----------
  function isGutterVisible() {
    const rg = $(".right-gutter");
    return rg && getComputedStyle(rg).display !== "none";
  }
  function isGraphPanelNarrow() {
    return window.matchMedia("(max-width: 1100px)").matches;
  }

  // ---------- floating popup (used when right gutter is hidden) ----------
  const popup = document.createElement("div");
  popup.className = "gloss-popup";
  document.body.appendChild(popup);
  function showPopup(ann, html) {
    popup.innerHTML = html;
    popup.classList.add("is-visible");
    const r = ann.getBoundingClientRect();
    const w = 320,
      margin = 12;
    let left = Math.min(
      window.innerWidth - w - margin,
      Math.max(margin, r.left),
    );
    let top = r.bottom + 8;
    if (top + popup.offsetHeight > window.innerHeight - margin) {
      top = Math.max(margin, r.top - popup.offsetHeight - 8);
    }
    popup.style.left = left + "px";
    popup.style.top = top + "px";
  }
  function hidePopup() {
    popup.classList.remove("is-visible");
  }

  // ---------- interaction ----------
  function clearActiveStates() {
    $$(".ann.is-active, .ann.is-related").forEach((n) =>
      n.classList.remove("is-active", "is-related"),
    );
    $$(".gloss-row.is-active, .gloss-row.is-related").forEach((n) =>
      n.classList.remove("is-active", "is-related"),
    );
    if (root.dataset.modeAnnotations !== "all") {
      $$(".gloss-row.is-expanded").forEach((n) =>
        n.classList.remove("is-expanded"),
      );
    }
    clearArrows();
    unhighlightGraph();
  }

  function setActive(ann) {
    clearActiveStates();
    if (!ann) return;
    ann.classList.add("is-active");
    const g = glossMap.get(ann);

    // Terms, evidence, and notes get the floating popup (compact tooltip UX).
    // Claims and inferences expand inline in the gutter so the arrows can connect.
    const isCompact =
      ann.classList.contains("ann-term") ||
      ann.classList.contains("ann-evidence") ||
      ann.classList.contains("ann-note-marker");

    if (g && (isCompact || !isGutterVisible())) {
      showPopup(ann, g.innerHTML);
      if (isGutterVisible()) g.classList.add("is-active");
      return;
    }
    if (g) {
      g.classList.add("is-active", "is-expanded");
      // If a hidden row past the host cap was activated, fall back to the popup.
      if (getComputedStyle(g).display === "none") {
        g.classList.remove("is-expanded");
        showPopup(ann, g.innerHTML);
      }
    }
    // Highlight related claims
    if (ann.classList.contains("ann-claim") || ann.dataset.id) {
      const id = ann.dataset.id;
      highlightGraph(id);
      const c = claims[id] || inferences[id];
      if (c) {
        const related = [
          ...(c.supports || []),
          ...(c.attacks || []),
          ...(c.restsOn || []),
          ...(c.from || []),
          c.to,
          c.via,
        ].filter(Boolean);
        for (const rid of related) {
          if (rid.includes(":")) continue;
          const rt =
            document.getElementById("claim-" + rid) ||
            document.getElementById("inf-" + rid);
          if (rt) rt.classList.add("is-related");
          const rg = claimGlossById.get(rid);
          if (rg) rg.classList.add("is-related", "is-expanded");
        }
        drawArrowsFor(ann, c);
      }
    }
  }

  function attachHovers() {
    for (const ann of allAnn) {
      ann.addEventListener("mouseenter", () => setActive(ann));
      ann.addEventListener("mouseleave", () => {
        hidePopup();
        if (root.dataset.modeAnnotations !== "all") clearActiveStates();
      });
    }
    for (const inf of $$(".inference-block", proseEl)) {
      inf.addEventListener("mouseenter", () => setActive(inf));
      inf.addEventListener("mouseleave", () => {
        hidePopup();
        if (root.dataset.modeAnnotations !== "all") clearActiveStates();
      });
    }
    // gloss links scroll to target
    rightGutter.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-target]");
      if (!a) return;
      const t = a.dataset.target;
      if (!t || t.includes(":")) return;
      e.preventDefault();
      const tgt =
        document.getElementById("claim-" + t) ||
        document.getElementById("inf-" + t);
      if (tgt) {
        tgt.scrollIntoView({ block: "center", behavior: "smooth" });
        tgt.classList.add("is-active");
        setTimeout(() => tgt.classList.remove("is-active"), 1400);
      }
    });
  }

  // ---------- arrows ----------
  const arrowsSvg = () => $(".arrows");
  function clearArrows() {
    const svg = arrowsSvg();
    [...svg.querySelectorAll("path.edge")].forEach((p) => p.remove());
  }

  function drawArrowsFor(sourceEl, rec) {
    clearArrows();
    const svg = arrowsSvg();
    const reader = $(".reader");
    const readerRect = reader.getBoundingClientRect();
    const sourceGloss = glossMap.get(sourceEl);
    if (!sourceGloss) return;
    if (!isGutterVisible()) return; // no arrows when gutter is hidden

    function makeArrow(targetId, kind) {
      if (!targetId || targetId.includes(":")) return;
      const tg = claimGlossById.get(targetId);
      if (!tg) return;
      const a = sourceGloss.getBoundingClientRect();
      const b = tg.getBoundingClientRect();
      const ax = a.right - readerRect.left;
      const ay = a.top + a.height / 2 - readerRect.top;
      const bx = b.right - readerRect.left;
      const by = b.top + b.height / 2 - readerRect.top;
      const channel = Math.min(readerRect.width - 6, Math.max(ax, bx) + 18);
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      // orthogonal: source-right → channel → target Y → back to target gloss's right edge
      const d = `M ${ax} ${ay} L ${channel} ${ay} L ${channel} ${by} L ${bx - 2} ${by}`;
      p.setAttribute("d", d);
      p.setAttribute("class", "edge " + kind + " is-active");
      p.setAttribute(
        "marker-end",
        `url(#ah-${kind === "rests-on" ? "rests" : kind === "attacks" ? "attacks" : "supports"})`,
      );
      p.style.opacity = "0.85";
      svg.appendChild(p);
    }

    for (const s of rec.supports || []) makeArrow(s, "supports");
    for (const s of rec.attacks || []) makeArrow(s, "attacks");
    for (const s of rec.restsOn || []) makeArrow(s, "rests-on");
    for (const s of rec.from || []) makeArrow(s, "supports");
    if (rec.to) makeArrow(rec.to, "supports");
  }

  // ---------- toolbar ----------
  function setupToolbar() {
    for (const btn of $$(".toolbar .btn")) {
      btn.addEventListener("click", () => {
        const key = btn.dataset.toggle;
        const cur = root.dataset["mode" + key[0].toUpperCase() + key.slice(1)];
        const next =
          key === "annotations"
            ? cur === "all"
              ? "hover"
              : "all"
            : cur === "on"
              ? "off"
              : "on";
        root.dataset["mode" + key[0].toUpperCase() + key.slice(1)] = next;
        btn.setAttribute(
          "aria-pressed",
          String(next === "on" || next === "all"),
        );
        repositionGutter();
        if (key === "graph") layoutGraph();
      });
    }
  }

  // ---------- graph (left gutter) ----------
  function layoutGraph() {
    const panel = $(".graph-panel");
    const svg = $(".graph-svg");
    if (root.dataset.modeGraph !== "on") {
      svg.innerHTML = "";
      panel.classList.remove("narrow");
      return;
    }
    const narrow = isGraphPanelNarrow();
    panel.classList.toggle("narrow", narrow);
    const reader = $(".reader");
    const readerRect = reader.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    svg.innerHTML = "";
    svg.setAttribute("width", panelRect.width);
    svg.setAttribute("height", reader.offsetHeight);
    svg.setAttribute(
      "viewBox",
      `0 0 ${panelRect.width} ${reader.offsetHeight}`,
    );

    // Defs (arrow heads)
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
      <marker id="g-ah-supports" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#4a6a3e"/></marker>
      <marker id="g-ah-attacks"  viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#8a3434"/></marker>
      <marker id="g-ah-rests"    viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#6a614a"/></marker>
    `;
    svg.appendChild(defs);

    // Find first text occurrence of each claim/inference
    const positions = new Map();
    if (narrow) {
      // self-contained vertical layout, ignore text alignment
      let y = 24;
      const allIds = [
        ...new Set([
          ...$$(".ann-claim", proseEl).map((a) => a.dataset.id),
          ...$$(".inference-block", proseEl).map((a) => a.dataset.id),
        ]),
      ];
      for (const id of allIds) {
        positions.set(id, y);
        y += 34;
      }
      svg.setAttribute("width", panelRect.width - 32);
      svg.setAttribute("height", y + 16);
      svg.setAttribute("viewBox", `0 0 ${panelRect.width - 32} ${y + 16}`);
    } else {
      svg.setAttribute("width", panelRect.width);
      svg.setAttribute("height", reader.offsetHeight);
      svg.setAttribute(
        "viewBox",
        `0 0 ${panelRect.width} ${reader.offsetHeight}`,
      );
      for (const ann of $$(".ann-claim", proseEl)) {
        const id = ann.dataset.id;
        if (positions.has(id)) continue;
        const r = ann.getBoundingClientRect();
        positions.set(
          id,
          r.top - readerRect.top + reader.scrollTop + r.height / 2,
        );
      }
      for (const inf of $$(".inference-block", proseEl)) {
        const id = inf.dataset.id;
        const r = inf.getBoundingClientRect();
        positions.set(
          id,
          r.top - readerRect.top + reader.scrollTop + r.height / 2,
        );
      }
    }

    // Column layout: right-aligned within left gutter; lay nodes near right edge
    const colX = narrow ? 60 : panelRect.width - 60;
    const nodeRadius = 22;

    // Avoid Y overlap: greedy
    const sorted = [...positions.entries()].sort((a, b) => a[1] - b[1]);
    const minGap = narrow ? 32 : 28;
    let cursor = 0;
    const finalPos = new Map();
    for (const [id, y] of sorted) {
      const yy = Math.max(y, cursor);
      finalPos.set(id, yy);
      cursor = yy + minGap;
    }

    // Edges first (under nodes)
    function pathBetween(aId, bId, kind) {
      if (!finalPos.has(aId) || !finalPos.has(bId)) return null;
      const ay = finalPos.get(aId);
      const by = finalPos.get(bId);
      const minX = colX - nodeRadius - 2;
      // bezier curve bounded to ~36px arc width
      const dy = Math.abs(by - ay);
      const arc = Math.min(36, Math.max(14, dy * 0.1));
      const ctrl = Math.max(6, minX - arc);
      const d = `M ${minX} ${ay} C ${ctrl} ${ay}, ${ctrl} ${by}, ${minX} ${by}`;
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      p.setAttribute("class", "edge " + kind);
      p.setAttribute("data-from", aId);
      p.setAttribute("data-to", bId);
      p.setAttribute(
        "marker-end",
        `url(#g-ah-${kind === "rests-on" ? "rests" : kind === "attacks" ? "attacks" : "supports"})`,
      );
      return p;
    }

    for (const [id, c] of Object.entries(claims)) {
      for (const s of c.supports) {
        const p = pathBetween(id, s, "supports");
        if (p) svg.appendChild(p);
      }
      for (const s of c.attacks) {
        const p = pathBetween(id, s, "attacks");
        if (p) svg.appendChild(p);
      }
      for (const s of c.restsOn) {
        const p = pathBetween(id, s, "rests-on");
        if (p) svg.appendChild(p);
      }
    }
    for (const inf of Object.values(inferences)) {
      for (const f of inf.from) {
        const p = pathBetween(inf.id, f, "supports");
        if (p) svg.appendChild(p);
      }
      const p = pathBetween(inf.id, inf.to, "supports");
      if (p) svg.appendChild(p);
    }

    // Nodes
    for (const [id, y] of finalPos.entries()) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "node");
      g.setAttribute("data-id", id);
      const isInf = inferences[id];
      const w = Math.max(36, id.length * 6.5 + 14);
      const rect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
      );
      rect.setAttribute("class", "node-bg");
      rect.setAttribute("x", colX - w / 2);
      rect.setAttribute("y", y - 11);
      rect.setAttribute("width", w);
      rect.setAttribute("height", 22);
      rect.setAttribute("rx", 11);
      if (isInf) rect.setAttribute("stroke-dasharray", "3 2");
      g.appendChild(rect);
      const txt = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      txt.setAttribute("class", "node-label");
      txt.setAttribute("x", colX);
      txt.setAttribute("y", y);
      txt.textContent = id;
      g.appendChild(txt);
      g.addEventListener("mouseenter", () => highlightGraph(id));
      g.addEventListener("mouseleave", () => unhighlightGraph());
      g.addEventListener("click", () => {
        const tgt =
          document.getElementById("claim-" + id) ||
          document.getElementById("inf-" + id);
        if (tgt) tgt.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      svg.appendChild(g);
    }
  }

  function highlightGraph(id) {
    const svg = $(".graph-svg");
    if (!svg || root.dataset.modeGraph !== "on") return;
    $$("g.node", svg).forEach((n) => n.classList.add("is-dim"));
    $$("path.edge", svg).forEach((e) => e.classList.add("is-dim"));
    const here = svg.querySelector(`g.node[data-id="${CSS.escape(id)}"]`);
    if (here) {
      here.classList.remove("is-dim");
      here.classList.add("is-active");
    }
    const c = claims[id] || inferences[id];
    if (!c) return;
    const rel = new Set(
      [
        ...(c.supports || []),
        ...(c.attacks || []),
        ...(c.restsOn || []),
        ...(c.from || []),
        c.to,
        c.via,
      ].filter(Boolean),
    );
    for (const rid of rel) {
      const rn = svg.querySelector(`g.node[data-id="${CSS.escape(rid)}"]`);
      if (rn) {
        rn.classList.remove("is-dim");
        rn.classList.add("is-related");
      }
      const e1 = svg.querySelector(
        `path.edge[data-from="${CSS.escape(id)}"][data-to="${CSS.escape(rid)}"]`,
      );
      const e2 = svg.querySelector(
        `path.edge[data-from="${CSS.escape(rid)}"][data-to="${CSS.escape(id)}"]`,
      );
      if (e1) {
        e1.classList.remove("is-dim");
        e1.classList.add("is-active");
      }
      if (e2) {
        e2.classList.remove("is-dim");
        e2.classList.add("is-active");
      }
    }
  }
  function unhighlightGraph() {
    const svg = $(".graph-svg");
    $$("g.node", svg).forEach((n) => n.classList.remove("is-dim", "is-active"));
    $$("path.edge", svg).forEach((e) => e.classList.remove("is-dim"));
  }

  // ---------- init ----------
  attachHovers();
  setupToolbar();
  requestAnimationFrame(() => {
    repositionGutter();
    layoutGraph();
  });
  window.addEventListener("resize", () => {
    repositionGutter();
    layoutGraph();
  });
  // recompute after fonts load
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      repositionGutter();
      layoutGraph();
    });
  }
})();
