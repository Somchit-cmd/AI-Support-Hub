# Development Guide

Setup, database workflows, AI/channel configuration, testing, and contribution conventions.

---

## Prerequisites

- **Node.js 18+** (20+ recommended) — [download](https://nodejs.org/)
- **npm** (ships with Node.js). The project also works with `bun`.
- **Windows users:** the repo now uses cross-platform scripts. If you previously saw `'tee' is not recognized`, the `package.json` scripts have been simplified — see [Scripts](#scripts).

---

## First-Time Setup

```bash
# 1. Clone
git clone https://github.com/Somchit-cmd/AI-Support-Hub.git
cd AI-Support-Hub

# 2. Install dependencies
npm install

# 3. Environment
cp .env.example .env            # macOS/Linux
copy .env.example .env          # Windows
# Edit .env if you want a non-default DB path (optional)

# 4. Database
npx prisma generate             # generate the Prisma Client
npx prisma db push              # create SQLite DB + tables

# 5. Seed demo data
npx tsx src/lib/seed.ts

# 6. Run
npm run dev
```

App is at **http://localhost:3010**. Sign in with `admin@company.com` / `admin123`.

---

## Scripts

Defined in [`package.json`](../package.json):

| Script | What it does |
|--------|--------------|
| `npm run dev` | Start Next.js dev server on port **3010** (Turbopack) |
| `npm run build` | Production build (`next build`) |
| `npm run start` | Start production server (`next start`) |
| `npm run lint` | Run ESLint |
| `npm run db:push` | `prisma db push` — sync schema to DB |
| `npm run db:generate` | `prisma generate` — regenerate Prisma Client |
| `npm run db:migrate` | `prisma migrate dev` — create a migration |
| `npm run db:reset` | `prisma migrate reset` — wipe & re-migrate |

> **Note:** The original template used Unix-only commands (`tee`, `cp`, `NODE_ENV=...` prefix, standalone output) that don't run on Windows. They have been replaced with standard cross-platform Next.js commands. The standalone-server build step (`cp -r .next/static .next/standalone/`) is removed; if you need it for Docker/serverless deployment, re-enable `output: 'standalone'` in `next.config.ts` and add a post-build copy step appropriate to your platform.

---

## Database Workflows

The DB is **SQLite**, schema in [`prisma/schema.prisma`](../prisma/schema.prisma). The default file is `./dev.db` at the project root.

### Change the schema
1. Edit `prisma/schema.prisma`.
2. For dev iteration (no migration history):
   ```bash
   npx prisma db push
   ```
3. For a tracked migration (recommended once shipping):
   ```bash
   npx prisma migrate dev --name describe_the_change
   ```

### Regenerate the client after schema changes
```bash
npx prisma generate
# or
npm run db:generate
```
Restart the dev server after regenerating so Next.js picks up the new client.

### Reset everything
```bash
# Delete dev.db, then:
npx prisma db push
npx tsx src/lib/seed.ts
```

### Inspect data
Open Prisma Studio — a handy GUI for the DB:
```bash
npx prisma studio
```
Runs at http://localhost:5555.

### Where credentials live
Channel tokens (Facebook/WhatsApp) and AI API keys are **stored in the `Setting` table**, configured via the in-app Settings UI — **not** in `.env`. The only required env var is `DATABASE_URL`.

---

## AI Provider Setup

The AI layer is in [`src/lib/ai-providers.ts`](../src/lib/ai-providers.ts). Five providers are supported:

| Provider | API key | How to get a key |
|----------|---------|------------------|
| **Z-AI** (default) | Not required | — uses `z-ai-web-dev-sdk` |
| **OpenAI** | Required | https://platform.openai.com/api-keys |
| **Google Gemini** | Required | https://aistudio.google.com/apikey |
| **Anthropic Claude** | Required | https://console.anthropic.com/ |
| **Custom** | Required | Your OpenAI-compatible endpoint (Ollama, Groq, Together, LM Studio) |

### Configure in the UI
1. Sign in → **Settings → AI**
2. Pick a provider from the grid
3. Paste your API key (and Base URL for Custom)
4. Pick a model
5. Click **Test Connection** (calls `/api/ai/test-provider`)
6. Adjust **Temperature**, **Max Tokens**, and RAG toggles
7. Set a **monthly budget** to enable cost warnings
8. Save

### Configurable AI settings
| Setting | Default | Purpose |
|----------|---------|---------|
| `ai_mode` | `suggest` | Default AI mode for new conversations |
| `ai_personality` | `professional` | Tone preset |
| `ai_system_prompt` | (empty) | Custom instructions appended to the system prompt |
| `ai_temperature` | — | Creativity (0.0–1.0) |
| `ai_max_tokens` | — | Max response length |
| `ai_rag_enabled` | true | Inject knowledge-base context |
| `ai_monthly_budget` | — | USD budget for green/yellow/red status |

### How RAG works
When AI generates a reply, [`getKnowledgeContext()`](../src/lib/ai.ts) fetches active Documents + FAQs and **keyword-scores** them against the customer's last message. Top-N are injected into the system prompt. This is lightweight (no embeddings or vector DB) but less semantically precise than vector search.

### Cost tracking
Every AI call records an [`AiLog`](../prisma/schema.prisma) and upserts a daily [`AiUsage`](../prisma/schema.prisma) row. Per-model rates live in [`src/lib/ai-usage.ts`](../src/lib/ai-usage.ts) (`COST_RATES`). The **Settings → AI** dashboard reads `GET /api/ai/stats`.

---

## Channel Setup

### Facebook Messenger
1. Go to [developers.facebook.com](https://developers.facebook.com/) and create a Facebook App.
2. Add the **Messenger** product.
3. Generate a **Page Access Token** for your page.
4. In the app: **Settings → Webhooks**, subscribe to `messages`, `messaging_postbacks`.
5. Set the webhook **Callback URL** to:
   ```
   https://YOUR_PUBLIC_DOMAIN/api/webhooks/facebook
   ```
6. Set the **Verify Token** to any string, then enter the **same string** in the app's **Settings → Channels → Facebook** wizard (stored as `facebook_verify_token`). Default fallback is `ai_support_hub_verify_token`.
7. Enter your **Page Access Token** in the wizard.
8. Click **Test Connection**.

**Receiving messages:** Facebook POSTs to your webhook → customer is created by PSID (name fetched via Graph API v21.0) → conversation created/updated → message stored.

**Sending messages:** The send route `/api/send/facebook` exists and calls the Messenger Send API, but the Inbox UI does **not** currently call it (see [Known Issues](KNOWN_ISSUES.md)).

> ⚠️ Webhook POSTs are **not signature-verified**. Before production use, add `x-hub-signature-256` verification.

### WhatsApp Business (Cloud API)
1. Set up a WhatsApp Business Account at [Meta Business Suite](https://business.facebook.com/).
2. Create a WhatsApp app → note your **Phone Number ID** and **Access Token**.
3. Subscribe to webhooks for `messages`, `status`.
4. Set the webhook **Callback URL** to:
   ```
   https://YOUR_PUBLIC_DOMAIN/api/webhooks/whatsapp
   ```
5. Set the **Verify Token** and enter the same value in the app's **Settings → Channels → WhatsApp** wizard.
6. Enter your **Access Token** and **Phone Number ID**.
7. Click **Test Connection**.

**Sending messages:** `/api/send/whatsapp` calls the Cloud API (text + templates) but is **not** invoked by the Inbox UI today.

> ⚠️ No HMAC signature verification on the webhook. Add it before production.

### Exposing localhost for webhook testing
Use a tunnel to give Meta a public HTTPS URL pointing at your dev server:
```bash
# ngrok
ngrok http 3010

# or cloudflared
cloudflared tunnel --url http://localhost:3010
```
Then use the tunnel URL + `/api/webhooks/facebook` (or `/whatsapp`) as the Callback URL.

### Website Live Chat (widget)
> **Not yet implemented.** The embed snippet is shown in Settings, but there is no `widget.js`, public chat route, or widget page. See [Known Issues](KNOWN_ISSUES.md).

---

## Real-Time Chat Service (optional, not wired)

A standalone Socket.IO server lives in [`mini-services/chat-service/`](../mini-services/chat-service/):

```bash
cd mini-services/chat-service
npm install        # or bun install
node index.ts      # or bun run index.ts
```
Runs on **port 3003**.

> This service is **functional in isolation** but is **not connected** to the main app — the Inbox uses REST polling, not Socket.IO. Wiring it in is an open task (see [Known Issues](KNOWN_ISSUES.md#socketio-not-wired-in)).

Events the service handles: `auth`, `join_conversation`, `send_message`, `typing_start`/`typing_stop`, `mark_read`, `customer_join`, `customer_message`, `ai_response`, `status_change`.

---

## Linting & Code Style

```bash
npm run lint        # ESLint (eslint-config-next)
```

Conventions used in this codebase:
- **TypeScript** strict types; Route Handlers use `params: Promise<{ id: string }>` (Next.js 16 async params).
- **Imports:** `@/` alias maps to `src/`.
- **Client vs server:** `'use client'` directive at the top of component files; API routes are server-only.
- **Components:** shadcn/ui primitives in `src/components/ui/`; page-level components in `src/components/pages/`.
- **DB access:** always via the singleton in [`src/lib/db.ts`](../src/lib/db.ts) (`import { db } from '@/lib/db'`).

---

## Debugging Tips

- **Prisma query logging** is enabled in dev (`log: ['query']` in `src/lib/db.ts`). You'll see every SQL statement in the terminal.
- **Hydration mismatch on `<body>`:** a browser extension (e.g. Bitdefender) is injecting attributes. `suppressHydrationWarning` is set on `<body>` in `layout.tsx` to mitigate this.
- **Login fails with "Invalid credentials":** this message is misleading — it appears whenever `POST /api/auth/login` returns non-200, which is usually a DB problem (missing tables or bad `DATABASE_URL`). Run `npx prisma db push` and `npx tsx src/lib/seed.ts`.
- **Stale state after fixes:** the Zustand stores have no persistence, but the browser may cache. Hard-refresh (`Ctrl+Shift+R`) or test in an incognito window.

---

## Contributing

1. Fork & branch: `git checkout -b feature/your-feature`
2. Make changes; keep to the conventions above.
3. Run `npm run lint` — fix any errors.
4. If you changed the schema, document the migration in your PR description.
5. Open a Pull Request. Reference any [Known Issues](KNOWN_ISSUES.md) you're addressing.
