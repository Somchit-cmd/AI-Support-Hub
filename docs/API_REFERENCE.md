# API Reference

All endpoints are Next.js Route Handlers under `src/app/api/`. They return JSON. Base URL in development is `http://localhost:3010`.

Unless noted, endpoints expect/return `Content-Type: application/json`.

> ⚠️ **Authentication note:** There is **no token/cookie-based auth enforcement**. The endpoints below are effectively open. `GET /api/auth/me` returns the first admin user it finds. See [Known Issues](KNOWN_ISSUES.md#authentication-is-demo-only).

---

## Contents
- [Auth](#auth)
- [Conversations](#conversations)
- [Messages](#messages)
- [AI](#ai)
- [Customers](#customers)
- [Knowledge & FAQs](#knowledge--faqs)
- [Channels](#channels)
- [Webhooks](#webhooks)
- [Send (Outbound)](#send-outbound)
- [Staff](#staff)
- [Automation](#automation)
- [Settings](#settings)
- [Dashboard](#dashboard)
- [Notifications](#notifications)

---

## Auth

### `POST /api/auth/login`
Sign in (demo). Auto-creates a user if the email doesn't exist. **Does not verify the password.**

**Body**
```json
{ "email": "admin@company.com", "password": "admin123", "name": "optional" }
```
**200**
```json
{
  "user": {
    "id": "cmq...",
    "email": "admin@company.com",
    "name": "Admin User",
    "role": "super_admin",
    "avatar": null,
    "status": "online",
    "isActive": true
  }
}
```
**400** — `email` missing.

### `GET /api/auth/me`
Returns the current user. *(Returns the first admin-role user; ignores session.)*

**200** — same `user` shape as login. **404** — no users in DB.

### `POST /api/auth/logout`
No-op (returns 200). The client clears its local Zustand state.

---

## Conversations

### `GET /api/conversations`
List conversations with optional filters.

**Query params** (all optional): `channel`, `status`, `search`, `aiMode`

**200**
```json
{
  "conversations": [
    {
      "id": "cmq...",
      "customerId": "...",
      "channelId": "...",
      "assignedToId": null,
      "status": "active",
      "aiMode": "suggest",
      "priority": "normal",
      "unreadCount": 2,
      "isPinned": false,
      "lastMessage": "...",
      "lastMessageAt": "2026-06-17T...",
      "createdAt": "...",
      "updatedAt": "...",
      "customer": { "id": "...", "name": "...", "avatar": null },
      "channel": { "id": "...", "type": "website", "name": "..." }
    }
  ]
}
```

### `GET /api/conversations/[id]`
Get a conversation with customer/channel details. *(Does not include messages; fetch them separately.)*

**200** — conversation object. **404** — not found.

### `POST /api/conversations/[id]/assign`
Assign an agent to a conversation.
**Body:** `{ "agentId": "user-id" }`

---

## Messages

### `GET /api/conversations/[id]/messages`
Paginated message history.

**Query params:** `limit` (default 50), `offset` (default 0)

**200**
```json
{
  "messages": [
    {
      "id": "...",
      "conversationId": "...",
      "senderType": "customer",   // customer | agent | ai | system
      "senderId": null,
      "content": "...",
      "contentType": "text",
      "isRead": false,
      "isInternal": false,
      "createdAt": "...",
      "sender": { "id": "...", "name": "...", "avatar": null }
    }
  ],
  "pagination": { "limit": 50, "offset": 0, "total": 12, "hasMore": false }
}
```

### `POST /api/conversations/[id]/messages`
Create a message in a conversation.

**Body**
```json
{
  "content": "Hello!",
  "senderType": "agent",      // default: agent
  "senderId": "user-id",      // optional
  "contentType": "text",      // default: text
  "metadata": {},             // optional, stringified server-side
  "isInternal": false         // optional, internal staff note
}
```
**201** — created `message` object. Also updates the conversation's `lastMessage`/`lastMessageAt`.

> ⚠️ This route **only persists to the DB**. It does **not** forward the message to Facebook/WhatsApp. See [Known Issues](KNOWN_ISSUES.md).

---

## AI

### `POST /api/conversations/[id]/ai-reply`
Generate an AI reply for a conversation. Loads last 10 messages, runs RAG over the knowledge base, calls the active provider, saves the AI message, logs usage/cost.

**Body** (optional)
```json
{ "suggestOnly": true }
```

**200**
```json
{
  "message": { /* Message object, senderType: "ai" */ },
  "aiLog": { "id": "...", "tokens": 320, "model": "gpt-4o", "responseTime": 1420 }
}
```
**400** — `aiMode === 'human'` ("AI replies are disabled for this conversation"). **404** — conversation not found. **500** — provider error.

### `GET /api/ai/stats`
AI usage statistics for the dashboard.

**200**
```json
{
  "today":    { "totalRequests": 12, "totalTokens": 4300, "estimatedCost": 0.043, "avgResponseTime": 1100 },
  "week":     { /* same shape */ },
  "month":    { /* same shape */ },
  "byProvider": [{ "provider": "openai", "model": "gpt-4o", "totalRequests": 40, "totalTokens": 12000, "estimatedCost": 0.12 }],
  "budget":   { "monthlyBudget": 50, "usedThisMonth": 4.2, "remaining": 45.8, "percentUsed": 8.4, "status": "green" },
  "recentLogs": [ /* recent AiLog entries */ ],
  "dailyTrend": [{ "date": "2026-06-17", "totalTokens": 4300, "estimatedCost": 0.043 }]
}
```

### `POST /api/ai/test-provider`
Test an AI provider connection with a probe message. Used by **Settings → AI → Test Connection**.

**Body**
```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "model": "gpt-4o",
  "baseUrl": "https://api.openai.com/v1"   // custom providers only
}
```
**200** — `{ success: true, message: "...", responseTime: 800 }`

> ⚠️ The Settings page's **"Test AI"** button calls `/api/ai/test` (without `-provider`), which **does not exist**. It will 404. The working endpoint is `/api/ai/test-provider`. See [Known Issues](KNOWN_ISSUES.md#broken-ai-test-button).

---

## Customers

### `GET /api/customers`
List customers. **Query params:** `search`, `leadStatus`

### `POST /api/customers`
Create a customer.
```json
{
  "name": "Jane Doe",                  // required
  "email": "jane@example.com",         // optional
  "phone": "+66...",                   // optional
  "facebookId": "...",                 // optional
  "whatsappPhone": "...",              // optional
  "leadStatus": "new",                 // optional
  "sentiment": "neutral",              // optional
  "notes": "",                         // optional
  "tags": [{ "name": "VIP", "color": "#10b981" }]  // optional
}
```

### `GET | PUT | DELETE /api/customers/[id]`
Customer CRUD by ID.

---

## Knowledge & FAQs

### `GET | POST /api/knowledge`
- **GET** — list active documents.
- **POST** — add a knowledge document (paste-text only).
```json
{
  "name": "Return Policy",
  "type": "txt",            // txt | pdf | docx | url
  "content": "We offer 30-day returns...",
  "summary": "optional summary"
}
```
> File upload is **not implemented** — content is pasted text with a type tag.

### `DELETE /api/knowledge/documents/[id]`
Delete a document.

### `GET | POST /api/faqs`
- **GET** — list FAQs.
- **POST** — create an FAQ.
```json
{ "question": "What are your hours?", "answer": "9-6 Mon-Fri", "category": "general" }
```

---

## Channels

### `GET | POST /api/channels`
- **GET** — list channels.
- **POST** — create a channel: `{ type, name, config, isActive }`

### `PUT | DELETE /api/channels/[id]`
Update or delete a channel.

### `POST /api/channels/facebook`
Store Facebook credentials (runs connection test). Credentials are saved to the `Setting` table.

### `POST /api/channels/whatsapp`
Store WhatsApp credentials (runs connection test). Credentials are saved to the `Setting` table.

---

## Webhooks

> These are called by **Meta's servers**, not by your frontend.

### `GET | POST /api/webhooks/facebook`
- **GET** — webhook verification. Echoes `hub.challenge` if `hub.verify_token` matches the value stored in `Setting.facebook_verify_token` (default `ai_support_hub_verify_token`).
- **POST** — inbound Facebook events (`messages`, `messaging_postbacks`, `delivery`, `read`, `echo`). Creates customer by PSID (fetches name via Graph API v21.0), creates/finds conversation, stores messages.

> ⚠️ POST has **no signature verification** (`x-hub-signature-256`). See [Known Issues](KNOWN_ISSUES.md#no-webhook-signature-verification).

### `GET | POST /api/webhooks/whatsapp`
- **GET** — webhook verification.
- **POST** — inbound WhatsApp events (text/image/document/audio/video/sticker/location/contacts/reaction + status updates). Creates customer by phone, stores messages.

> ⚠️ POST has **no HMAC signature verification**.

---

## Send (Outbound)

### `POST /api/send/facebook`
Send a message to a Facebook recipient via the Messenger Send API.
```json
{ "recipientId": "psid-...", "message": "Hello!" }
```
Reads the page access token from the channel config / settings. **Working endpoint** but not called by the Inbox UI.

### `POST /api/send/whatsapp`
Send a WhatsApp message via the Cloud API. Supports text and templates.
```json
{ "to": "+66...", "message": "Hello!", "template": { /* optional */ } }
```
Reads access token + phone number ID from settings. **Working endpoint** but not called by the Inbox UI.

---

## Staff

### `GET /api/staff`
List all staff with assigned-conversation and sent-message counts.

**200**
```json
{
  "staff": [
    {
      "id": "...", "email": "...", "name": "...", "role": "admin",
      "avatar": null, "status": "online", "isActive": true,
      "assignedConversations": 4, "sentMessages": 120
    }
  ]
}
```

### `POST /api/staff`
Create a staff member.
```json
{ "name": "Agent", "email": "agent@company.com", "password": "...", "role": "agent" }
```
*(Password is stored in plaintext alongside the demo auth — not hashed.)*

### `PUT | DELETE /api/staff/[id]`
Update or delete staff.

---

## Automation

### `GET | POST /api/automation`
- **GET** — list rules.
- **POST** — create a rule.
```json
{
  "name": "Escalate angry customers",
  "trigger": "sentiment_change",
  "conditions": { "sentiment": "negative" },
  "actions": { "setPriority": "urgent", "assignTo": "agent-id" },
  "isActive": true
}
```

### `PUT | DELETE /api/automation/[id]`
Update or delete a rule.

> ⚠️ Rules are **stored only** — no engine evaluates them. See [Known Issues](KNOWN_ISSUES.md#automation-rules-are-never-executed).

---

## Settings

### `GET /api/settings`
Returns all settings as a key-value object, optionally filtered by `?category=`.

### `POST /api/settings`
Bulk-upsert settings.
```json
{ "settings": [{ "key": "company_name", "value": "Acme" }, { "key": "ai_provider", "value": "openai" }] }
```

### `PUT /api/settings`
Update a single setting. **Body:** `{ "key": "...", "value": "..." }`

**Known setting keys** (stored in DB):
| Category | Keys |
|----------|------|
| general | `company_name`, `business_hours_*`, `auto_close_inactive_hours`, `supported_languages` |
| ai | `ai_mode`, `ai_personality`, `ai_system_prompt`, `ai_provider`, `ai_api_key`, `ai_model`, `ai_base_url`, `ai_temperature`, `ai_max_tokens`, `ai_rag_enabled`, `ai_monthly_budget` |
| widget | `widget_primary_color`, `widget_welcome_message`, `widget_position` |
| channels | `facebook_*`, `whatsapp_*` |

---

## Dashboard

### `GET /api/dashboard`
Aggregate stats for the dashboard page.

**200** (shape)
```json
{
  "stats": {
    "totalConversations": 42,
    "activeChats": 7,
    "aiResolutionRate": 68,
    "avgResponseTime": 1200,
    "totalCustomers": 25,
    "totalMessages": 540
  },
  "dailyMessages": [{ "date": "2026-06-17", "count": 32 }],
  "channelDistribution": [{ "channel": "website", "count": 20 }],
  "messagesBySender": [{ "sender": "customer", "count": 300 }, { "sender": "ai", "count": 180 }],
  "sentimentDistribution": [{ "sentiment": "neutral", "count": 25 }],
  "topAgents": [{ "name": "Admin", "assignedConversations": 8 }]
}
```
> `sentimentDistribution` reflects stored values (default `neutral`) — sentiment is not actively analyzed.

---

## Notifications

### `GET /api/notifications`
List notifications for the current user. *(Returns notifications for the first admin user.)*

**200** — `{ notifications: [ { id, userId, type, title, message, isRead, link, createdAt } ] }`
