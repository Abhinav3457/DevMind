# 🧠 DevMind AI

> **Full Stack AI Software Engineer Platform** — an AI-powered platform for writing, reviewing, analyzing, and documenting code.

DevMind AI is a production-ready, full-stack monorepo that combines a **React 19 + Vite** frontend with an **Express + MongoDB** backend. Users can authenticate (email/JWT **and** GitHub OAuth), import GitHub repositories, index them into a searchable code corpus, and then ask an LLM (Gemini / Groq) questions about the code, run AI code reviews, and auto-generate documentation.

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
- [Monorepo Layout](#-monorepo-layout)
- [Technology Stack](#-technology-stack)
- [Request Lifecycle (How a Request Flows)](#-request-lifecycle)
- [Authentication & Authorization](#-authentication--authorization)
- [GitHub Integration & OAuth (Deep Dive)](#-github-integration--oauth-deep-dive)
- [Repository Import & Indexing Pipeline](#-repository-import--indexing-pipeline)
- [Repo Intelligence (Ask Questions About Code)](#-repo-intelligence-ask-questions-about-code)
- [AI Code Review](#-ai-code-review)
- [AI Documentation Generator](#-ai-documentation-generator)
- [AI Chat](#-ai-chat)
- [Real-time (Socket.io)](#-real-time-socketio)
- [Data Models (MongoDB)](#-data-models-mongodb)
- [API Endpoints](#-api-endpoints)
- [Environment Variables](#-environment-variables)
- [Getting Started](#-getting-started)
- [Deployment](#-deployment)
- [Security Measures](#-security-measures)

---

## 🏗️ System Architecture

DevMind AI is split into two decoupled applications that communicate over **REST + WebSocket**:

```
                        ┌────────────────────────────────────────────────┐
                        │                 BROWSER (Client)               │
                        │         React 19 · Vite · Tailwind · Zustand   │
                        │          Axios (REST) · socket.io-client       │
                        └───────────────┬───────────────┬────────────────┘
                                        │               │
                              REST /api/v1│               │ WebSocket (JWT auth)
                                        ▼               ▼
                        ┌────────────────────────────────────────────────┐
                        │                 SERVER (Express)               │
                        │   Middleware → Routes → Controllers → Services │
                        └───────┬───────────────┬───────────────┬────────┘
                                │               │               │
                                ▼               ▼               ▼
                        ┌────────────┐  ┌────────────────┐  ┌──────────────────┐
                        │   MongoDB  │  │   GitHub API   │  │  AI Providers    │
                        │  (Mongoose)│  │   (Octokit)    │  │  Gemini · Groq   │
                        └────────────┘  └────────────────┘  └──────────────────┘
```

### Server-side layering (MVC)

```
Routes (route definitions + validation)
   └─> Controllers (HTTP concerns: parsing, responses)
        └─> Services (business logic)
             └─> Models (Mongoose schemas)
        └─> Domain modules (indexer / repo-intelligence / code-review / doc-generator)
        └─> External adapters (GitHub OAuth/API, AI config, Cloudinary, Nodemailer)
```

**Key design decisions:**

| Decision | Rationale |
|---|---|
| **Stateless REST + JWT** | Access token in `Authorization` header, refresh token in an `httpOnly` cookie |
| **Service-Repository pattern** | Controllers stay thin; services own business rules |
| **Modular domain folders** | `indexer/`, `code-review/`, `doc-generator/`, `repo-intelligence/` are self-contained domains with their own sub-services |
| **AI provider abstraction** | `generateFromAI()` tries **Groq first, Gemini as fallback** — one entry point for all AI calls |
| **User-scoped GitHub tokens** | Each user's GitHub account is stored separately; server falls back to a global `GITHUB_TOKEN` when no user token exists |

---

## 📁 Monorepo Layout

```
devmind-ai/
├── package.json            # Root orchestration (concurrently, lint-staged, husky)
├── render.yaml             # Render.com deployment (API + static frontend)
├── client/                 # React 19 frontend
│   ├── src/
│   │   ├── api/            # Axios instance + React Query client
│   │   ├── components/     # dashboard/, layout/, ui/, ErrorBoundary
│   │   ├── hooks/          # useSocket
│   │   ├── pages/          # Login, Dashboard, GitHub, AI pages...
│   │   ├── routes/         # React Router config
│   │   ├── services/       # auth, analytics, socket
│   │   ├── store/          # Zustand stores (auth, UI)
│   │   └── types/          # Shared TS types
│   ├── vite.config.ts
│   └── tailwind.config.js
└── server/                 # Express backend
    └── src/
        ├── index.ts        # Entry: dotenv → DB connect → HTTP server → Socket.io
        ├── app.ts          # Express app: middleware chain, rate limiting, routes mount
        ├── config/         # environment, database, socket, ai, gemini, github, cloudinary, nodemailer
        ├── controllers/    # HTTP handlers (auth, github, indexer, chat, ...)
        ├── services/       # Business logic (auth, github, analytics, ...)
        ├── routes/         # Express routers per resource
        ├── middleware/     # authenticate, authorize, validate (Joi), asyncHandler, errorHandler
        ├── models/         # Mongoose schemas
        ├── validators/     # Joi request-validation schemas
        ├── indexer/        # file-reader, code-parser, chunker, analyzer, indexer.service
        ├── repo-intelligence/ # classifier, retriever, prompt-builder
        ├── code-review/    # complexity, duplicate, reviewer services
        ├── doc-generator/  # generator.service
        ├── github/         # oauth.service, api.service
        ├── socket/         # Socket.io event handlers
        └── helpers/        # email.helper
```

---

## 🧰 Technology Stack

### Frontend (`client/`)

| Layer | Technology |
|---|---|
| UI Framework | React 19 |
| Build Tool | Vite 6 |
| Language | TypeScript 5.7 |
| Styling | Tailwind CSS 3.4 |
| Routing | React Router DOM 7 |
| State Management | Zustand 5 (client state) |
| Server State | TanStack React Query 5 |
| Forms | React Hook Form + Zod |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| HTTP Client | Axios (interceptors + auto token refresh) |
| Real-time | socket.io-client |
| Notifications | react-hot-toast |
| Charts | Chart.js + react-chartjs-2 |
| Markdown | react-markdown + remark-gfm + rehype-highlight |

### Backend (`server/`)

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express 4 |
| Language | TypeScript 5.7 |
| Database | MongoDB + Mongoose 8 |
| Auth | jsonwebtoken + bcryptjs |
| Validation | Joi |
| Real-time | Socket.io 4 |
| AI | Google Gemini (`gemini-2.0-flash`) + Groq (fallback models) |
| GitHub | Octokit (REST API) + native `fetch` for OAuth token exchange |
| File Upload | Multer + Cloudinary |
| Email | Nodemailer (SMTP) |
| Security | Helmet, CORS, express-rate-limit, compression |
| Testing | Vitest + mongodb-memory-server |
| Zip handling | adm-zip (repo zipball download/extract) |

---

## 🔁 Request Lifecycle

A typical authenticated REST request flows through the server like this:

```
HTTP Request
   │
   ▼
app.ts middleware (in order):
   1. helmet()                     — security headers
   2. cors(CLIENT_URL, credentials) — CORS for the SPA origin
   3. GET /api/v1/health           — public health check (bypasses rate limiter)
   4. express-rate-limit (100 req / 15 min) on /api/v1
   5. rate-limit on auth/login (10/15min) & auth/register (5/15min)
   6. express.json({limit:'10mb'}) + urlencoded + cookieParser
   7. compression()
   8. morgan (dev logging, skipped in test env)
   9. /uploads static files
  10. ──> /api/v1 router ──────────► module routers
  11. 404 handler (unknown routes → ApiError)
  12. globalErrorHandler (standardized {success, message, ...})
```

**Per-route chain:** `validate(schema)` (Joi) → `authenticate` (JWT) → `asyncHandler(controller.method)`.

Every controller response uses the standardized envelope from `utils/apiResponse.ts`:

```jsonc
// Success
{ "success": true, "message": "...", "data": { ... }, "meta": { ... } }

// Error (from globalErrorHandler)
{ "success": false, "message": "..." , "errors": "...", "stack": "..." } // stack only in dev
```

`asyncHandler` wraps every async controller so rejected promises are forwarded to the central error handler instead of crashing the process.

---

## 🔐 Authentication & Authorization

### Identity flow (email/password)

```
Register ──► POST /api/v1/auth/register
              • bcrypt-hashes password (cost 12)
              • creates verification token (SHA-256 hashed in DB, 24h TTL)
              • sends verification email (fire-and-forget)

Verify   ──► GET /api/v1/auth/verify-email/:token
              • sets isEmailVerified = true

Login    ──► POST /api/v1/auth/login
              • validates password with bcrypt.compare
              • issues TWO tokens:
                 - accessToken  (JWT, JWT_EXPIRES_IN=7d)  → returned in body
                 - refreshToken (JWT, 30d) → stored in DB + set as httpOnly cookie
              • user.refreshToken persisted for rotation & reuse detection

Token refresh ──► POST /api/v1/auth/refresh-token
              • verifies refresh token with JWT_REFRESH_SECRET
              • ROTATES: old token invalidated, new refresh token issued
              • detects token reuse (mismatch ⇒ invalidates all sessions)
```

**Client-side token handling** (`client/src/api/axios.ts`):

- `accessToken` is stored in `localStorage` and attached via a **request interceptor** as `Authorization: Bearer <token>`.
- A **response interceptor** catches `401`s, calls `/auth/refresh-token` (using the httpOnly cookie), retries the failed request, and queues concurrent 401s while a refresh is in flight (prevents refresh storms).
- If refresh fails, it clears auth and redirects to `/auth/login`.

**Authorization:** the `authorize(...roles)` middleware is available to restrict endpoints by user role (`user` / `admin`). The `authenticate` middleware decodes the JWT and attaches `req.user = { userId, email, role }`.

---

## 🐙 GitHub Integration & OAuth (Deep Dive)

This is the most security-sensitive part of the system, so it gets its own section.

### Env vars required

| Variable | Purpose |
|---|---|
| `GITHUB_CLIENT_ID` | OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret |
| `GITHUB_CALLBACK_URL` | Optional. Defaults to `CLIENT_URL/auth/github/callback` |
| `GITHUB_TOKEN` | Global fallback token for anonymous/public API calls |

The OAuth App must be created at `https://github.com/settings/developers`, with the **Authorization callback URL** set to `https://<your-client>/auth/github/callback` (the frontend route that handles the popup flow).

### The two callback paths

The server supports **two** ways for GitHub to return the user:

1. **Frontend callback (primary, popup flow):** GitHub redirects to `CLIENT_URL/auth/github/callback?code=...&state=...`. The `GitHubCallback` page then POSTs `{ code, state }` to the **authenticated** endpoint `POST /api/v1/github/auth/callback`.
2. **Direct server callback (fallback):** `GET /api/v1/github/callback` — **unauthenticated**, registered *before* the `authenticate` middleware. The server looks up the user from the `state` param, completes the OAuth exchange, then 302-redirects the browser to `CLIENT_URL/github?github_status=success|error&message=...`.

### Full OAuth flow (popup path)

```
┌─────────┐  1. GET /github/auth/url (JWT)        ┌─────────────────┐
│ Client  │──────────────────────────────────────►│ GitHubController│
│ (React) │                                       └────────┬────────┘
│         │                                                │ getAuthorizationUrl()
│         │                                                ▼
│         │                              gitHubOAuthService.getAuthorizationUrl()
│         │                              • state = crypto.randomBytes(32).toString('hex')
│         │                              • PERSIST { state, userId, expiresAt: now+10min }
│         │                                into OAuthState collection  ← CSRF protection
│         │                              • build authorize URL:
│         │                                  https://github.com/login/oauth/authorize
│         │                                  ?client_id&redirect_uri&scope=repo,user:email,read:org&state
│         │  ◄──────────────────────── { url } ──────────────────────┘
│         │
│         │  2. window.open(url, 'github-oauth', popup)
│         ▼
│   ┌────────────────────┐    3. User approves on github.com
│   │ GitHub (OAuth App) │
│   └─────────┬──────────┘
│             │  4. 302 → CLIENT_URL/auth/github/callback?code=XXX&state=YYY
│             ▼
│   ┌────────────────────┐    5. POST /github/auth/callback { code, state }  (JWT)
│   │ GitHubCallback     │
│   └─────────┬──────────┘
│             ▼
│   gitHubOAuthService.connectAccount(userId, code, state)
│     a. VALIDATE state:
│          • exists?  • belongs to this userId?  • not expired? (10 min TTL)
│          • DELETE state immediately → prevents replay attacks
│     b. Exchange code for token (server-to-server, never exposed to client):
│          POST https://github.com/login/oauth/access_token
│             { client_id, client_secret, code }
│     c. GET /user (Octokit) + GET /user/emails → login, avatar, primary email
│     d. Guard: same githubId already connected to ANOTHER user? → reject
│     e. Upsert GitHubAccount (keyed by userId) with:
│          accessToken, scopes ['repo','user:email','read:org'],
│          rateLimitRemaining: 5000, isConnected: true
│     f. Popup polls every 500ms until closed → client calls /github/status
│         to refresh connection state
└──────────────────────────────────────────────┘
```

### Security properties of the OAuth flow

| Threat | Mitigation |
|---|---|
| **CSRF / login CSRF** | Cryptographically random `state` (32 random bytes) stored server-side and bound to the authenticated user; verified on callback |
| **State replay** | `OAuthState` record is **deleted after first use**; a 10-minute TTL + MongoDB TTL index (`expireAfterSeconds: 0`) purges stale records |
| **Expired / mismatched state** | Explicit checks for expiry and userId mismatch (treated as a possible CSRF attack) |
| **Duplicate account binding** | `githubId` uniqueness check prevents two DevMind users from claiming the same GitHub account |
| **Token leakage to client** | The access token exchange happens **server-side only**; the browser never sees the GitHub token |
| **Token exposure in API responses** | `getConnectionStatus` returns only safe fields (login, avatar, scopes…) — never `accessToken` |

### GitHub API access (`github/api.service.ts`)

The server talks to GitHub via Octokit through a smart client factory:

```
GitHubApiService.getClient({ userId?, useGlobalToken? })
 ├─ getUserClient(userId)  → uses the USER's OAuth access token (highest privileges)
 │      • errors if the account isn't connected
 │      • checks persisted rate-limit remaining; warns if < 100
 └─ getGlobalClient()      → uses GITHUB_TOKEN (single shared app token, for fallback/public ops)
```

- **Rate-limit tracking:** `fetchWithRateLimit()` reads `x-ratelimit-remaining` / `x-ratelimit-reset` response headers and persists them on the user's `GitHubAccount` document after every call.
- **Repo listing** (`/github/repos`) uses the user's token so private repos are visible.

### Connect / disconnect lifecycle

| Action | Endpoint | What happens |
|---|---|---|
| Connect | `GET /auth/url` → OAuth → `POST /auth/callback` | `GitHubAccount` upserted with token + profile |
| Status | `GET /status` | Returns `{ connected, account: {login, name, email, avatarUrl, githubId, scopes} }` |
| Disconnect | `POST /disconnect` | Soft-disconnects (`isConnected:false`, clears token) **and** cascades deletes: all `ImportedRepository`, `IndexReport`, `IndexedFile`, `IndexedChunk` for the user |
| Force disconnect | `POST /force-disconnect` | Admin/ops utility: disconnect + hard-delete by `githubId` (resolves "already connected to another user" dead-ends) |

---

## 📥 Repository Import & Indexing Pipeline

The pipeline that turns a GitHub repo into a queryable code corpus:

```
1. Import       POST /github/repos/import { owner, repo }
                  • gitHubService.importRepository()
                  • fetches full metadata via Octokit
                  • upserts ImportedRepository (unique index: userId + githubId)
                    ─ no code is downloaded yet

2. Index        POST /indexer/repos/:repositoryId/index
                  indexerService.indexRepository()
                  ├─ creates IndexReport { status: 'processing' }
                  ├─ cloneFromGitHub()
                  │    • loads ImportedRepository + user's GitHubAccount
                  │    • downloads zipball:  GET api.github.com/repos/{o}/{r}/zipball/{branch}
                  │                            Authorization: Bearer <user accessToken>
                  │    • extracts with adm-zip into OS temp dir
                  ├─ fileReaderService.readDirectory()
                  │    • recursive walk, skips node_modules/dist/.git/build/coverage,
                  │      binaries, lockfiles, >1MB files
                  │    • detects language by extension
                  ├─ for EACH file:
                  │    • codeParserService.parse()      → functions, classes, imports, exports
                  │    • extractDependencies()          → package names from imports
                  │    • create IndexedFile (metadata only)
                  │    • chunkerService.chunkFile()     → import_block / function / class /
                  │                                      exports_block / section chunks
                  │                                      (100-line max, 10-line overlap)
                  │    • save chunks to IndexedChunk
                  ├─ analyzerService.analyze()
                  │    • detects tech stack (auth/db/framework/library pattern matching)
                  │    • detects env vars, builds folder structure tree
                  │    • generates a human summary
                  ├─ mark report completed (fileCount, chunkCount, totalTokens)
                  └─ cleanup temp dir (finally block)
```

**Indexing statuses:** `pending → processing → completed | failed`. The status is exposed through `GET /github/repos/imported` (attached per repo) and via the repo-intelligence `/status` endpoint. **All repo operations are user-scoped** (`userId` filter on every query) — no cross-user data leakage.

---

## 🤖 Repo Intelligence (Ask Questions About Code)

Endpoint: `POST /api/v1/ai/repo-intelligence/:reportId/ask` (or `/query`).

This is a lightweight **RAG pipeline** built on the index. It does **not** use embeddings/vector search — it uses rule-based classification + regex/aggregation retrieval.

```
Question ("Where is JWT generated?")
   │
   ▼
1. CLASSIFY  queryClassifierService.classify()
      → one of: project_overview | architecture | tech_stack | code_location
                file_explain | function_explain | middleware | general
      → extracts keywords (stop-word filtered), target file / function names
   │
   ▼
2. RETRIEVE  contextRetrieverService.retrieve(reportId, type, keywords, ...)
      → queries IndexReport / IndexedFile / IndexedChunk with regex matches
        (path, imports, function names, chunk content)
      → caps context: 4 chunks, 3 files, ~3k chars total
   │
   ▼
3. PROMPT    promptBuilderService.build()
      → system instruction tuned to the question type (e.g. "Focus: explain architecture")
      → context block: repo summary + tech stack + folder tree + files + code chunks
   │
   ▼
4. GENERATE  generateFromAI({ systemInstruction, prompt, temperature: 0.3 })
      → Groq first (mixtral-8x7b-32768 → llama-3.1-8b-instant), Gemini fallback
   │
   ▼
Answer + contextSummary { filesUsed, chunksUsed, hasTechStack, hasFolderStructure }
```

---

## 🔍 AI Code Review

Endpoint: `POST /api/v1/ai/code-review/:reportId` (repo review) or `/review` (direct code).

Combines **deterministic static analysis** with **LLM review**:

```
codeReviewService.reviewRepository(reportId, userId, filePaths?)
   │
   ├─ Validate report exists & is 'completed'
   ├─ Select up to MAX_REVIEW_FILES=10 files (by path filter or largest by size)
   │
   ├─ 1. COMPLEXITY (local, no AI)   complexityService.analyze()
   │      • heuristic scoring from function name + line count
   │      • average complexity, highest-complexity function, overall rating
   │
   ├─ 2. DUPLICATES (local, no AI)   duplicateService.findDuplicates()
   │      • Jaccard similarity on 3-line n-gram tokens of function/class chunks
   │      • threshold 0.70, ≥5 lines, top 20 results
   │
   ├─ 3. LLM REVIEW (AI)             reviewerService.reviewFiles()
   │      • rebuilds file contents from stored chunks
   │      • prompts Gemini/Groq as a "world-class senior engineer"
   │      • parses the structured markdown response into:
   │          score (0-100), categories (bugs, security, performance,
   │          codeSmells, solidViolations), refactoringSuggestions,
   │          fixedVersion (rewritten critical file)
   │      • resilient parsing: supports two response formats, falls back
   │        to a neutral review if the AI call fails
   │
   └─ Returns { score, summary, categories, complexity, duplicateCode,
                refactoringSuggestions, fixedVersion, filesReviewed, totalIssues }
```

---

## 📝 AI Documentation Generator

Endpoints: `GET /api/v1/ai/doc-generator/types`, `POST /api/v1/ai/doc-generator/:reportId/generate` (and `/generate` direct).

Generates 9 doc types: `readme`, `installation`, `folder-structure`, `architecture`, `api-docs`, `env-vars`, `deployment`, `contributing`, `license`.

```
docGeneratorService.generate(reportId, userId, docType)
   ├─ Build CONTEXT from the IndexReport + IndexedFiles:
   │     summary, techStack, folderStructure, language counts,
   │     top files (by size), routes, functions, classes,
   │     envVars, dependencies, code samples (from chunks)
   └─ generatorService.generate(type, context)
        • per-type system instruction (e.g. README → Features / Tech Stack /
          Quick Start / Project Structure / Env Vars / License sections)
        • returns { content, documentType, fileName } — e.g. README.md
```

---

## 💬 AI Chat

Endpoints under `/api/v1/ai/chat`.

```
POST /generate  { message, history?, chatId? }
   ├─ builds system prompt (DevMind persona + response formatting rules)
   ├─ injects prior conversation into context if provided
   ├─ generateFromAI()  → streaming-less single response
   └─ if chatId: persists user + assistant messages (Message model),
        updates Chat.lastMessage, auto-titles the chat with the first message
```

**Sessions:** `POST /sessions`, `GET /sessions`, `GET /sessions/:chatId`, `PATCH /sessions/:chatId` (rename), `DELETE /sessions/:chatId`. Sessions are `type: 'ai'` and always scoped to `participants` (the owner) for read/delete authorization.

---

## ⚡ Real-time (Socket.io)

Initialized in `server/src/index.ts` on the same HTTP server (`config/socket.ts`). The socket is used to **push in-app notifications live** to the user's browser.

```
Client (socket.io-client) ──auth:{ token: <accessToken> }──► Server
   │                                                            │
   │                      io.use(socketAuthMiddleware)          │ JWT verified, userId attached to socket.data
   │                                                            ▼
   notification:new ──► pushed to room "user:<userId>"          ← sent by notificationService.create()
   └────────────────────────────────────────────────────────────────
```

Notifications are emitted to the authenticated user's room (`user:<userId>`), so only the recipient receives them.

---

## 🗄️ Data Models (MongoDB)

| Collection | Purpose | Notable fields / indexes |
|---|---|---|
| `User` | App users | email/username unique, hashed password, role, email-verification & reset tokens (hashed, TTL indexes), refreshToken (rotation) |
| `Chat` | AI chat sessions | type (ai), participants[] |
| `Message` | Chat messages | chatId, senderId, role (user/assistant/system), type (text/code/ai/…) |
| `GitHubAccount` | OAuth-bound GitHub identity | userId unique, githubId, login, accessToken, scopes, isConnected, rate-limit tracking |
| `OAuthState` | CSRF state for OAuth | state unique, TTL index (10 min) |
| `ImportedRepository` | Repos saved for indexing | unique (userId, githubId), fullName, stars/forks, permissions, lastSyncedAt |
| `IndexReport` | One per indexing run | status, summary, techStack, folderStructure, fileCount, chunkCount, totalTokens |
| `IndexedFile` | File metadata per report | unique (reportId, path), functions/classes/imports/exports/dependencies |
| `IndexedChunk` | Code fragments | (reportId, fileId, index), content, type, tokenCount, embedding (reserved: null) |
| `Notification` / `Upload` | Notifications & uploaded file metadata | — |

**Serialization:** all models expose `id` (string) instead of `_id`/`__v` via `toJSON` transforms, and sensitive fields (`password`, `refreshToken`, `accessToken`, verification tokens) are stripped — unless explicitly selected.

---

## 🌐 API Endpoints

Base URL: `/api/v1` — everything except `health`, `auth` public routes, and the GitHub direct callback requires a valid JWT.

| Module | Endpoints |
|---|---|
| **Auth** | `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `POST /auth/refresh-token` · `PATCH /auth/change-password` · `POST /auth/forgot-password` · `POST /auth/reset-password` · `GET /auth/verify-email/:token` |
| **GitHub** | `GET /github/callback` *(public)* · `GET /github/auth/url` · `POST /github/auth/callback` · `POST /github/disconnect` · `POST /github/force-disconnect` · `GET /github/status` · `GET /github/repos` · `GET /github/repos/imported` · `POST /github/repos/import` · `DELETE /github/repos/imported/:id` · `POST /github/repos/sync` · `GET /github/repos/:owner/:repo` (+ `/branches`, `/commits`, `/pulls`, `/tree`) |
| **Indexer** | `POST /indexer/repos/:repositoryId/index` · `GET /indexer/reports/:reportId` (+ `/files`, `/files/:fileId`, `/chunks`) · `DELETE /indexer/reports/:reportId` |
| **Repo Intelligence** | `GET /ai/repo-intelligence/questions` · `GET /ai/repo-intelligence/status` · `GET /ai/repo-intelligence/reports` · `POST /ai/repo-intelligence/query` · `POST /ai/repo-intelligence/:reportId/ask` |
| **Code Review** | `POST /ai/code-review/review` · `POST /ai/code-review/:reportId` |
| **Doc Generator** | `GET /ai/doc-generator/types` · `POST /ai/doc-generator/generate` · `POST /ai/doc-generator/:reportId/generate` |
| **Chat** | `POST/GET /ai/chat/sessions` · `GET/PATCH/DELETE /ai/chat/sessions/:chatId` · `POST /ai/chat/generate` |
| **Analytics** | `GET /analytics` |
| **Upload** | `POST /upload/single` · `POST /upload/multiple` · `DELETE /upload/delete` |
| **Health** | `GET /health` · `GET /health/ping` |

**Frontend routes** (`client/src/routes/index.tsx`): `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password/:token`, `/auth/verify-email/:token`, `/auth/github/callback`, then a guarded `<AuthGuard>` layout wrapping `/dashboard`, `/github`, `/ai/chat`, `/ai/code-review`, `/ai/docs`, `/analytics`.

---

## ⚙️ Environment Variables

Server (`.env` in `server/`):

| Variable | Default | Required |
|---|---|---|
| `NODE_ENV` | `development` | |
| `PORT` | `5000` | |
| `MONGODB_URI` | `mongodb://localhost:27017/devmind-ai` | |
| `JWT_SECRET` | — | ✅ |
| `JWT_EXPIRES_IN` | `7d` | |
| `JWT_REFRESH_SECRET` | — | ✅ |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | |
| `CLIENT_URL` | `http://localhost:5173` | |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | empty | for uploads |
| `SMTP_HOST` / `_PORT` / `_USER` / `_PASS` / `_FROM` | gmail defaults | for email |
| `GEMINI_API_KEY` | empty | for AI (fallback) |
| `GROQ_API_KEY` | empty | for AI (primary) |
| `GITHUB_TOKEN` | empty | global fallback GitHub token |
| `GITHUB_CLIENT_ID` | empty | for GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | empty | for GitHub OAuth |
| `GITHUB_CALLBACK_URL` | empty → defaults to `CLIENT_URL/auth/github/callback` | |
| `SOCKET_CORS_ORIGIN` | `http://localhost:5173` | |

> ⚠️ `JWT_SECRET` and `JWT_REFRESH_SECRET` are **required** — the server throws at boot if they're missing.

Client (`.env` in `client/`):

| Variable | Default |
|---|---|
| `VITE_API_URL` | `/api/v1` (falls back to same-origin proxy) |
| `VITE_SOCKET_URL` | `''` (same origin) |

---

## 🚀 Getting Started

```bash
# 1. Install all deps (root + client + server)
npm run install:all

# 2. Configure environment
cp server/.env.example server/.env   # fill secrets (JWT, MongoDB, AI keys, GitHub OAuth)
cp client/.env.example client/.env   # VITE_API_URL if needed

# 3. Run everything in dev mode (concurrently)
npm run dev
#   client → http://localhost:5173
#   server → http://localhost:5000  (health: /api/v1/health)

# Or individually
npm run dev:client
npm run dev:server

# Production build + start
npm run build        # compiles server (tsc) + client (vite build)
npm start            # runs server/dist/index.js (serves API only)
```

**First-time setup checklist:**

1. Create a MongoDB instance (local or Atlas) and set `MONGODB_URI`.
2. Generate secrets: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` for both JWT secrets.
3. Set at least one AI key (`GROQ_API_KEY` or `GEMINI_API_KEY`) — all AI features need it.
4. Create a GitHub OAuth App and set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`. Callback URL → `http://localhost:5173/auth/github/callback` for local dev.

### Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Run client + server concurrently |
| `npm run dev:client` / `dev:server` | Run either side individually |
| `npm run build` | Build both (`tsc` + `vite build`) |
| `npm start` | Run compiled server |
| `npm run install:all` | Install root + client + server deps |
| `npm run lint` | ESLint across client & server |
| `npm run format` | Prettier across the repo |
| `npm run test` (in `server/`) | Vitest unit + integration tests (mongodb-memory-server) |

---

## 🚢 Deployment

The repo includes a `render.yaml` for Render.com blueprints:

- **`devmind-ai-api`** — Node web service (`server/`): `npm install --include=dev && npm run build`, start `npm start`, health check at `/api/v1/health`. All secrets (`MONGODB_URI`, JWT secrets, `CLIENT_URL`, GitHub OAuth, Cloudinary, SMTP, AI keys) are `sync: false` — set them in the Render dashboard.
- **`devmind-ai-frontend`** — Static site (`client/`): builds with `vite build`, publishes `./dist`, and rewrites all routes to `/index.html` for SPA routing. `VITE_API_URL` points at the deployed API.

After deploying the API, set `CLIENT_URL` and `SOCKET_CORS_ORIGIN` to the frontend URL, and update the GitHub OAuth App's callback URL to the production frontend.

---

## 🛡️ Security Measures

| Area | Implementation |
|---|---|
| HTTP headers | `helmet()` |
| CORS | Whitelisted `CLIENT_URL` with credentials |
| Rate limiting | Global 100/15min; login 10/15min; register 5/15min |
| Passwords | bcrypt (cost 12), never returned in JSON |
| JWT | Access + rotating refresh tokens; refresh token stored server-side (`select: false`) and rotated on every use with reuse detection; httpOnly cookie for refresh |
| Input validation | Joi schemas on body/params/query before controllers |
| OAuth | State-param CSRF protection, one-time states, 10-min TTL, server-side token exchange |
| Error handling | Central error handler, no stack traces in production |
| Data isolation | Every query scoped by `userId`; socket rooms verify membership |
| Body limits | 10 MB JSON/URL-encoded caps |

---

## 🧪 Testing

```bash
cd server
npm test            # vitest run
npm run test:watch  # watch mode
npm run test:coverage
```

Tests use `mongodb-memory-server` (in-memory MongoDB), so no external DB is needed. Coverage includes the service layer (`auth`, `github`, `analytics`, `code-review`, `doc-generator`, `repo-intelligence`, `upload`), and the chat controller.

---

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/amazing-feature`.
3. Commit your changes (husky + lint-staged will run Prettier & ESLint on commit).
4. Push and open a Pull Request.

## 📄 License

MIT
