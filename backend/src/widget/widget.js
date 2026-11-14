/*! Elch website chat widget — embed:
 *  <script src="https://API_HOST/widget.js" data-key="WIDGET_KEY" async></script>
 */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script || window.__elchWidget) return;
  var KEY = script.getAttribute("data-key");
  if (!KEY) return;
  window.__elchWidget = true;
  var API = new URL(script.src).origin + "/api/widget/" + encodeURIComponent(KEY);
  var STORE = "elch_" + KEY;
  var EN = /^en/i.test(document.documentElement.lang || "");
  var T = EN
    ? { ph: "Type a message…", send: "Send", offline: "Chat is offline right now.", err: "Couldn't send. Try again.", by: "AI assistant" }
    : { ph: "Мессеж бичих…", send: "Илгээх", offline: "Одоогоор чат идэвхгүй байна.", err: "Илгээж чадсангүй. Дахин оролдоно уу.", by: "AI туслах" };

  function store(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(STORE) || "{}")[k];
      var s = JSON.parse(localStorage.getItem(STORE) || "{}");
      s[k] = v;
      localStorage.setItem(STORE, JSON.stringify(s));
    } catch (e) {
      return undefined;
    }
  }

  function req(method, path, body) {
    return fetch(API + path, {
      method: method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw Object.assign(new Error(d.error || "Error"), { code: d.code });
        return d;
      });
    });
  }

  req("GET", "/config")
    .then(function (cfg) {
      if (cfg.active) init(cfg);
    })
    .catch(function () {});

  function init(cfg) {
    var color = /^#[0-9a-f]{6}$/i.test(cfg.color) ? cfg.color : "#4f46e5";
    var side = cfg.position === "left" ? "left" : "right";
    var host = document.createElement("div");
    host.style.cssText = "position:fixed;z-index:2147483000;bottom:0;" + side + ":0;";
    document.body.appendChild(host);
    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

    root.innerHTML =
      "<style>" +
      "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,sans-serif}" +
      ".btn{position:fixed;bottom:20px;" + side + ":20px;width:58px;height:58px;border-radius:50%;border:0;cursor:pointer;background:" + color + ";color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;transition:transform .2s}" +
      ".btn:hover{transform:scale(1.06)}.btn svg{width:28px;height:28px}" +
      ".badge{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#ef4444;color:#fff;font-size:12px;font-weight:700;display:none;align-items:center;justify-content:center}" +
      ".panel{position:fixed;bottom:90px;" + side + ":20px;width:370px;height:560px;max-height:calc(100vh - 110px);background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.22);display:none;flex-direction:column;overflow:hidden;animation:pop .2s ease-out}" +
      "@keyframes pop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}" +
      ".open .panel{display:flex}" +
      ".head{background:" + color + ";color:#fff;padding:16px 16px 14px;display:flex;align-items:center;gap:10px}" +
      ".av{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}" +
      ".ttl{font-weight:700;font-size:15px;line-height:1.2}.sub{font-size:12px;opacity:.85;margin-top:2px}" +
      ".x{margin-left:auto;background:none;border:0;color:#fff;font-size:22px;cursor:pointer;opacity:.85;line-height:1}" +
      ".list{flex:1;overflow-y:auto;padding:14px;background:#f8fafc;display:flex;flex-direction:column;gap:8px}" +
      ".m{max-width:82%;padding:9px 13px;border-radius:16px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word}" +
      ".v{align-self:flex-end;background:" + color + ";color:#fff;border-bottom-right-radius:5px}" +
      ".b{align-self:flex-start;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-bottom-left-radius:5px}" +
      ".typing{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:12px 14px;display:none;gap:4px}" +
      ".typing span{width:6px;height:6px;border-radius:50%;background:#94a3b8;animation:bl 1s infinite}.typing span:nth-child(2){animation-delay:.15s}.typing span:nth-child(3){animation-delay:.3s}" +
      "@keyframes bl{0%,80%,100%{opacity:.3}40%{opacity:1}}" +
      ".form{display:flex;gap:8px;padding:10px;border-top:1px solid #e2e8f0;background:#fff}" +
      ".in{flex:1;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:14px;outline:none;resize:none;max-height:100px}" +
      ".in:focus{border-color:" + color + "}" +
      ".send{border:0;border-radius:12px;padding:0 14px;background:" + color + ";color:#fff;font-weight:600;cursor:pointer;font-size:14px}.send:disabled{opacity:.5}" +
      ".foot{text-align:center;font-size:11px;color:#94a3b8;padding:0 0 8px;background:#fff}" +
      ".err{color:#dc2626;font-size:12px;padding:0 12px 6px;background:#fff;display:none}" +
      "@media(max-width:480px){.panel{bottom:0;" + side + ":0;width:100vw;height:100%;max-height:100%;border-radius:0}}" +
      "</style>" +
      '<div class="w">' +
      '<button class="btn" aria-label="Chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg><span class="badge"></span></button>' +
      '<div class="panel" role="dialog">' +
      '<div class="head"><div class="av">💬</div><div><div class="ttl"></div><div class="sub"></div></div><button class="x" aria-label="Close">×</button></div>' +
      '<div class="list"><div class="typing"><span></span><span></span><span></span></div></div>' +
      '<div class="err"></div>' +
      '<form class="form"><textarea class="in" rows="1"></textarea><button class="send" type="submit"></button></form>' +
      '<div class="foot"></div>' +
      "</div></div>";

    var $ = function (s) {
      return root.querySelector(s);
    };
    var wrap = $(".w"),
      list = $(".list"),
      typing = $(".typing"),
      input = $(".in"),
      sendBtn = $(".send"),
      badge = $(".badge"),
      errBox = $(".err");
    $(".ttl").textContent = cfg.title;
    $(".sub").textContent = cfg.subtitle || "";
    $(".foot").textContent = "⚡ " + T.by;
    input.placeholder = T.ph;
    sendBtn.textContent = T.send;

    var token = store("token");
    var seen = {};
    var lastAt = "";
    var open = false;
    var unread = 0;
    var typingTimer = null;
    var pollTimer = null;
    var welcomed = false;

    function bubble(cls, text) {
      var d = document.createElement("div");
      d.className = "m " + cls;
      d.textContent = text;
      list.insertBefore(d, typing);
      list.scrollTop = list.scrollHeight;
    }

    function setTyping(on) {
      typing.style.display = on ? "flex" : "none";
      clearTimeout(typingTimer);
      if (on) typingTimer = setTimeout(function () { setTyping(false); }, 30000);
      list.scrollTop = list.scrollHeight;
    }

    function render(msgs) {
      msgs.forEach(function (m) {
        if (seen[m.id]) return;
        seen[m.id] = 1;
        lastAt = m.at;
        if (m.from === "visitor") return bubble("v", m.text);
        setTyping(false);
        bubble("b", m.text);
        if (!open) {
          unread++;
          badge.textContent = unread;
          badge.style.display = "flex";
        }
      });
    }

    function poll() {
      if (!token) return;
      req("GET", "/messages?token=" + encodeURIComponent(token) + "&after=" + encodeURIComponent(lastAt))
        .then(render)
        .catch(function (e) {
          if (e.code === "BAD_VISITOR") {
            token = null;
            store("token", null);
          }
        });
    }

    function schedule() {
      clearInterval(pollTimer);
      pollTimer = setInterval(poll, open ? 2500 : 30000);
    }

    function ensureSession() {
      if (token) return Promise.resolve(token);
      return req("POST", "/session", {}).then(function (d) {
        token = d.token;
        store("token", token);
        return token;
      });
    }

    function toggle(v) {
      open = v;
      wrap.classList.toggle("open", open);
      if (open) {
        unread = 0;
        badge.style.display = "none";
        if (!welcomed && !token && cfg.welcome) bubble("b", cfg.welcome);
        welcomed = true;
        setTimeout(function () { input.focus(); }, 50);
        poll();
      }
      schedule();
    }

    $(".btn").addEventListener("click", function () { toggle(!open); });
    $(".x").addEventListener("click", function () { toggle(false); });

    function submit() {
      var text = input.value.trim();
      if (!text) return;
      input.value = "";
      errBox.style.display = "none";
      sendBtn.disabled = true;
      ensureSession()
        .then(function (tk) {
          return req("POST", "/messages", { token: tk, text: text, page: location.href.slice(0, 500) });
        })
        .then(function () {
          poll();
          setTyping(true);
        })
        .catch(function (e) {
          errBox.textContent = e.code === "OFFLINE" ? T.offline : T.err;
          errBox.style.display = "block";
          input.value = text;
        })
        .then(function () { sendBtn.disabled = false; });
    }

    $(".form").addEventListener("submit", function (e) {
      e.preventDefault();
      submit();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    });

    if (token) poll();
    schedule();
  }
})();
