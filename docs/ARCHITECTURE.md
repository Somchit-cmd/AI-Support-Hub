# Architecture

This document describes the system design, request flow, data model, and AI pipeline of AI Support Hub.

---

## High-Level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                        │
│   Next.js SPA · React 19 · Zustand · shadcn/ui · Tailwind    │
│                                                              │
│   page.tsx ── auth gate ──┬── LoginPage (unauthenticated)    │
│                           └── AppShell ── 7 page components   │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST (fetch)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Next.js Route Handlers (/api/*)              │
│   auth · conversations · customers · knowledge · staff ·     │
│   automation · channels · settings · dashboard · ai · ...    │
└──────┬───────────────┬────────────────────┬─────────────────┘
       │               │                    │
       ▼               ▼                    ▼
┌────────────┐  ┌─────────────────┐  ┌──────────────────────┐
│ Prisma     │  │ AI Provider     │  │ External Channel APIs│
│ (SQLite)   │  │ Abstraction     │  │ Facebook Graph API   │
│            │  │ (ai-providers)  │  │ WhatsApp Cloud API   │
│ 13 models  │  │                 │  │ (via webhooks + send)│
└────────────┘  └────────┬────────┘  └──────────────────────┘
                         │
            ┌────────────┼────────────┬─────────────┐
            ▼            ▼            ▼             ▼
       ┌────────┐  ┌──────────┐ ┌──────────┐ ┌──────────┐
       │ Z-AI   │  │ OpenAI   │ │ Gemini   │ │ Claude / │
       │ (sdk)  │  │          │ │          │ │ Custom   │
       └────────┘  └──────────┘ └──────────┘ └──────────┘
```

> **Note:** A standalone Socket.IO service (`mini-services/chat-service`, port 3003) exists but is **not currently wired** into the Next.js app. See [Known Issues](KNOWN_ISSUES.md#socketio-not-wired-in).

---

## Application Entry & Routing

AI Support Hub is a **single-page application** with one Next.js route (`/`). There is no multi-route navigation; the entire app lives in `src/app/page.tsx`:

```tsx
// src/app/page.tsx (simplified)
export default function Home() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()

  useEffect(() => { checkAuth() }, [checkAuth])

  if (isLoading)     return <LoadingScreen />
  if (!isAuthenticated) return <LoginPage />
  return <AppShell />
}
```

**Flow:**
1. On load, `checkAuth()` calls `GET /api/auth/me`.
2. If it returns a user, `isAuthenticated` becomes true and `AppShell` renders.
3. `AppShell` holds a sidebar + topbar and swaps the active page component based on `currentPage` in the Zustand `useAppStore` (client-side state, not URL routing).

### Root Layout
`src/app/layout.tsx` sets up:
- Geist Sans & Geist Mono fonts (via `next/font/google`)
- `ThemeProvider` (next-themes) for light/dark
- `Toaster` for notifications
- `suppressHydrationWarning` on `<body>` (mitigates browser-extension DOM mutations)

---

## Data Model

SQLite database managed by Prisma. 13 models — full schema in [`prisma/schema.prisma`](../prisma/schema.prisma).

```
User ──┬──< Conversation (assignedTo)         "AssignedAgent"
       ├──< Message (sender)                   "MessageSender"
       ├──< Document (uploadedBy)              "DocumentUploader"
       ├──< Notification
       └──< Assignment

Channel ──< Conversation
Customer ──┬──< Conversation
           └──< CustomerTag
Conversation ──┬──< Message
               ├──< Assignment
               └──< AiLog
Document · Faq                        (RAG knowledge sources)
AiUsage                               (daily aggregated AI cost/tokens)
AutomationRule                        (stored; engine pending)
Setting                               (key-value app config)
```

### Key design notes

- **`Conversation.aiMode`** (`auto` | `suggest` | `human`) controls AI behavior per conversation. The `ai-reply` endpoint reads this and refuses in `human` mode.
- **`Message.senderType`** is `customer` | `agent` | `ai` | `system`. `senderId` links to `User` only for `agent`/`ai` messages sent by staff.
- **`Setting`** is a generic key-value table. Channel credentials (FB/WA tokens, verify tokens) and AI provider config (API keys, model, temperature) are stored here — **not** in env vars. See [`lib/ai-providers.ts`](../src/lib/ai-providers.ts) `getAIConfig()` and the channel routes.
- **`AiLog`** records every AI call (prompt, response, tokens, cost, response time). **`AiUsage`** is the daily aggregate used by the cost dashboard.

---

## State Management

Three separate Zustand stores in [`src/lib/store.ts`](../src/lib/store.ts) (no persistence middleware — state is in-memory only):

| Store | Responsibility |
|-------|----------------|
| `useAppStore` | Current page, sidebar collapse, theme |
| `useAuthStore` | User, `isAuthenticated`, `login`/`logout`/`checkAuth` |
| `useConversationStore` | Conversation list, selected conversation, filters, `fetchConversations`/`addMessage` |
| `useNotificationStore` | Notifications + unread count |

`login()` POSTs to `/api/auth/login`; on success it sets `user` + `isAuthenticated` locally. There is **no token or cookie** issued by the server — the client simply holds the user object in memory (see [Known Issues](KNOWN_ISSUES.md#authentication-is-demo-only)).

---

## AI Pipeline (RAG)

The AI reply flow lives in [`src/app/api/conversations/[id]/ai-reply/route.ts`](../src/app/api/conversations/[id]/ai-reply/route.ts), orchestrated with [`src/lib/ai.ts`](../src/lib/ai.ts):

```
POST /api/conversations/[id]/ai-reply
  │
  1. Load conversation + last 10 messages
  2. If conversation.aiMode === 'human' → return 400 (AI disabled)
  3. getKnowledgeContext()                       ← src/lib/ai.ts
        ├─ fetch active Documents
        ├─ fetch active FAQs
        └─ keyword-score relevance, take top-N
  4. Build system prompt
        ├─ multilingual instructions (EN/TH/LAO)
        ├─ customer name + lead status
        ├─ injected knowledge context
        └─ configurable personality + custom prompt
  5. generateWithProvider()                      ← src/lib/ai-providers.ts
        └─ routes to z-ai | openai | google | anthropic | custom
  6. Save Message (senderType='ai') to DB
  7. Write AiLog (tokens, cost, response time)
  8. recordUsage() → upsert daily AiUsage        ← src/lib/ai-usage.ts
  9. Return AI message text
```

**RAG retrieval is keyword-scored, not vector embeddings.** Documents and FAQs are matched by token overlap with the latest customer message. This is lightweight (no embedding model or vector DB required) but less semantically precise than true vector search.

### Cost tracking
[`src/lib/ai-usage.ts`](../src/lib/ai-usage.ts) maintains `COST_RATES` per provider/model (input + output $/1K tokens). Every AI call computes cost and upserts into `AiUsage` (keyed by date). `GET /api/ai/stats` returns today/week/month breakdowns + budget status for the Settings dashboard.

---

## Channel Integration Flow

### Inbound (customer → platform)
```
Facebook / WhatsApp  ──webhook POST──▶  /api/webhooks/{facebook,whatsapp}
                                              │
                  ┌───────────────────────────┴──────────────────────┐
                  ├─ verify GET challenge (hub.challenge)
                  ├─ parse event (message / status / delivery)
                  ├─ upsert Customer (by PSID or phone)
                  ├─ find-or-create Conversation (by customer + channel)
                  └─ insert Message (senderType='customer')
```

### Outbound (agent → customer) — *partially implemented*
```
InboxPage "Send"  ──POST──▶  /api/conversations/[id]/messages
                                   │
                                   └─ saves Message to DB (senderType='agent')
                                      ⚠️ does NOT call /api/send/{facebook,whatsapp}
                                         → agent replies do not reach the customer yet
```

The dedicated send routes (`/api/send/facebook`, `/api/send/whatsapp`) exist and work, but the Inbox UI doesn't invoke them. See [Known Issues](KNOWN_ISSUES.md#agent-replies-dont-reach-facebook--whatsapp).

---

## Real-Time (Intended, Not Active)

```
Browser  ──socket.io──▶  mini-services/chat-service (port 3003)
                              │
                              ├─ conversation rooms
                              ├─ typing indicators
                              ├─ presence / status
                              └─ broadcast new_message
```

A standalone Socket.IO server exists in [`mini-services/chat-service/index.ts`](../mini-services/chat-service/index.ts) and a client hook in [`src/hooks/use-socket.ts`](../src/hooks/use-socket.ts). However the running `InboxPage` doesn't use them — it polls via REST on conversation selection. The modular chat components in `src/components/chat/*` and `src/components/inbox/*` were built around Socket.IO but are currently orphaned. See [Known Issues](KNOWN_ISSUES.md#socketio-not-wired-in).

---

## File Responsibilities (quick map)

| Area | Files |
|------|-------|
| **AI core** | `src/lib/ai.ts` (RAG, prompts), `src/lib/ai-providers.ts` (5-provider layer), `src/lib/ai-usage.ts` (cost/budget) |
| **AI endpoints** | `src/app/api/conversations/[id]/ai-reply/`, `src/app/api/ai/stats/`, `src/app/api/ai/test-provider/` |
| **Channels** | `src/app/api/webhooks/{facebook,whatsapp}/`, `src/app/api/send/{facebook,whatsapp}/`, `src/app/api/channels/` |
| **Auth** | `src/app/api/auth/{login,logout,me}/`, `src/components/auth/LoginPage.tsx`, `src/lib/store.ts` |
| **UI shell** | `src/app/page.tsx`, `src/components/layout/AppShell.tsx`, `src/components/pages/*` |
| **DB** | `prisma/schema.prisma`, `src/lib/db.ts`, `src/lib/seed.ts` |
