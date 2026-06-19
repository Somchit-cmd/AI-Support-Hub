/*
 * AI Support Hub — Website Widget
 * ------------------------------------------------------------------
 * Embeddable floating chat widget (vanilla JS, no dependencies).
 *
 * Embed on any site (e.g. WordPress):
 *   <script>
 *     window.__AI_SUPPORT_HUB__ = "https://your-app.com";
 *   </script>
 *   <script src="https://your-app.com/widget.js" async></script>
 *
 * The script renders a floating bubble (bottom-right by default) that opens
 * a chat panel. It talks to the public /api/widget/* routes on your app.
 * All UI is rendered inside a Shadow DOM so host-site styles can't leak in.
 */
(function () {
  'use strict';

  // Don't double-init if the script is included twice.
  if (window.__AI_SUPPORT_HUB_WIDGET__) return;

  var APP_URL = window.__AI_SUPPORT_HUB__;
  if (!APP_URL) {
    if (typeof console !== 'undefined') {
      console.error('[AI Support Hub] Missing window.__AI_SUPPORT_HUB__ — set it to your app URL before loading widget.js');
    }
    return;
  }
  APP_URL = APP_URL.replace(/\/+$/, ''); // trim trailing slash

  var SESSION_KEY = '__ash_widget_session__';
  var POLL_INTERVAL = 4000; // 4 seconds (fallback when SSE unavailable)
  var pollTimer = null;
  var eventSource = null; // SSE connection for real-time delivery

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------
  function api(path, opts) {
    opts = opts || {};
    return fetch(APP_URL + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      return r.json().then(function (data) {
        return { ok: r.ok, status: r.status, data: data };
      });
    });
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function saveSession(id) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ id: id })); }
    catch (e) {}
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  // ----------------------------------------------------------------
  // State
  // ----------------------------------------------------------------
  var state = {
    config: null,
    sessionId: null,
    lastPollAt: null,
    isOpen: false,
    isSending: false,
    isStarting: false,
    messages: [],
  };

  // ----------------------------------------------------------------
  // DOM (inside a host element + Shadow DOM)
  // ----------------------------------------------------------------
  var host = document.createElement('div');
  host.id = 'ai-support-hub-widget';
  host.style.cssText = 'position:fixed;z-index:2147483000;' +
    'right:0;bottom:0;width:0;height:0;';
  var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

  function render() {
    var color = (state.config && state.config.primaryColor) || '#0F172A';
    var company = (state.config && state.config.companyName) || 'Support';
    var welcome = (state.config && state.config.welcomeMessage) ||
      'Hello! How can we help you today?';

    shadow.innerHTML =
      // ---- Bubble button ----
      '<div id="ash-bubble" style="' +
        'position:fixed;right:20px;bottom:20px;width:60px;height:60px;' +
        'border-radius:50%;background:' + color + ';color:#fff;cursor:pointer;' +
        'box-shadow:0 6px 20px rgba(0,0,0,0.25);display:flex;align-items:center;' +
        'justify-content:center;transition:transform .2s;">' +
        bubbleIcon() +
      '</div>' +
      // ---- Chat panel ----
      '<div id="ash-panel" style="' +
        'position:fixed;right:20px;bottom:90px;width:360px;max-width:calc(100vw - 40px);' +
        'height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:14px;' +
        'box-shadow:0 12px 40px rgba(0,0,0,0.2);display:none;flex-direction:column;' +
        'overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
        'color:#0f172a;">' +
        header(color, company) +
        '<div id="ash-messages" style="flex:1;overflow-y:auto;padding:14px;background:#f8fafc;"></div>' +
        '<div id="ash-input-row" style="display:flex;padding:10px;gap:8px;border-top:1px solid #e2e8f0;background:#fff;">' +
          '<input id="ash-input" type="text" placeholder="Type a message..." style="' +
            'flex:1;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;outline:none;" />' +
          '<button id="ash-send" style="' +
            'background:' + color + ';color:#fff;border:none;border-radius:8px;padding:0 14px;cursor:pointer;font-size:14px;">' +
            'Send</button>' +
        '</div>' +
      '</div>';

    var bubble = shadow.getElementById('ash-bubble');
    var panel = shadow.getElementById('ash-panel');
    var sendBtn = shadow.getElementById('ash-send');
    var input = shadow.getElementById('ash-input');

    bubble.addEventListener('mouseenter', function () { bubble.style.transform = 'scale(1.06)'; });
    bubble.addEventListener('mouseleave', function () { bubble.style.transform = 'scale(1)'; });
    bubble.addEventListener('click', togglePanel);
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
  }

  function bubbleIcon() {
    return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>' +
    '</svg>';
  }

  function header(color, company) {
    return '<div style="padding:14px 16px;background:' + color + ';color:#fff;display:flex;' +
      'align-items:center;justify-content:space-between;">' +
      '<div>' +
        '<div style="font-weight:600;font-size:15px;">' + escapeHtml(company) + '</div>' +
        '<div style="font-size:12px;opacity:.85;display:flex;align-items:center;gap:6px;">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block;"></span>' +
          'We typically reply within minutes' +
        '</div>' +
      '</div>' +
      '<button id="ash-close" style="background:transparent;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;padding:4px;">×</button>' +
    '</div>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ----------------------------------------------------------------
  // Panel open/close
  // ----------------------------------------------------------------
  function togglePanel() {
    state.isOpen ? closePanel() : openPanel();
  }
  function openPanel() {
    state.isOpen = true;
    var panel = shadow.getElementById('ash-panel');
    var bubble = shadow.getElementById('ash-bubble');
    if (panel) panel.style.display = 'flex';
    if (bubble) bubble.style.transform = 'scale(1)';
    startSessionIfNeeded();
  }
  function closePanel() {
    state.isOpen = false;
    var panel = shadow.getElementById('ash-panel');
    if (panel) panel.style.display = 'none';
    stopPolling();
  }

  // Wire close button after every render (it's inside the shadow HTML).
  function bindClose() {
    var closeBtn = shadow.getElementById('ash-close');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
  }

  // ----------------------------------------------------------------
  // Session + messaging
  // ----------------------------------------------------------------
  function startSessionIfNeeded() {
    if (state.sessionId || state.isStarting) {
      // Existing session — just poll.
      loadMessages();
      startPolling();
      return;
    }
    state.isStarting = true;
    var existing = getSession();
    var body = {};
    if (existing && existing.id) body.sessionId = existing.id;

    api('/api/widget/session', { method: 'POST', body: body }).then(function (res) {
      state.isStarting = false;
      if (!res.ok || !res.data.sessionId) {
        renderError(res.data && res.data.error ? res.data.error : 'Unable to start chat');
        return;
      }
      state.sessionId = res.data.sessionId;
      saveSession(state.sessionId);
      // Don't push a synthetic welcome here — the session route also persists
      // it as a real message, so loadMessages() will fetch it (avoids showing
      // the welcome bubble twice).
      loadMessages();
      startPolling();
    }).catch(function () {
      state.isStarting = false;
      renderError('Network error — please try again');
    });
  }

  function loadMessages() {
    if (!state.sessionId) return;
    var qs = state.lastPollAt ? ('?since=' + encodeURIComponent(state.lastPollAt)) : '';
    api('/api/widget/messages/' + state.sessionId + qs).then(function (res) {
      if (res.ok && res.data.messages) {
        mergeMessages(res.data.messages);
        state.lastPollAt = res.data.serverTime || new Date().toISOString();
        renderMessages();
      }
    }).catch(function () {});
  }

  function mergeMessages(incoming) {
    var seen = {};
    state.messages.forEach(function (m) { seen[m.id] = true; });
    incoming.forEach(function (m) {
      if (!seen[m.id]) state.messages.push(m);
    });
  }

  function sendMessage() {
    var input = shadow.getElementById('ash-input');
    var sendBtn = shadow.getElementById('ash-send');
    if (!input || !input.value.trim()) return;
    if (state.isSending) return;

    var text = input.value.trim();
    input.value = '';

    // Optimistic append.
    var tempId = 'tmp_' + Date.now();
    state.messages.push({ id: tempId, content: text, senderType: 'customer' });
    renderMessages();

    state.isSending = true;
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '...'; }

    api('/api/widget/messages/' + state.sessionId, {
      method: 'POST',
      body: { content: text },
    }).then(function (res) {
      state.isSending = false;
      if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }

      if (res.ok && res.data.message) {
        // Replace optimistic temp message with the real one.
        state.messages = state.messages.map(function (m) {
          return m.id === tempId ? res.data.message : m;
        });
        // If the server auto-replied, surface it immediately.
        if (res.data.aiReply) {
          state.messages.push(res.data.aiReply);
        }
        renderMessages();
      } else {
        renderError(res.data && res.data.error ? res.data.error : 'Failed to send');
      }
    }).catch(function () {
      state.isSending = false;
      if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
      renderError('Network error — message not sent');
    });
  }

  // ----------------------------------------------------------------
  // Real-time delivery (SSE) + polling fallback
  // ----------------------------------------------------------------
  // Prefer Server-Sent Events for instant delivery. If the browser (or a
  // proxy) blocks SSE, fall back to polling every few seconds.
  function startPolling() {
    stopPolling();
    if (typeof EventSource !== 'undefined' && state.sessionId) {
      openStream();
      return;
    }
    pollTimer = setInterval(loadMessages, POLL_INTERVAL);
  }

  function openStream() {
    try {
      eventSource = new EventSource(APP_URL + '/api/widget/stream/' + state.sessionId);
      eventSource.onmessage = function (ev) {
        try {
          var payload = JSON.parse(ev.data);
          if (!payload) return;
          if (payload.type === 'message' && payload.message) {
            mergeMessages([payload.message]);
            renderMessages();
            // Keep the watermark current so a re-poll won't replay it.
            state.lastPollAt = payload.message.createdAt || new Date().toISOString();
          } else if (payload.type === 'session_closed') {
            stopPolling();
          }
        } catch (e) { /* ignore malformed */ }
      };
      eventSource.onerror = function () {
        // SSE failed (proxy/network) — fall back to polling.
        closeStream();
        if (!pollTimer) pollTimer = setInterval(loadMessages, POLL_INTERVAL);
      };
    } catch (e) {
      // EventSource unavailable — fall back to polling.
      if (!pollTimer) pollTimer = setInterval(loadMessages, POLL_INTERVAL);
    }
  }

  function closeStream() {
    if (eventSource) {
      try { eventSource.close(); } catch (e) {}
      eventSource = null;
    }
  }

  function stopPolling() {
    closeStream();
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // ----------------------------------------------------------------
  // Rendering message list
  // ----------------------------------------------------------------
  function renderMessages() {
    var box = shadow.getElementById('ash-messages');
    if (!box) return;
    if (!state.messages.length) {
      box.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:13px;padding:20px;">' +
        'Start typing your question below.</div>';
      return;
    }
    box.innerHTML = state.messages.map(function (m) {
      var mine = m.senderType === 'customer';
      var bg = mine ? '#0f172a' : '#ffffff';
      var fg = mine ? '#ffffff' : '#0f172a';
      var align = mine ? 'margin-left:auto;' : 'margin-right:auto;';
      var label = (m.senderType === 'ai' ? 'AI Assistant' : m.senderType === 'system' ? 'Support' : '');
      return '<div style="margin-bottom:10px;display:flex;' + align + 'max-width:80%;">' +
        '<div style="background:' + bg + ';color:' + fg + ';padding:10px 12px;border-radius:12px;' +
        'font-size:14px;line-height:1.4;box-shadow:0 1px 2px rgba(0,0,0,0.05);">' +
        (label ? '<div style="font-size:11px;opacity:.7;margin-bottom:2px;font-weight:600;">' +
          escapeHtml(label) + '</div>' : '') +
        escapeHtml(m.content) +
        '</div>' +
      '</div>';
    }).join('');
    box.scrollTop = box.scrollHeight;
  }

  function renderError(msg) {
    var box = shadow.getElementById('ash-messages');
    if (!box) return;
    box.innerHTML += '<div style="text-align:center;color:#ef4444;font-size:12px;padding:8px;">' +
      escapeHtml(msg) + '</div>';
  }

  // ----------------------------------------------------------------
  // Boot
  // ----------------------------------------------------------------
  function boot() {
    document.body.appendChild(host);
    // Fetch display config (colors, welcome message) then render.
    api('/api/widget/config').then(function (res) {
      state.config = res.ok ? res.data : null;
      render();
      bindClose();
    }).catch(function () {
      // Render with defaults if config fails.
      render();
      bindClose();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.__AI_SUPPORT_HUB_WIDGET__ = true;
})();
