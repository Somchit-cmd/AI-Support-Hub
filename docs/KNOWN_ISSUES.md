# Known Issues & Limitations

An honest, verified list of what is incomplete, broken, or stubbed in AI Support Hub. Use this as a roadmap. Items are grouped by severity and tagged with the relevant source location.

> Status legend: 🔴 security/critical · 🟡 feature gap · 🟢 minor/cosmetic

---

## Security

### 🔴 Authentication is demo-only
**Files:** [`src/app/api/auth/login/route.ts`](../src/app/api/auth/login/route.ts), [`src/app/api/auth/me/route.ts`](../src/app/api/auth/me/route.ts), [`src/app/api/auth/logout/route.ts`](../src/app/api/auth/logout/route.ts), [`src/lib/store.ts`](../src/lib/store.ts)

- `POST /api/auth/login` **never verifies the password** and auto-creates a user for any email.
- `GET /api/auth/me` returns the first admin user from the DB, ignoring any session/token/cookie.
- `POST /api/auth/logout` is a no-op (comment: *"In a real app, we'd clear the session/cookie here"*).
- The client stores the user in an in-memory Zustand store — no session persistence.
- Staff passwords ([`src/app/api/staff/route.ts`](../src/app/api/staff/route.ts)) and seeded users ([`src/lib/seed.ts`](../src/lib/seed.ts)) store passwords in **plaintext** (or a non-bcrypt placeholder), never hashed.

**Fix direction:** Integrate NextAuth (`next-auth` is already a dependency but unused) or a JWT/cookie session, hash passwords with `bcrypt`, verify in `login`, and gate API routes on a real session.

### 🟡 Webhook signature verification is opt-in
**Files:** [`src/lib/webhook-security.ts`](../src/lib/webhook-security.ts), [`src/app/api/webhooks/facebook/route.ts`](../src/app/api/webhooks/facebook/route.ts), [`src/app/api/webhooks/whatsapp/route.ts`](../src/app/api/webhooks/whatsapp/route.ts)

Both webhooks now verify the `x-hub-signature-256` HMAC header against the raw body using timing-safe comparison **when an app secret is configured**. Set the **App Secret** in the channel connect wizard (Settings → Channels) — it is persisted as `meta_app_secret` and shared by both channels.

> ⚠️ Until an app secret is set, verification is **skipped** (dev mode, with a console warning) so the app stays usable locally. **Set the app secret before exposing the webhook publicly.** The Facebook App Secret and WhatsApp Cloud API app secret are the same value (from your Meta App → Settings → App Secret).

### 🔴 API routes have no authorization
No route checks the caller's identity or role. Any caller can read/write any customer, send messages as any agent, change settings, or read AI usage. Should enforce auth + role checks.

---

## Feature Gaps

### 🟡 Agent replies now reach Facebook & WhatsApp ✅
**Files:** [`src/lib/channels.ts`](../src/lib/channels.ts), [`src/app/api/conversations/[id]/messages/route.ts`](../src/app/api/conversations/[id]/messages/route.ts), [`src/app/api/conversations/[id]/ai-reply/route.ts`](../src/app/api/conversations/[id]/ai-reply/route.ts)

**Resolved.** The messages POST route now calls `dispatchToChannel()` after saving, which routes the reply to Facebook (`/me/messages`) or WhatsApp (Cloud API) based on the conversation's channel type. Delivery is fire-and-forget — a channel failure logs an error but does not roll back the saved message (the reply is still visible in the inbox). AI replies from the `/ai-reply` endpoint are also dispatched.

### 🟡 AI "Auto" mode triggers on inbound messages ✅
**Files:** [`src/lib/ai.ts`](../src/lib/ai.ts) (`generateAndSaveAIReply`), [`src/app/api/webhooks/facebook/route.ts`](../src/app/api/webhooks/facebook/route.ts), [`src/app/api/webhooks/whatsapp/route.ts`](../src/app/api/webhooks/whatsapp/route.ts)

**Resolved.** Both webhooks now call `maybeAutoReply(conversationId)` after storing an inbound message. If the conversation's `aiMode === 'auto'`, it runs the shared `generateAndSaveAIReply()` pipeline and dispatches the AI reply back to the channel. The AI reply logic was extracted from the route into a shared function so manual (suggest) and automatic (auto) paths use identical code.

### 🟡 Automation engine ✅
**Files:** [`src/lib/automation.ts`](../src/lib/automation.ts), [`src/app/api/automation/run/route.ts`](../src/app/api/automation/run/route.ts)

**Resolved.** A rule engine now evaluates active rules against events. Triggers: `new_conversation`, `keyword_match`, `sentiment_change`, `inactivity`. Actions: `setPriority`, `assignToAgentId`/`assignToRole`, `addTag`, `sendNote`, `sendMessage`, `closeConversation`. The engine runs automatically from both webhooks (FB/WA/website) on message/conversation events. The `inactivity` trigger is driven by `GET /api/automation/run?token=<AUTOMATION_CRON_TOKEN>` — call it from an external cron (Vercel Cron, cron-job.org) hourly. Set `AUTOMATION_CRON_TOKEN` in `.env` to enable.

### 🟡 Website widget is not implemented
**Files:** [`src/components/pages/SettingsPage.tsx`](../src/components/pages/SettingsPage.tsx) (embed snippet)

Settings → Channels shows an embed snippet (`<script src="/widget.js">`), but **no `widget.js`, widget route, or public chat page exists**. The "Website Live Chat" channel is currently UI-only.

Fix: add a public `/widget` route + embedded script + customer-side chat UI; wire it to create conversations on the `website` channel (optionally via the Socket.IO service).

### 🟡 Real-time delivery for the website widget ✅ (SSE chosen over Socket.IO)
**Files:** [`src/lib/realtime.ts`](../src/lib/realtime.ts), [`src/app/api/widget/stream/[sessionId]/route.ts`](../src/app/api/widget/stream/[sessionId]/route.ts), [`public/widget.js`](../public/widget.js)

**Resolved** for the customer-facing widget. Instead of wiring the half-broken Socket.IO service, a lightweight in-process event bus + Server-Sent Events stream pushes agent/AI/automation messages to the widget **instantly** (no polling). The widget.js opens an `EventSource` and auto-falls back to 4s polling if a proxy blocks SSE. Agent/AI reply paths call `notifyWidgetMessage()` to publish. **Limitation:** per-process state (single-server only). For multi-instance deploys, swap the `Map` in `realtime.ts` for Redis pub/sub — the public API stays the same.

> The internal staff `InboxPage` still uses REST polling (the orphaned Socket.IO components remain unused). Real-time for the admin inbox is a separate future task.

### 🟡 Sentiment analysis ✅
**Files:** [`src/lib/sentiment.ts`](../src/lib/sentiment.ts), [`src/app/api/webhooks/{facebook,whatsapp}/route.ts`](../src/app/api/webhooks/facebook/route.ts), [`src/app/api/widget/messages/[sessionId]/route.ts`](../src/app/api/widget/messages/[sessionId]/route.ts)

**Resolved.** Inbound customer messages are now scored for sentiment via a multilingual (EN/TH/LAO) keyword heuristic — no AI call, no cost, instant. The customer's `sentiment` field is updated whenever it changes, and the change fires the `sentiment_change` automation trigger. Runs in the background from all three inbound paths (FB, WA, website widget).

### 🟡 Knowledge upload now parses real files ✅
**Files:** [`src/lib/document-parser.ts`](../src/lib/document-parser.ts), [`src/app/api/knowledge/route.ts`](../src/app/api/knowledge/route.ts), [`src/components/pages/KnowledgePage.tsx`](../src/components/pages/KnowledgePage.tsx)

**Resolved.** The Knowledge Base now accepts real file uploads (`multipart/form-data`) parsed server-side via `pdfjs-dist` (PDF), `mammoth` (DOCX), and plain-text. Pasting a URL with `type: url` also fetches and extracts page content. The KnowledgePage upload dialog has a file picker for PDF/DOCX/TXT/MD/HTML in addition to the paste-text fallback. Extracted text is capped at 100k chars.

---

## Minor / Cosmetic

### 🟢 Broken AI "Test AI" button
**File:** [`src/components/pages/SettingsPage.tsx`](../src/components/pages/SettingsPage.tsx) (~line 878)

The Settings → AI **"Test AI"** button calls `/api/ai/test`, which **does not exist**. The working endpoint is `/api/ai/test-provider`. One-line fix.

### 🟢 Non-functional chat UI buttons
**Files:** [`src/components/pages/InboxPage.tsx`](../src/components/pages/InboxPage.tsx), [`src/components/chat/ChatInput.tsx`](../src/components/chat/ChatInput.tsx)

The attach (📎) and emoji (😊) buttons in the chat composer are decorative — they have no handlers.

### 🟢 Duplicated inbox code
**Files:** [`src/components/pages/InboxPage.tsx`](../src/components/pages/InboxPage.tsx) vs [`src/components/chat/*`](../src/components/chat) + [`src/components/inbox/*`](../src/components/inbox)

`InboxPage` re-implements its own conversation list, chat window, and message bubble inline, duplicating the more advanced (but unused) modular components. Consolidating these would reduce maintenance burden and unlock the modular components' features.

### 🟢 WhatsApp status matching is inefficient
**File:** [`src/app/api/webhooks/whatsapp/route.ts`](../src/app/api/webhooks/whatsapp/route.ts)

Matching inbound status updates to outbound messages does a brute-force `findMany` over all agent/ai messages instead of filtering by tracked metadata (e.g. a stored platform message ID). Will degrade as the message table grows.

### 🟢 `dev.db` not in `.gitignore`
The local SQLite file (and `-journal`/`-wal` sidecars) should be git-ignored now that it's a relative path. Add `*.db`, `*.db-journal` to `.gitignore`.

---

## Verification Checklist

This list was verified against the source as of the documentation pass. If you fix something, tick it off and move it to a "Resolved" section below.

- [ ] Real auth (NextAuth or JWT + bcrypt + session)
- [x] Webhook signature verification (FB + WA) — opt-in via app secret
- [ ] API route authorization (role checks)
- [x] Inbox replies forwarded to FB/WhatsApp
- [x] AI auto-mode triggered on inbound messages
- [x] Automation rule engine
- [x] Website live-chat widget
- [x] Real-time widget delivery (SSE) — admin Inbox still polls
- [x] Sentiment analysis on inbound messages
- [x] Real document parsing in Knowledge Base
- [ ] Fix broken `/api/ai/test` → `/api/ai/test-provider` button
- [ ] Implement attach / emoji in chat composer
- [ ] Consolidate duplicated inbox components
- [x] Add `*.db` to `.gitignore`

---

## Resolved

- **Agent replies reach FB/WhatsApp** (2026-06-18) — `dispatchToChannel()` in messages POST route + shared send helpers in `src/lib/channels.ts`.
- **AI auto-mode triggers on inbound messages** (2026-06-18) — `maybeAutoReply()` in both webhooks; shared `generateAndSaveAIReply()` extracted to `src/lib/ai.ts`.
- **Webhook signature verification** (2026-06-18) — `verifyMetaSignature()` in `src/lib/webhook-security.ts`; opt-in via `meta_app_secret` setting (set in connect wizard). Skipped with a warning when no secret is configured.
- **Automation rule engine** (2026-06-18) — `src/lib/automation.ts` evaluates triggers (new_conversation, keyword_match, sentiment_change, inactivity) and dispatches actions; wired into all three inbound paths. `inactivity` runs via `/api/automation/run?token=`.
- **Sentiment analysis** (2026-06-18) — `src/lib/sentiment.ts` scores inbound messages (EN/TH/LAO keyword heuristic), updates `Customer.sentiment`, and fires the `sentiment_change` automation rule.
- **Real-time widget delivery** (2026-06-18) — `src/lib/realtime.ts` in-process bus + SSE stream `/api/widget/stream/[sessionId]`; `widget.js` uses EventSource with polling fallback.
- **Real document parsing** (2026-06-18) — `src/lib/document-parser.ts` (pdfjs-dist + mammoth + URL fetch); knowledge route accepts `multipart/form-data` uploads and URL import.

---

## Suggested Priority

If you want to make this production-usable, work top-to-bottom:

1. **Auth + webhook signatures + route authorization** (🔴 security trifecta)
2. **Agent replies reach real channels** (turns the product from demo into real)
3. **AI auto-mode trigger** (delivers the "AI support" promise)
4. **Website widget** (completes the omnichannel pitch)
5. **Real-time updates** (modern UX expectation)
6. **Automation engine** (the differentiator vs. basic chat apps)

The rest (sentiment, file parsing, dedup, cosmetic buttons) are improvements that can follow.
