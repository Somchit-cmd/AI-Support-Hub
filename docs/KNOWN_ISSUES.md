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

### 🔴 No webhook signature verification
**Files:** [`src/app/api/webhooks/facebook/route.ts`](../src/app/api/webhooks/facebook/route.ts), [`src/app/api/webhooks/whatsapp/route.ts`](../src/app/api/webhooks/whatsapp/route.ts)

- Facebook webhook POSTs ignore `x-hub-signature-256`.
- WhatsApp webhook POSTs ignore the HMAC signature header.

Anyone who knows your webhook URL can inject fake inbound messages. Add signature verification before exposing publicly.

### 🔴 API routes have no authorization
No route checks the caller's identity or role. Any caller can read/write any customer, send messages as any agent, change settings, or read AI usage. Should enforce auth + role checks.

---

## Feature Gaps

### 🟡 Agent replies don't reach Facebook & WhatsApp
**Files:** [`src/components/pages/InboxPage.tsx`](../src/components/pages/InboxPage.tsx) (`handleSend`), [`src/app/api/conversations/[id]/messages/route.ts`](../src/app/api/conversations/[id]/messages/route.ts)

When an agent types a reply in the Inbox, it only `POST`s to `/api/conversations/[id]/messages` (which saves to the DB). It does **not** call `/api/send/facebook` or `/api/send/whatsapp`. So agent replies never reach the customer on those channels — they're only visible inside the app.

The send endpoints exist and work; they just aren't invoked. Fix: branch `handleSend` on the conversation's `channel.type` and call the appropriate send API, then persist on success.

### 🟡 AI "Auto" mode never auto-replies
**Files:** [`src/app/api/conversations/[id]/ai-reply/route.ts`](../src/app/api/conversations/[id]/ai-reply/route.ts), webhooks

`Conversation.aiMode` can be set to `auto`, and the `ai-reply` endpoint will run in that mode — but **nothing triggers it automatically**. Incoming webhook messages are stored without invoking AI. Auto-mode is effectively manual today.

Fix: in the webhook handlers (or a post-message hook), if `conversation.aiMode === 'auto'`, call the AI reply pipeline.

### 🟡 Automation rules are never executed
**Files:** [`src/app/api/automation/route.ts`](../src/app/api/automation/route.ts), [`prisma/schema.prisma`](../prisma/schema.prisma) (`AutomationRule`)

Rules can be created, listed, toggled, and deleted, but **no engine evaluates them** against events (`new_conversation`, `keyword_match`, `sentiment_change`, `inactivity`). The UI is purely CRUD over stored rules.

Fix: build a rule evaluator that runs on conversation/message events and dispatches actions (set priority, assign, auto-respond, etc.).

### 🟡 Website widget is not implemented
**Files:** [`src/components/pages/SettingsPage.tsx`](../src/components/pages/SettingsPage.tsx) (embed snippet)

Settings → Channels shows an embed snippet (`<script src="/widget.js">`), but **no `widget.js`, widget route, or public chat page exists**. The "Website Live Chat" channel is currently UI-only.

Fix: add a public `/widget` route + embedded script + customer-side chat UI; wire it to create conversations on the `website` channel (optionally via the Socket.IO service).

### 🟡 Socket.IO not wired in
**Files:** [`mini-services/chat-service/index.ts`](../mini-services/chat-service/index.ts), [`src/hooks/use-socket.ts`](../src/hooks/use-socket.ts), [`src/components/chat/*`](../src/components/chat), [`src/components/inbox/*`](../src/components/inbox)

- A standalone Socket.IO server exists (port 3003) and a client hook exists, but **the running `InboxPage` doesn't use them** — it polls via REST on conversation selection.
- The modular chat/inbox components (`src/components/chat/*`, `src/components/inbox/*`) were built for Socket.IO but are **orphaned** (not imported by `AppShell` or `InboxPage`).
- Type mismatch: `useSocket` returns `{ getSocket, isConnected }` but `ChatWindow.tsx` destructures `{ emit, on, off }` — would crash if used as-is.

Fix: either (a) wire the existing service into `InboxPage` (fix the hook API mismatch, emit/subscribe to the right events), or (b) switch to Next.js-native Server-Sent Events for simpler ops.

### 🟡 Sentiment is never analyzed
**Files:** [`src/lib/ai.ts`](../src/lib/ai.ts) (`analyzeSentiment` defined but unused), [`src/app/api/dashboard/route.ts`](../src/app/api/dashboard/route.ts), [`src/components/pages/CustomersPage.tsx`](../src/components/pages/CustomersPage.tsx)

The Dashboard shows a "Customer Sentiment" chart and Customers show sentiment badges, but sentiment is always the default `neutral` — `analyzeSentiment` exists in `ai.ts` but is called **nowhere**. The same applies to `detectLanguage`, `summarizeConversation`, and `generateSuggestedReplies` (all defined, all unused).

Fix: call `analyzeSentiment` on incoming customer messages (in the webhook or message-create flow) and update `Customer.sentiment`.

### 🟡 Knowledge "upload" is paste-only
**Files:** [`src/app/api/knowledge/route.ts`](../src/app/api/knowledge/route.ts), [`src/components/pages/KnowledgePage.tsx`](../src/components/pages/KnowledgePage.tsx)

Documents are added by pasting text into a dialog; the `type` field (pdf/docx/txt/url) is just a label. **No actual file parsing or URL fetching** happens.

Fix: accept file uploads and parse PDF/DOCX (e.g. with `pdf-parse`, `mammoth`), or fetch URL content server-side.

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
- [ ] Webhook signature verification (FB + WA)
- [ ] API route authorization (role checks)
- [ ] Inbox replies forwarded to FB/WhatsApp
- [ ] AI auto-mode triggered on inbound messages
- [ ] Automation rule engine
- [ ] Website live-chat widget
- [ ] Real-time updates wired into Inbox (Socket.IO or SSE)
- [ ] Sentiment analysis on inbound messages
- [ ] Real document parsing in Knowledge Base
- [ ] Fix broken `/api/ai/test` → `/api/ai/test-provider` button
- [ ] Implement attach / emoji in chat composer
- [ ] Consolidate duplicated inbox components
- [ ] Add `*.db` to `.gitignore`

---

## Resolved

*(Empty — move fixed items here with a date and PR reference.)*

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
