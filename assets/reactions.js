/* Emoji reactions for the astrolog public gallery.
 *
 * Shared by target pages (one bar) and the feed (one bar per card), so it is a
 * standalone asset rather than inline script. Needs window.REACTIONS_API set
 * before it loads; without it nothing renders and the page is unchanged.
 *
 * Markup it drives:
 *   <div class="rx" data-target="M74_Phantom_Galaxy" hidden></div>
 *
 * Optionally, a detached home for the + button -- the feed puts it in the card
 * header rather than with the pills:
 *   <span class="rx-plus" data-target="M74_Phantom_Galaxy" hidden></span>
 *
 * The server owns the rules -- one pick per person per target, tapping your own
 * pick withdraws it. This file only sends taps and paints what comes back.
 *
 * READING IS ANONYMOUS. Google is not loaded, contacted or mentioned until
 * somebody actually presses an emoji; browsing the gallery triggers nothing.
 * A 401 from the reaction endpoint is the cue to sign in, and the session it
 * returns lasts 90 days, so the prompt appears once rather than per tap.
 */
(function () {
  const API = window.REACTIONS_API;
  if (!API) return;

  /* Picker palette. First row is what people actually reach for on astrophotos;
     the rest is a general set so the picker is useful without shipping a
     3,000-emoji library. Any emoji the server accepts still works — these are
     just the ones offered. */
  /* Arrays, not strings. Splitting a string with [...s] splits by code point,
     which tears any emoji carrying a variation selector in half: "❤️" becomes
     "❤" plus a lone U+FE0F that renders as an invisible button. Listing each
     glyph explicitly avoids needing grapheme segmentation at all. */
  const PALETTE = [
    ["Reactions", ["⭐","🔭","🌌","❤️","🤯","😍","🔥","👏","🙌","💫",
                   "✨","🌠","🪐","🌙","☄️","🛰️","👀","😮","🥹","🫡"]],
    ["Smileys",   ["😀","😂","🥰","😎","🤩","😭","😱","🤔","🙃","😴",
                   "🤓","🥳","😅","😇","🫠"]],
    ["Gestures",  ["👍","👎","🤙","✌️","🤌","👌","🤝","💪","🫶","🙏"]],
    ["Nature",    ["🌞","🌝","🌚","🌈","⛈️","❄️","🌊","🏔️","🌲","🍂","🦉","🐺"]],
    ["Objects",   ["📷","📸","🖼️","🎯","🏆","🥇","💎","🔬","🧲","⚙️"]],
  ];

  const $ = (sel, root) => (root || document).querySelector(sel);

  /* ---------- picker, one shared instance ---------- */
  let pop = null, popFor = null;

  function buildPicker() {
    pop = document.createElement("div");
    pop.className = "rx-pop";
    pop.hidden = true;
    pop.innerHTML = PALETTE.map(([name, glyphs]) =>
      '<div class="rx-grp"><h4>' + name + "</h4><div>" +
      glyphs.map(c =>
        '<button type="button" class="rx-e" title="' + c + '" data-e="' + c + '">' +
        c + "</button>"
      ).join("") + "</div></div>"
    ).join("");
    document.body.appendChild(pop);

    pop.addEventListener("click", ev => {
      const b = ev.target.closest(".rx-e");
      if (!b || !popFor) return;
      const bar = popFor;
      closePicker();
      send(bar, b.dataset.e);
    });
    document.addEventListener("click", ev => {
      if (!pop || pop.hidden) return;
      if (ev.target.closest(".rx-pop") || ev.target.closest(".rx-add")) return;
      closePicker();
    });
    document.addEventListener("keydown", ev => {
      if (ev.key === "Escape") closePicker();
    });
    window.addEventListener("resize", closePicker);
    // Capture phase catches scrolling in any ancestor, which is what we want --
    // the popover is positioned against the page and would drift. But it also
    // fires when scrolling INSIDE the popover, which closed it the moment you
    // used the wheel on it. Ignore events originating within.
    window.addEventListener("scroll", ev => {
      if (pop && !pop.hidden && ev.target instanceof Node && pop.contains(ev.target)) return;
      closePicker();
    }, true);
  }

  function closePicker() {
    if (pop) { pop.hidden = true; }
    if (popFor) {
      // The + may sit outside the bar (feed cards put it in the header), so
      // look in both places before giving up on resetting the aria state.
      const host = plusHost(popFor);
      const b = $(".rx-add", popFor) || (host && $(".rx-add", host));
      if (b) b.setAttribute("aria-expanded", "false");
    }
    popFor = null;
  }

  function openPicker(bar, anchor) {
    if (!pop) buildPicker();
    if (popFor === bar) { closePicker(); return; }
    popFor = bar;
    pop.hidden = false;
    anchor.setAttribute("aria-expanded", "true");
    // Position under the + button, nudged back on screen if it would overflow.
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth || 280;
    let left = r.left + window.scrollX;
    left = Math.min(left, window.scrollX + document.documentElement.clientWidth - w - 12);
    pop.style.left = Math.max(window.scrollX + 8, left) + "px";
    pop.style.top = (r.bottom + window.scrollY + 6) + "px";
  }

  /* ---------- one bar ---------- */
  /* Outlined smiley-with-a-plus: the convention for "add a reaction" (Slack,
     GitHub, Linear). A heart would imply a single like; this opens a picker.
     Inline SVG rather than an emoji so it inherits colour and stays grey until
     hovered -- an emoji glyph cannot be greyed out. */
  const ADD_ICON =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
      '<path d="M20.9 11.2a9 9 0 1 1-8.1-8.1" fill="none" stroke="currentColor" ' +
        'stroke-width="1.7" stroke-linecap="round"/>' +
      '<circle cx="9" cy="10" r="1.15" fill="currentColor"/>' +
      '<circle cx="15" cy="10" r="1.15" fill="currentColor"/>' +
      '<path d="M8.4 14.3a4.4 4.4 0 0 0 7.2 0" fill="none" stroke="currentColor" ' +
        'stroke-width="1.7" stroke-linecap="round"/>' +
      '<path d="M19.4 2.6v4.6M17.1 4.9h4.6" fill="none" stroke="currentColor" ' +
        'stroke-width="1.7" stroke-linecap="round"/>' +
    '</svg>';

  const ADD_HTML =
    '<button type="button" class="rx-add" aria-label="Add a reaction" ' +
    'title="Add a reaction" aria-expanded="false" aria-haspopup="true">' +
    ADD_ICON + '</button>';

  /* The + lives in the card header on the feed, and inline with the pills on a
     target page. If a .rx-plus host exists for this target it gets the button;
     otherwise the button is appended to the pill row. */
  function plusHost(bar) {
    const id = bar.dataset.target;
    return document.querySelector('.rx-plus[data-target="' + CSS.escape(id) + '"]');
  }

  function paint(bar, d) {
    const mine = d.mine || null;
    // Most-used first, then alphabetical, so the row is stable between reloads.
    const entries = Object.entries(d.counts || {})
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));

    const pills = entries.map(([e, n]) =>
      '<button type="button" class="rx-b' + (e === mine ? " mine" : "") +
      '" data-e="' + e + '" aria-pressed="' + (e === mine) + '">' +
      e + "<b>" + n + "</b></button>"
    ).join("");

    const host = plusHost(bar);
    if (host) {
      bar.innerHTML = pills;
      if (!host.firstChild) host.innerHTML = ADD_HTML;   // render once, keeps focus
      host.hidden = false;
      // An empty pill row would leave a stray gap under the stats.
      bar.hidden = entries.length === 0;
    } else {
      bar.innerHTML = pills + ADD_HTML;
      bar.hidden = false;
    }
  }

  function send(bar, emoji) {
    const id = bar.dataset.target;
    const host = plusHost(bar);
    bar.classList.add("busy");
    if (host) host.classList.add("busy");
    const post = tok => fetch(API + "/r/" + encodeURIComponent(id), {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" },
                             tok ? { Authorization: "Bearer " + tok } : {}),
      body: JSON.stringify({ emoji: emoji }),
    });

    post(session())
      .then(r => {
        // 401 is the only moment a visitor is ever asked to authenticate.
        if (r.status === 401) {
          localStorage.removeItem(TOKEN_KEY);          // expired or rejected
          return ensureSignedIn().then(post);
        }
        return r;
      })
      .then(r => (r && r.ok) ? r.json() : null)
      .then(d => { if (d && d.counts) paint(bar, d); })
      .catch(err => {
        // Swallowing this silently made a CORS preflight failure look like
        // "the button does nothing". Say so in the console at least.
        if (err && err.message !== "cancelled") console.warn("reaction failed:", err);
      })
      .finally(() => {
        bar.classList.remove("busy");
        if (host) host.classList.remove("busy");
      });
  }

  function wire(bar) {
    const onClick = ev => {
      const add = ev.target.closest(".rx-add");
      if (add) { ev.stopPropagation(); openPicker(bar, add); return; }
      const b = ev.target.closest(".rx-b");
      if (b) send(bar, b.dataset.e);
    };
    bar.addEventListener("click", onClick);
    const host = plusHost(bar);
    if (host) host.addEventListener("click", onClick);
  }

  /* ---------- sign-in, on demand only ---------- */
  const TOKEN_KEY = "rx_session";
  const ADMIN_KEY_STORE = "rx_admin";

  /* Admin mode: visit any page once with ?admin=<ADMIN_KEY> and the key is kept
     in this browser, then stripped from the address bar so it cannot be copied
     out of a shared link or left in history. Delete controls then appear on
     every comment. The server re-checks the key on each request; this only
     decides what the page offers. */
  function adminKey() {
    try { return localStorage.getItem(ADMIN_KEY_STORE) || ""; } catch (e) { return ""; }
  }
  (function captureAdminKey() {
    try {
      const u = new URL(window.location.href);
      const k = u.searchParams.get("admin");
      if (!k) return;
      localStorage.setItem(ADMIN_KEY_STORE, k);
      u.searchParams.delete("admin");
      history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
    } catch (e) {}
  })();
  function adminHeader() {
    const k = adminKey();
    return k ? { "X-Admin-Key": k } : {};
  }
  const CLIENT_ID = window.GOOGLE_CLIENT_ID || "";

  function session() {
    try {
      const raw = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
      if (raw && raw.token && raw.exp * 1000 > Date.now()) return raw.token;
    } catch (e) {}
    return null;
  }
  function setSession(d) {
    try { localStorage.setItem(TOKEN_KEY, JSON.stringify(d)); } catch (e) {}
  }

  let gsiLoading = null;
  function loadGsi() {
    // Injected on first use, never on page load -- a reader who only looks at
    // photographs never fetches anything from Google.
    if (gsiLoading) return gsiLoading;
    gsiLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("google sign-in failed to load"));
      document.head.appendChild(s);
    });
    return gsiLoading;
  }

  /** Resolves to a session token, prompting for Google sign-in if needed. */
  function ensureSignedIn() {
    const have = session();
    if (have) return Promise.resolve(have);
    if (!CLIENT_ID) return Promise.reject(new Error("no client id configured"));

    return loadGsi().then(() => new Promise((resolve, reject) => {
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: resp => {
          if (!resp || !resp.credential) return reject(new Error("no credential"));
          fetch(API + "/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: resp.credential }),
          })
            .then(r => r.ok ? r.json() : Promise.reject(new Error("auth rejected")))
            .then(d => { setSession(d); closeSignInModal(); resolve(d.token); })
            .catch(reject);
        },
      });
      // A rendered button in a modal, not One Tap. One Tap is suppressed by
      // third-party cookie settings and by a previous dismissal, and Google's
      // migration to FedCM deprecates the prompt() notifications that would
      // tell us it had been. A button always appears and always works.
      showSignInModal(reject);
    }));
  }

  function showSignInModal(onCancel) {
    if (document.querySelector(".rx-auth")) return;
    const wrap = document.createElement("div");
    wrap.className = "rx-auth";
    wrap.innerHTML =
      '<div class="rx-auth-box" role="dialog" aria-modal="true" aria-label="Sign in to react">' +
        "<h3>Sign in to react</h3>" +
        "<p>Reactions use a Google sign-in so each person counts once. " +
        "Browsing needs no account.</p>" +
        '<div class="rx-auth-btn"></div>' +
        '<button type="button" class="rx-auth-x">Not now</button>' +
      "</div>";
    document.body.appendChild(wrap);
    google.accounts.id.renderButton(wrap.querySelector(".rx-auth-btn"),
      { theme: "outline", size: "large", text: "signin_with", shape: "pill" });
    const close = () => { wrap.remove(); if (onCancel) onCancel(new Error("cancelled")); };
    wrap.querySelector(".rx-auth-x").addEventListener("click", close);
    wrap.addEventListener("click", ev => { if (ev.target === wrap) close(); });
    document.addEventListener("keydown", function esc(ev) {
      if (ev.key === "Escape") { document.removeEventListener("keydown", esc); close(); }
    });
  }

  function closeSignInModal() {
    const w = document.querySelector(".rx-auth");
    if (w) w.remove();
  }

  /* ---------- view counter ----------
     Detail pages only. POSTing is what counts the view; the server decides
     whether it is a new one (once per person per day, crawlers ignored), so
     reloading does not inflate it. */
  function countView() {
    const el = document.querySelector(".rx-views[data-target]");
    if (!el) return;
    fetch(API + "/v/" + encodeURIComponent(el.dataset.target), { method: "POST" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || typeof d.views !== "number" || d.views < 1) return;
        el.textContent = d.views.toLocaleString() +
                         (d.views === 1 ? " view" : " views");
        el.hidden = false;
      })
      .catch(() => {});                    // endpoint down: line stays hidden
  }

  /* ---------- comments ----------
     Only on target pages. Reading is anonymous; posting hits the same 401 ->
     sign-in path as reactions. */

  function fmtWhen(iso) {
    const t = Date.parse(iso);
    if (!t) return "";
    const mins = Math.round((Date.now() - t) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    if (mins < 1440) return Math.round(mins / 60) + "h ago";
    if (mins < 10080) return Math.round(mins / 1440) + "d ago";
    return new Date(t).toLocaleDateString(undefined,
      { year: "numeric", month: "short", day: "numeric" });
  }

  function renderComments(box, list) {
    const thread = box.querySelector(".cm-list");
    thread.textContent = "";
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "cm-empty";
      p.textContent = "No comments yet.";
      thread.appendChild(p);
    }
    for (const c of list) {
      const item = document.createElement("article");
      item.className = "cm";

      const who = document.createElement("span");
      who.className = "cm-who";
      who.textContent = c.initials || "?";

      const when = document.createElement("time");
      when.className = "cm-when";
      when.dateTime = c.at || "";
      when.textContent = fmtWhen(c.at);

      const body = document.createElement("p");
      body.className = "cm-text";
      // textContent, never innerHTML. This is the only place on the site where
      // arbitrary visitor text reaches the DOM; innerHTML here would be an XSS.
      body.textContent = c.text;

      const head = document.createElement("div");
      head.className = "cm-head";
      head.append(who, when);

      if (c.can_delete || c.mine) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "cm-del" + (c.mine ? "" : " as-admin");
        // Inline SVG so it inherits colour and can go red on hover; an emoji
        // glyph cannot. Title distinguishes your own from an admin deletion.
        del.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
            '<path d="M4 7h16M10 4h4M9 7v12M12 7v12M15 7v12M6 7l1 13h10l1-13" ' +
              'fill="none" stroke="currentColor" stroke-width="1.7" ' +
              'stroke-linecap="round" stroke-linejoin="round"/>' +
          "</svg>";
        const what = c.mine ? "Delete your comment" : "Delete this comment (admin)";
        del.setAttribute("aria-label", what);
        del.title = what;
        del.addEventListener("click", () => removeComment(box, c.id));
        head.appendChild(del);
      }

      item.append(head, body);
      thread.appendChild(item);
    }
    const n = box.querySelector(".cm-count");
    if (n) n.textContent = list.length ? "(" + list.length + ")" : "";
  }

  function loadComments(box) {
    fetch(API + "/c/" + encodeURIComponent(box.dataset.target), {
      headers: Object.assign({},
        session() ? { Authorization: "Bearer " + session() } : {}, adminHeader()),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { renderComments(box, d.comments || []); box.hidden = false; } })
      .catch(() => {});
  }

  function removeComment(box, id) {
    if (!confirm("Delete this comment?")) return;
    fetch(API + "/c/" + encodeURIComponent(box.dataset.target) + "/" + id + "/delete", {
      method: "POST",
      headers: Object.assign({},
        session() ? { Authorization: "Bearer " + session() } : {}, adminHeader()),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) renderComments(box, d.comments || []); })
      .catch(err => console.warn("delete failed:", err));
  }

  function postComment(box) {
    const ta = box.querySelector(".cm-input");
    const text = ta.value.trim();
    if (!text) return;
    const btn = box.querySelector(".cm-send");
    btn.disabled = true;

    const send = tok => fetch(API + "/c/" + encodeURIComponent(box.dataset.target), {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" },
                             tok ? { Authorization: "Bearer " + tok } : {}),
      body: JSON.stringify({ text: text }),
    });

    send(session())
      .then(r => {
        if (r.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          return ensureSignedIn().then(send);
        }
        return r;
      })
      .then(r => {
        if (r && r.status === 429) { alert("That is enough for one day."); return null; }
        return (r && r.ok) ? r.json() : null;
      })
      .then(d => { if (d) { ta.value = ""; renderComments(box, d.comments || []); } })
      .catch(err => {
        if (err && err.message !== "cancelled") console.warn("comment failed:", err);
      })
      .finally(() => { btn.disabled = false; });
  }

  /* ---------- feed cards ----------
     A compact strip per card: up to two comments, a show more/less toggle when
     there are more, and a stub that becomes a real input on click. The stub
     matters -- 144 live textareas on the feed would be a lot of DOM for
     something almost nobody uses on any given card. */

  function cardComment(box, c) {
    const item = document.createElement("div");
    item.className = "fc-c";

    const who = document.createElement("span");
    who.className = "cm-who";
    who.textContent = c.initials || "?";

    const text = document.createElement("span");
    text.className = "fc-t";
    text.textContent = c.text;            // never innerHTML

    const when = document.createElement("time");
    when.className = "cm-when";
    when.dateTime = c.at || "";
    when.textContent = fmtWhen(c.at);

    item.append(who, text, when);
    if (c.can_delete || c.mine) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "cm-del" + (c.mine ? "" : " as-admin");
      del.innerHTML =
        '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">' +
          '<path d="M4 7h16M10 4h4M9 7v12M12 7v12M15 7v12M6 7l1 13h10l1-13" ' +
            'fill="none" stroke="currentColor" stroke-width="1.7" ' +
            'stroke-linecap="round" stroke-linejoin="round"/></svg>';
      const what = c.mine ? "Delete your comment" : "Delete this comment (admin)";
      del.setAttribute("aria-label", what);
      del.title = what;
      del.addEventListener("click", () => {
        if (!confirm("Delete this comment?")) return;
        fetch(API + "/c/" + encodeURIComponent(box.dataset.target) + "/" + c.id + "/delete", {
          method: "POST",
          headers: Object.assign({},
            session() ? { Authorization: "Bearer " + session() } : {}, adminHeader()),
        })
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) renderCard(box, { total: d.comments.length, recent: d.comments }, true); })
          .catch(err => console.warn("delete failed:", err));
      });
      item.appendChild(del);
    }
    return item;
  }

  function renderCard(box, data, expanded) {
    const list = box.querySelector(".fc-list");
    const shown = expanded ? (data.recent || []) : (data.recent || []).slice(-FEED_PREVIEW);
    list.textContent = "";
    shown.forEach(c => list.appendChild(cardComment(box, c)));

    let more = box.querySelector(".fc-more");
    const hidden = (data.total || 0) - shown.length;
    if (hidden > 0 || expanded) {
      if (!more) {
        more = document.createElement("button");
        more.type = "button";
        more.className = "fc-more";
        list.after(more);
      }
      more.textContent = expanded
        ? "Show less"
        : "Show " + hidden + " more comment" + (hidden === 1 ? "" : "s");
      more.onclick = () => {
        if (expanded) { renderCard(box, data, false); return; }
        // Only fetch the full thread when someone actually asks for it.
        fetch(API + "/c/" + encodeURIComponent(box.dataset.target), {
          headers: Object.assign({},
            session() ? { Authorization: "Bearer " + session() } : {}, adminHeader()),
        })
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (d) renderCard(box, { total: d.comments.length, recent: d.comments }, true);
          })
          .catch(() => {});
      };
    } else if (more) {
      more.remove();
    }
    box.hidden = false;
  }

  const FEED_PREVIEW = 2;

  function openCardInput(box) {
    if (box.querySelector(".fc-form")) return;
    const stub = box.querySelector(".fc-stub");
    const form = document.createElement("div");
    form.className = "fc-form";
    const ta = document.createElement("textarea");
    ta.className = "cm-input";
    ta.rows = 2;
    ta.maxLength = 2000;
    ta.placeholder = "Say something about this one…";
    ta.setAttribute("aria-label", "Write a comment");
    const row = document.createElement("div");
    row.className = "cm-actions";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cm-send";
    btn.textContent = "Post";
    row.appendChild(btn);
    form.append(ta, row);
    stub.replaceWith(form);
    ta.focus();

    const post = () => {
      const text = ta.value.trim();
      if (!text) return;
      btn.disabled = true;
      const send = tok => fetch(API + "/c/" + encodeURIComponent(box.dataset.target), {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" },
                               tok ? { Authorization: "Bearer " + tok } : {}),
        body: JSON.stringify({ text: text }),
      });
      send(session())
        .then(r => {
          if (r.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            return ensureSignedIn().then(send);
          }
          return r;
        })
        .then(r => {
          if (r && r.status === 429) { alert("That is enough for one day."); return null; }
          return (r && r.ok) ? r.json() : null;
        })
        .then(d => {
          if (!d) return;
          ta.value = "";
          renderCard(box, { total: d.comments.length, recent: d.comments }, true);
          form.replaceWith(makeStub(box));
        })
        .catch(err => {
          if (err && err.message !== "cancelled") console.warn("comment failed:", err);
        })
        .finally(() => { btn.disabled = false; });
    };
    btn.addEventListener("click", post);
    ta.addEventListener("keydown", ev => {
      if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) post();
      if (ev.key === "Escape") form.replaceWith(makeStub(box));
    });
  }

  function makeStub(box) {
    const stub = document.createElement("button");
    stub.type = "button";
    stub.className = "fc-stub";
    stub.textContent = "Add a comment…";
    stub.addEventListener("click", () => openCardInput(box));
    return stub;
  }

  function wireFeedComments() {
    const boxes = [...document.querySelectorAll(".fc-box[data-target]")];
    if (!boxes.length) return;
    boxes.forEach(b => b.appendChild(makeStub(b)));

    const ids = [...new Set(boxes.map(b => b.dataset.target))];
    const chunks = [];
    for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
    Promise.all(chunks.map(c =>
      fetch(API + "/cs?ids=" + c.map(encodeURIComponent).join(","), {
        headers: Object.assign({},
          session() ? { Authorization: "Bearer " + session() } : {}, adminHeader()),
      }).then(r => r.ok ? r.json() : {}).catch(() => ({}))
    )).then(results => {
      const all = Object.assign({}, ...results);
      boxes.forEach(b => renderCard(b, all[b.dataset.target] || { total: 0, recent: [] }, false));
    });
  }

  function wireComments() {
    const box = document.querySelector(".cm-box[data-target]");
    if (!box) return;
    box.querySelector(".cm-send").addEventListener("click", () => postComment(box));
    box.querySelector(".cm-input").addEventListener("keydown", ev => {
      // Enter alone is a newline; this is prose, not a chat line.
      if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) postComment(box);
    });
    loadComments(box);
  }

  /* ---------- boot: one batched request for every bar on the page ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    countView();
    wireComments();
    wireFeedComments();
    const bars = [...document.querySelectorAll(".rx[data-target]")];
    if (!bars.length) return;                 // countView() already ran above
    bars.forEach(wire);

    const ids = [...new Set(bars.map(b => b.dataset.target))];
    // The feed can hold dozens of cards; one request for all of them rather
    // than one per card.
    const chunks = [];
    for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

    Promise.all(chunks.map(c =>
      fetch(API + "/rs?ids=" + c.map(encodeURIComponent).join(","),
            session() ? { headers: { Authorization: "Bearer " + session() } } : {})
        .then(r => r.ok ? r.json() : {})
        .catch(() => ({}))
    )).then(results => {
      const all = Object.assign({}, ...results);
      bars.forEach(bar => {
        const d = all[bar.dataset.target];
        // A bar with no reactions yet still shows, so there is a + to press.
        paint(bar, d || { counts: {}, mine: null });
      });
    });
  });
})();
