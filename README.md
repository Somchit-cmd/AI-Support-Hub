# AI Support Hub

<p align="center">
  <img src="public/banner.png" alt="AI Support Hub Banner" width="100%" />
</p>

<p align="center">
  <strong>AI-Powered Omnichannel Customer Support Platform</strong><br/>
  Unifying Facebook Messenger, WhatsApp, and Website Chat with RAG-grounded AI assistance.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwindcss" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/AI-RAG_Powered-9333EA" alt="AI RAG" />
</p>

---

## Overview

**AI Support Hub** is a customer support platform that unifies conversations from multiple channels into a single intelligent inbox. It uses RAG (Retrieval-Augmented Generation) to ground AI replies in your own knowledge base, supports multilingual communication (English, Thai, Lao), and offers collaborative human/AI workflows.

> **Project status:** Functional demo / early-stage product. The core platform (inbox, CRM, knowledge base, multi-provider AI, real channel webhooks) is working. Some features are UI-only — see [Known Issues & Limitations](#known-issues--limitations) and [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) for an honest breakdown.

---

## Key Features

### Omnichannel Messaging
- **Facebook Messenger** — real webhook integration (Graph API v21.0) for receiving and sending messages
- **WhatsApp Business** — real Cloud API integration for receiving and sending messages
- **Website Live Chat** — *planned*; widget embed code is shown in Settings but the widget itself is not yet implemented
- Unified inbox consolidating all channels into one view

### AI-Powered Support (5 providers)
A fully-wired provider abstraction layer supporting:
| Provider | Key required? | Models |
|----------|---------------|--------|
| **Z-AI** (default) | No | default |
| **OpenAI** | Yes | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-4, gpt-3.5-turbo |
| **Google Gemini** | Yes | 1.5-flash/pro, 2.0-flash/lite |
| **Anthropic Claude** | Yes | 3.5-sonnet, 3-haiku, 3-opus |
| **Custom** | Yes | Any OpenAI-compatible endpoint (Ollama, Groq, Together, LM Studio) |

- **RAG grounding** — AI replies incorporate context retrieved from your Documents & FAQs (keyword-scored retrieval)
- **Three AI modes** per conversation:
  - **Suggest** (default) — AI drafts replies an agent can accept, edit, or reject
  - **Auto** — intended for automatic replies (manual trigger today; auto-trigger not yet wired)
  - **Human** — AI disabled, agents handle everything
- **Token usage & cost tracking** — daily aggregation, per-provider cost rates, budget warnings, and a usage dashboard in **Settings → AI**

### Knowledge Base (RAG source)
- Add documents by pasting text (txt/pdf/docx/url type tags)
- Create and manage FAQ entries
- Keyword-based relevance scoring for knowledge retrieval
- Configurable RAG limits (max documents, max FAQs, temperature)

### Customer CRM
- Customer profiles with contact details across channels
- Lead pipeline tracking (New → Contacted → Qualified → Proposal → Negotiation → Won/Lost)
- Per-customer sentiment & tags
- CSV export

### Team Management
- Role-based access: Super Admin, Admin, Agent, Viewer
- Agent status management (Online, Away, Busy, Offline)
- Add/remove staff

### Dashboard & Analytics
- 6 live stat cards (conversations, active chats, AI resolution %, response time, customers, messages)
- 4 charts: daily messages, channel distribution, messages-by-sender, customer sentiment
- Team performance ranking

### Automation (UI available, engine pending)
- Rule builder with triggers: New Conversation, Keyword Match, Sentiment Change, Inactivity
- Rules are stored but not yet executed — see known issues

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 + shadcn/ui |
| **Database** | SQLite via Prisma ORM 6 |
| **AI** | z-ai-web-dev-sdk, openai, @google/generative-ai, @anthropic-ai/sdk |
| **State** | Zustand |
| **Animations** | Framer Motion |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Real-time** | Socket.IO (separate optional service, see known issues) |

---

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ (recommended 20+)
- npm (ships with Node.js)

### Installation

```bash
# 1. Clone
git clone https://github.com/Somchit-cmd/AI-Support-Hub.git
cd AI-Support-Hub

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env          # macOS/Linux
copy .env.example .env        # Windows
# Only DATABASE_URL is required - it defaults to a local SQLite file.

# 4. Set up the database (creates tables)
npx prisma generate
npx prisma db push

# 5. Seed demo data (admin user, sample customers, conversations, FAQs)
npx tsx src/lib/seed.ts

# 6. Start the dev server
npm run dev
```

Open **http://localhost:3010** and sign in with the demo account below.

### Demo Login

| Field | Value |
|-------|-------|
| Email | `admin@company.com` |
| Password | `admin123` |

> The form is pre-filled. Note: the login route currently auto-provisions any email and does not verify passwords — see known issues. Use `admin@company.com` to get the seeded `super_admin` role.

> **Windows note:** the original `package.json` scripts used Unix-only commands (`tee`, `cp`, `NODE_ENV=...`). They have been simplified to cross-platform Next.js commands. If you need the standalone production build, see [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

---

## Documentation

Detailed docs live in the [`docs/`](docs/) folder:

| Document | Contents |
|----------|----------|
| [**Architecture**](docs/ARCHITECTURE.md) | System diagram, request flow, data model, AI pipeline |
| [**API Reference**](docs/API_REFERENCE.md) | Every endpoint, methods, request/response shapes |
| [**Development Guide**](docs/DEVELOPMENT.md) | DB commands, AI provider setup, channel setup, testing |
| [**Known Issues**](docs/KNOWN_ISSUES.md) | Honest list of incomplete/broken features and gaps |

---

## Project Structure

```
src/
├── app/
│   ├── api/                          # REST API routes (Route Handlers)
│   │   ├── ai/                       # AI stats & provider test
│   │   ├── auth/                     # login, logout, me
│   │   ├── automation/               # Automation rule CRUD
│   │   ├── channels/                 # Channel mgmt + FB/WA setup
│   │   ├── conversations/            # conversations, messages, ai-reply, assign
│   │   ├── customers/                # Customer CRUD
│   │   ├── dashboard/                # Dashboard stats
│   │   ├── faqs/                     # FAQ CRUD
│   │   ├── knowledge/                # Knowledge documents
│   │   ├── notifications/            # Notifications
│   │   ├── send/                     # Send to Facebook / WhatsApp
│   │   ├── settings/                 # App settings (key-value)
│   │   ├── staff/                    # Staff management
│   │   └── webhooks/                 # Facebook & WhatsApp webhooks
│   ├── layout.tsx                    # Root layout (fonts, ThemeProvider, Toaster)
│   └── page.tsx                      # SPA entry (auth gate → Login or AppShell)
├── components/
│   ├── auth/                         # LoginPage
│   ├── layout/                       # AppShell (sidebar + topbar + page router)
│   ├── pages/                        # Dashboard, Inbox, Customers, Knowledge,
│   │                                 # Staff, Automation, Settings
│   ├── chat/                         # Modular chat components (currently unused)
│   ├── inbox/                        # Modular inbox components (currently unused)
│   ├── common/                       # CustomerDetailPanel
│   └── ui/                           # shadcn/ui primitives
├── hooks/                            # use-socket, use-toast, use-mobile
├── lib/
│   ├── ai.ts                         # RAG retrieval, prompt building, helpers
│   ├── ai-providers.ts               # 5-provider abstraction layer
│   ├── ai-usage.ts                   # Cost calc + daily usage aggregation
│   ├── db.ts                         # Prisma client singleton
│   ├── seed.ts                       # Database seeder
│   ├── store.ts                      # Zustand stores (auth, app, conversations)
│   └── utils.ts                      # cn() and helpers
prisma/
└── schema.prisma                     # 13 models (SQLite)
mini-services/
└── chat-service/                     # Standalone Socket.IO server (port 3003)
public/
└── banner.png
docs/                                 # Project documentation
├── ARCHITECTURE.md
├── API_REFERENCE.md
├── DEVELOPMENT.md
└── KNOWN_ISSUES.md
```

---

## Configuration

Channel credentials (Facebook/WhatsApp tokens, verify tokens) and AI provider API keys are **stored in the database** via the **Settings** UI — they are **not** read from environment variables. The only required env var is `DATABASE_URL`. See [`.env.example`](.env.example).

### AI Provider Setup
1. Go to **Settings → AI**
2. Pick a provider (Z-AI needs no key; others do)
3. Paste your API key, choose a model
4. Click **Test Connection** to verify
5. Adjust temperature, max tokens, and RAG limits as needed

### Channel Setup
See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for step-by-step Facebook and WhatsApp setup, including webhook URLs.

---

## Known Issues & Limitations

This project is functional but has known gaps. Full details in [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md).

**Most impactful:**
- 🔴 **Authentication is demo-only** — no password verification, no real session, logout is a no-op
- 🟡 **Agent replies don't reach FB/WhatsApp** — the inbox send box only writes to the DB; it doesn't call the channel send APIs
- 🟡 **AI "Auto" mode is manual** — no background auto-trigger on incoming messages
- 🟡 **Automation engine not implemented** — rules are stored but never evaluated
- 🟡 **Website widget not implemented** — embed code shown in Settings, no `widget.js` exists
- 🟡 **No real-time updates** — Socket.IO service exists but isn't wired into the app
- 🟢 **Broken button** — Settings → AI "test AI" calls a non-existent endpoint (`/api/ai/test`)

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) before contributing.

---

## License

This project is licensed under the MIT License.

---

<p align="center">
  Built with Next.js, TypeScript, Prisma, and AI
</p>
