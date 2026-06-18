# WordPress Integration — Website Chat Widget

Add the AI Support Hub chat bubble to a WordPress site so visitors can message you directly. Their messages appear in your Inbox on the **Website** channel, and you (or AI auto-mode) can reply.

---

## Prerequisites

- Your AI Support Hub app **deployed to a public HTTPS URL** (e.g. `https://support.yourcompany.com`). Facebook/WordPress need HTTPS; `localhost` will not work for a live site.
- The **Website** channel is **active** (Settings → Channels). It's active by default in the seed data.
- (Optional) Set the widget color, welcome message, and position in **Settings → Widget**.

---

## The embed snippet

In your AI Support Hub app, go to **Settings → Channels → Website Widget Embed Code**. You'll see a snippet like:

```html
<!-- AI Support Hub widget — paste before </body> -->
<script>window.__AI_SUPPORT_HUB__ = "https://YOUR-APP-DOMAIN.com";</script>
<script src="https://YOUR-APP-DOMAIN.com/widget.js" async></script>
```

Replace `YOUR-APP-DOMAIN.com` with your actual deployed app URL.

---

## Three ways to add it to WordPress

### Option A — Insert Headers and Footers plugin (easiest, no code)
Recommended for non-technical site owners.

1. In WordPress admin → **Plugins → Add New** → search for **"Insert Headers and Footers"** (or "WPCode") → install and activate.
2. Go to **Settings → Insert Headers and Footers** (or **Code Snippets → Header & Footer**).
3. Paste the snippet into the **Footer** box (the "Scripts in footer" section).
4. Click **Save**.
5. Visit your site — the chat bubble appears in the bottom-right corner.

### Option B — via your theme's `functions.php`
For a permanent, site-wide embed without a plugin.

1. WordPress admin → **Appearance → Theme File Editor** (or edit via FTP/SFTP).
2. Open `functions.php` of your **child theme** (always use a child theme to survive updates).
3. Append:

   ```php
   add_action('wp_footer', 'ai_support_hub_widget');
   function ai_support_hub_widget() {
       ?>
       <script>window.__AI_SUPPORT_HUB__ = "https://YOUR-APP-DOMAIN.com";</script>
       <script src="https://YOUR-APP-DOMAIN.com/widget.js" async></script>
       <?php
   }
   ```
4. Save. The widget now loads in the footer of every page.

### Option C — directly in `footer.php`
If you don't want a plugin or `functions.php` edits.

1. WordPress admin → **Appearance → Theme File Editor** → open `footer.php`.
2. Just **before** the closing `</body>` tag, paste the snippet.
3. Save.

> ⚠️ Editing theme files directly is overridden when the theme updates. Prefer **Option A** or a child theme (Option B).

---

## Testing it

1. Open your WordPress site in an **incognito/private window** (so cache and old sessions don't interfere).
2. Click the floating bubble in the bottom-right.
3. Type a message and send it.
4. In a separate tab, open your **AI Support Hub Inbox** — you'll see a new conversation on the Website channel.
5. Reply from the Inbox (or let AI auto-mode reply) — the visitor sees it appear in the widget within ~4 seconds.

If the bubble doesn't appear, open the browser **DevTools → Console** and look for errors. The most common issues are:
- `window.__AI_SUPPORT_HUB__` not set, or pointing to the wrong URL
- The app URL not reachable over HTTPS
- A caching plugin serving a stale page (clear cache or use incognito)

---

## How it works (technical)

| Step | What happens |
|------|--------------|
| Widget loads | `widget.js` fetches `/api/widget/config` for color/welcome message, renders the bubble in a **Shadow DOM** (host site styles can't leak in) |
| Visitor opens chat | Widget calls `POST /api/widget/session` → creates a Customer + Conversation on the Website channel, stores the `sessionId` in `localStorage` |
| Visitor sends a message | `POST /api/widget/messages/[sessionId]` → message saved to DB |
| If `aiMode === 'auto'` | The same call triggers the AI auto-reply pipeline (RAG-grounded) |
| Visitor waits for reply | Widget polls `GET /api/widget/messages/[sessionId]?since=<lastTime>` every 4 seconds |
| Agent replies in Inbox | Message saved → next poll delivers it to the visitor |

### Cross-origin (CORS)
The widget runs on `yourwordpresssite.com` but calls your app at `support.yourcompany.com`. CORS headers for `/api/widget/*` are handled by `src/middleware.ts` — it echoes the request origin, so any site can embed the widget. To restrict embedding to specific domains only, edit that middleware to check against an allowlist.

### Privacy & data
- Each visitor gets a **Customer record** (named "Website Visitor" unless they provide a name/email).
- The `sessionId` is stored in the visitor's `localStorage`, so returning visitors resume their conversation.
- Internal staff notes (`isInternal`) are never sent to the widget.
- Read receipts: agent/AI messages are marked read when the widget polls them.

---

## Customizing the widget

In **AI Support Hub → Settings → Widget**:

| Setting | Effect |
|----------|--------|
| **Primary Color** | Bubble + header background + send button |
| **Welcome Message** | System message shown when the chat opens |
| **Position** | Bubble placement (bottom-right is the widget default) |

Changes take effect on the visitor's next page load (the widget refetches `/api/widget/config`).

---

## Limitations

- **Polling, not real-time:** the widget checks for new messages every 4 seconds. For instant delivery, wire up the Socket.IO service or Server-Sent Events (open task — see `KNOWN_ISSUES.md`).
- **No file/image uploads** in the widget yet — text only.
- **No pre-chat form:** visitors aren't asked for name/email before chatting. The session starts anonymously and can be enriched later. (Easy to add if wanted.)
- **Customer identity** relies on `localStorage`; clearing browser data starts a fresh conversation. For persistent identity across devices, you'd need server-side session tokens tied to WordPress user IDs.
