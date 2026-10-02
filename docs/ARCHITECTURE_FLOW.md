# DevMind AI — Frontend ↔ Backend Working Flow

> Verified against the current source (`client/src`, `server/src`). Diagrams are Mermaid —
> they render on GitHub and in VS Code (Markdown Preview Mermaid Support).

---

## 1. System Overview

```
┌──────────────────────────── BROWSER (client/) ────────────────────────────┐
│  React 19 · Vite 6 · Tailwind · Zustand (client state)                     │
│  TanStack React Query (server state) · React Router 7                      │
│  Axios (REST + JWT refresh) · socket.io-client (live notifications)        │
└───────────────┬──────────────────────────────────────┬────────────────────┘
                │ REST  /api/v1/*  (Bearer JWT)        │ WebSocket (JWT in handshake)
                ▼                                      ▼
┌──────────────────────────── SERVER (server/) ─────────────────────────────┐
│  Express 4 · TypeScript · helmet/cors/rate-limit/compression                │
│  Middleware chain → Routes → Controllers → Services → Models               │
│  Domain modules: indexer · repo-intelligence · code-review · doc-generator │
│  Socket.io (rooms: user:<userId>)                                          │
└──────┬──────────────────┬──────────────────┬───────────────────────────────┘
       ▼                  ▼                  ▼
 ┌───────────┐   ┌────────────────┐   ┌──────────────────────────────┐
 │  MongoDB  │   │  GitHub API    │   │ AI providers                 │
 │ (Mongoose)│   │  (Octokit +    │   │ Groq · Gemini (auto-fallback)│
 │           │   │   OAuth token) │   │ Cloudinary · Nodemailer      │
 └───────────┘   └────────────────┘   └──────────────────────────────┘
```

**Rule of thumb:** the client never talks to MongoDB, GitHub, or AI providers directly.
Everything goes through the Express API, which owns all secrets and business rules.

---

## 2. Boot Flow (what starts when you run `npm run dev`)

```mermaid
flowchart TD
    A["npm run dev (root, concurrently)"] --> B["client: vite @ :5173"]
    A --> C["server: nodemon + ts-node src/index.ts @ :5000"]

    C --> D["dotenv.config()"]
    D --> E["connectDatabase() → Mongoose → MongoDB"]
    E --> F["createServer(app)"]
    F --> G["initializeSocket(httpServer)"]
    G --> G1["io.use(socketAuthMiddleware) — verifies JWT from handshake.auth.token"]
    G1 --> H["httpServer.listen(PORT)"]
    H --> I["GET /api/v1/health → 200 ok"]

    B --> J["index.html → main.tsx"]
    J --> K["QueryClientProvider + BrowserRouter"]
    K --> L["AppRoutes"]

    E -.fail.-> X["logger.error → process.exit(1)"]
```

Client env: `VITE_API_URL` (default `/api/v1`), `VITE_SOCKET_URL` (default same origin).
Server env: `JWT_SECRET` + `JWT_REFRESH_SECRET` are **required** or boot throws.

---

## 3. Frontend Request Path (client → server)

```mermaid
flowchart TD
    P["Page component (e.g. CodeReviewPage.tsx)"] --> S{"How is data fetched?"}
    S -->|"Service module (auth.ts, analytics.ts)"| SV["apiClient.get/post('/…')"]
    S -->|"React Query (useQuery/useMutation)"| SV
    S -->|"Direct in page"| SV

    SV --> RI["Axios REQUEST interceptor"]
    RI --> RI1["localStorage.getItem('accessToken')"]
    RI1 --> RI2["header Authorization: Bearer <token>"]
    RI2 --> NET["HTTP → server"]

    NET --> RESP{"response"}
    RESP -->|"2xx"| OK["response.data.data → component state / Query cache"]
    RESP -->|"401"| AF["Response interceptor → auto-refresh (see §5)"]
    RESP -->|"other error"| T["toast.error(message)"]
```

**Why services exist:** `client/src/services/*` and page-level calls both use the single
`apiClient` instance, so every request automatically gets the token, the refresh logic,
the 180s timeout, and `withCredentials` (needed for the httpOnly refresh cookie).

**Client vs server state**
| State | Tool | Examples |
|---|---|---|
| Auth session, UI flags | Zustand | `store/auth`, `store/ui` |
| Fetched API data | TanStack React Query | analytics, review history (`staleTime` 5 min, `retry: 1`) |
| Route protection | `AuthGuard` | wraps `/dashboard`, `/github`, `/ai/*`, `/analytics` |

**Route map** (`client/src/routes/index.tsx`)

```
PUBLIC                                    GUARDED (AuthGuard + AppLayout)
/auth/login                               /            → redirect /dashboard
/auth/register                            /dashboard
/auth/forgot-password                     /github
/auth/reset-password/:token               /ai/chat
/auth/verify-email/:token                 /ai/code-review
/auth/github/callback  (OAuth popup)      /ai/docs
/code-review/shared/:token  (share link)  /analytics
*  → /auth/login
```

---

## 4. Backend Request Path (server internals)

```mermaid
flowchart TD
    R["Incoming HTTP request"] --> H["helmet() — security headers"]
    H --> C["cors(CLIENT_URL, credentials:true)"]
    C --> HC{"path == /api/v1/health?"}
    HC -->|yes| HP["health handler → 200 (skips rate limit)"]
    HC -->|no| RL["generalLimiter 200 req / 15 min on /api/v1"]
    RL --> ARL{"auth/login or auth/register?"}
    ARL -->|"login"| AL["authLimiter 10 / 15 min"]
    ARL -->|"register"| RG["rateLimit 5 / 15 min"]

    AL --> PARSE
    RG --> PARSE
    ARL -->|no| PARSE["express.json({limit:'10mb'}) + urlencoded + cookieParser()"]
    PARSE --> COMP["compression()"]
    COMP --> LOG["morgan('dev') — skipped when NODE_ENV=test"]
    LOG --> STATIC["/uploads static"]
    STATIC --> ROUTER["/api/v1 router (routes/index.ts)"]

    ROUTER --> MODULE["Module router e.g. /ai/code-review"]
    MODULE --> VAL["validate(Joi schema) → 400 on failure"]
    VAL --> AUTH["authenticate → jwt.verify → req.user"]
    AUTH --> CTRL["asyncHandler(controller.method)"]
    CTRL --> SVC["Service (business logic)"]
    SVC --> MODEL["Mongoose model → MongoDB"]
    SVC --> EXT["External: Octokit / Groq / Gemini / Cloudinary / SMTP"]
    CTRL --> RES["ApiResponse envelope"]

    ROUTER -.unknown route.-> N404["404 ApiError → next(err)"]
    VAL -.throws.-> EH
    AUTH -.throws.-> EH
    CTRL -.rejects.-> EH["globalErrorHandler"]
    SVC -.throws.-> EH
    EH --> EOUT["{ success:false, message, errors? } — no stack sent to client"]
```

Note: a public route must be registered **before** `authenticate` in its own router
(e.g. `GET /ai/code-review/shared/:token`, `GET /github/callback`).

**Standard response envelope** (`utils/apiResponse.ts`)

```jsonc
// success
{ "success": true, "message": "...", "data": { … }, "meta": { … } }
// error
{ "success": false, "message": "..." }   // + errors when applicable
```

```mermaid
sequenceDiagram
    autonumber
    participant UI as React page
    participant AX as Axios apiClient
    participant EX as Express (app.ts)
    participant MW as validate + authenticate
    participant CT as Controller (asyncHandler)
    participant SV as Service
    participant DB as MongoDB
    participant AI as Groq / Gemini

    UI->>AX: apiClient.post('/ai/code-review/:reportId')
    AX->>AX: inject Authorization: Bearer <access>
    AX->>EX: HTTP POST + JSON body
    EX->>EX: helmet → cors → rate-limit → body parse → compression
    EX->>MW: route middleware chain
    MW->>MW: Joi validate body/params  (400 on error)
    MW->>MW: jwt.verify → req.user = {userId,email,role}
    MW->>CT: next()
    CT->>SV: service.reviewRepository(reportId, userId)
    SV->>DB: find IndexReport / IndexedFile / IndexedChunk (userId scoped)
    SV->>AI: generateFromAI(prompt, temperature 0.3)
    AI-->>SV: markdown review
    SV-->>CT: { score, categories, complexity, … }
    CT-->>EX: sendSuccess(res, data)
    EX-->>AX: 200 { success, data }
    AX-->>UI: response.data.data
    UI->>UI: render + toast success
```

---

## 5. Auth & Token Refresh Flow

```mermaid
flowchart TD
    REG["POST /auth/register"] --> RH["bcrypt hash (cost 12)"]
    RH --> RT["email verification token (SHA-256 in DB, 24h TTL)"]
    RT --> RM["send verification email (fire-and-forget)"]
    RM --> VER["GET /auth/verify-email/:token → isEmailVerified = true"]

    LOG["POST /auth/login"] --> LC["bcrypt.compare"]
    LC -->|fail| L401["401 Invalid credentials"]
    LC -->|ok| TOK["issue accessToken (JWT 7d) + refreshToken (JWT 30d)"]
    TOK --> STORE["refreshToken persisted on User + set as httpOnly cookie"]
    STORE --> BODY["accessToken returned in response body"]

    BODY --> LS["client: localStorage['accessToken']"]
    LS --> REQ["every request: Authorization: Bearer <token>"]
```

```mermaid
flowchart TD
    A["Any API call returns 401"] --> B{"url includes /auth/refresh-token?"}
    B -->|yes| Z["show error toast → reject"]
    B -->|no| C{"already retried (_retry)?"}
    C -->|yes| Z
    C -->|no| D{"accessToken in localStorage?"}
    D -->|no| D1["window.location = /auth/login"]
    D -->|yes| E{"isRefreshing already true?"}
    E -->|yes| F["push request into failedQueue → wait"]
    E -->|no| G["set isRefreshing = true"]
    G --> H["axios.post('/auth/refresh-token', {}, withCredentials)"]
    H -->|"200"| I["store new accessToken → processQueue(null, token)"]
    I --> J["retry original request with new token, clear _retry"]
    H -->|"fail"| K["processQueue(err) → clear auth → redirect /auth/login"]
    F --> J
    J --> L["response returned to caller"]
```

Server side: `POST /auth/refresh-token` verifies with `JWT_REFRESH_SECRET`, **rotates** the
refresh token, and detects reuse (mismatch ⇒ all sessions invalidated).

| Concern | Where |
|---|---|
| Password hashing | `bcryptjs`, cost 12 |
| Access token | JWT, `JWT_EXPIRES_IN=7d`, in `localStorage` |
| Refresh token | JWT, 30d, httpOnly cookie + `User.refreshToken` (`select: false`) |
| Socket auth | same access token in `handshake.auth.token` |
| Role gating | `authorize(...roles)` middleware |

---

## 6. GitHub OAuth Connect Flow (popup)

```mermaid
sequenceDiagram
    autonumber
    participant U as User (browser)
    participant C as Client (/github page)
    participant S as Server
    participant DB as MongoDB
    participant GH as github.com

    C->>S: GET /github/auth/url  (JWT)
    S->>S: state = crypto.randomBytes(32).hex
    S->>DB: OAuthState { state, userId, expiresAt: +10min } (TTL index)
    S-->>C: { url: /login/oauth/authorize?client_id&redirect_uri&scope=repo,user:email,read:org&state }
    C->>U: window.open(url, 'github-oauth', popup)
    U->>GH: approve the OAuth app
    GH-->>C: 302 → CLIENT_URL/auth/github/callback?code=XXX&state=YYY
    C->>S: POST /github/auth/callback { code, state }  (JWT)
    S->>DB: validate state → exists? owned by user? not expired?
    S->>DB: DELETE state  (one-time use — replay protection)
    S->>GH: POST /login/oauth/access_token { client_id, client_secret, code }  (server-to-server)
    GH-->>S: access_token
    S->>GH: GET /user + GET /user/emails (Octokit)
    GH-->>S: login, name, avatar, primary email
    S->>DB: guard: githubId already bound to another user? → reject
    S->>DB: upsert GitHubAccount (userId, token, scopes, rateLimitRemaining)
    S-->>C: success
    C->>C: popup polls every 500ms until closed
    C->>S: GET /github/status → { connected, account: {login, avatarUrl, …} }
```

The browser **never** sees the GitHub access token — the exchange happens server-side.
`GET /github/callback` (unauthenticated, registered first) is the non-popup fallback and
302-redirects to `CLIENT_URL/github?github_status=success|error`.

Disconnect (`POST /github/disconnect`) soft-disconnects and cascade-deletes the user's
`ImportedRepository`, `IndexReport`, `IndexedFile`, `IndexedChunk`.

---

## 7. Repository Import + Indexing Pipeline

```mermaid
flowchart TD
    A["POST /github/repos/import { owner, repo }"] --> A1["Octokit: fetch repo metadata"]
    A1 --> A2["upsert ImportedRepository (unique: userId + githubId) — no code downloaded yet"]

    A2 --> B["POST /indexer/repos/:repositoryId/index"]
    B --> B1["IndexReport { status: processing }"]
    B1 --> C["cloneFromGitHub()"]
    C --> C1["GET api.github.com/repos/o/r/zipball/branch (user token)"]
    C1 --> C2["adm-zip extract → OS temp dir"]

    C2 --> D["fileReaderService.readDirectory()"]
    D --> D1["skip node_modules/dist/.git/build/coverage, binaries, lockfiles, >1MB"]
    D --> D2["detect language by extension"]

    D2 --> E{"for each file"}
    E --> E1["codeParserService.parse() → functions, classes, imports, exports"]
    E1 --> E2["extractDependencies() → package names"]
    E2 --> E3["save IndexedFile (metadata)"]
    E3 --> E4["chunkerService.chunkFile() → import_block / function / class / exports_block / section"]
    E4 --> E5["100-line max, 10-line overlap → save IndexedChunk"]

    E5 --> F["analyzerService.analyze()"]
    F --> F1["detect tech stack, env vars, folder tree, human summary"]
    F1 --> G["IndexReport → completed (fileCount, chunkCount, totalTokens)"]
    G --> H["cleanup temp dir (finally)"]

    B1 -.error.-> X["IndexReport → failed"]
```

Statuses: `pending → processing → completed | failed`. Every query is scoped by `userId`.

---

## 8. Feature Flows (server-side logic)

### 8a. Repo Intelligence — "ask a question about the code" (RAG)

```mermaid
flowchart LR
    Q["question + reportId"] --> CL["classify()"]
    CL --> CL1["type: project_overview | architecture | tech_stack | code_location | file_explain | function_explain | middleware | general"]
    CL1 --> RT["retrieve()"]
    RT --> RT1["regex query IndexedFile / IndexedChunk; cap 4 chunks, 3 files, ~3k chars"]
    RT1 --> PB["promptBuilder.build() — type-specific system instruction + context"]
    PB --> GEN["generateFromAI(temperature 0.3)"]
    GEN --> ANS["answer + contextSummary { filesUsed, chunksUsed }"]
```

No embeddings / vector search — retrieval is rule-based classification + regex.

### 8b. AI Code Review (static analysis + LLM)

```mermaid
flowchart TD
    A["POST /ai/code-review/:reportId"] --> V{"report exists and completed?"}
    V -->|no| E["400/404"]
    V -->|yes| SEL["select up to 10 files (path filter or largest)"]

    SEL --> C1["complexityService.analyze() — LOCAL, no AI: heuristic score, avg, worst function, rating"]
    SEL --> C2["duplicateService.findDuplicates() — LOCAL: Jaccard on 3-line n-grams, threshold 0.70"]
    SEL --> C3["reviewerService.reviewFiles() — AI"]
    C3 --> C3a["rebuild file contents from stored chunks"]
    C3a --> C3b["prompt as senior engineer → structured markdown"]
    C3b --> C3c["parse → score 0-100, categories (bugs/security/performance/codeSmells/solidViolations), refactoringSuggestions, fixedVersion"]
    C3c --> C3d{"parse failed / AI error?"}
    C3d -->|yes| C3e["neutral fallback review (never 500s the feature)"]

    C1 --> OUT["{ score, summary, categories, complexity, duplicateCode, refactoringSuggestions, fixedVersion, filesReviewed, totalIssues }"]
    C2 --> OUT
    C3e --> OUT
    OUT --> HIST["saved to review history (+ optional shareToken → public /code-review/shared/:token)"]
```

### 8c. Doc Generator

```
POST /ai/doc-generator/:reportId/generate { docType }
  → 9 types: readme · installation · folder-structure · architecture · api-docs
             env-vars · deployment · contributing · license
  → build context: summary, techStack, folderStructure, language counts, top files,
                   routes, functions, classes, envVars, dependencies, code samples
  → generatorService.generate(type, context) → { content, documentType, fileName }
```

### 8d. AI Chat

```mermaid
flowchart TD
    A["POST /ai/chat/generate { message, history?, chatId? }"] --> B["build DevMind persona system prompt"]
    B --> C["inject prior conversation context"]
    C --> D["generateFromAI()"]
    D --> E{"chatId provided?"}
    E -->|yes| F["persist user + assistant Message"]
    F --> G["update Chat.lastMessage; auto-title from first message"]
    E -->|no| H["return response only (no persistence)"]
    G --> I["respond"]
    H --> I
    S["POST/GET /ai/chat/sessions · GET/PATCH/DELETE /ai/chat/sessions/:chatId"] --> J["sessions type 'ai', scoped to participants (owner)"]
```

### 8e. AI Provider Selection (important + often misstated)

```mermaid
flowchart TD
    A["generateFromAI({ systemInstruction, prompt, temperature, maxTokens })"] --> B{"GROQ_API_KEY or GEMINI_API_KEY set?"}
    B -->|neither| X["throw: No AI service configured"]
    B -->|at least one| C{"prompt length > LARGE_PROMPT_CHARS?"}
    C -->|"yes (repo reviews, big docs)"| D["queue: Gemini first → Groq fallback"]
    C -->|"no (chat, small asks)"| E["queue: Groq first → Gemini fallback"]
    D --> F["for each provider: up to MAX_ATTEMPTS with backoff"]
    E --> F
    F --> G{"retryable? (429 / 503 / quota / empty response)"}
    G -->|yes| H["sleep and retry"]
    G -->|no| I["move to next provider"]
    H --> J{"success?"}
    I --> J
    J -->|yes| K["return text to service"]
    J -->|"all failed"| L["throw aggregated error listing every provider failure"]
```

> Note: the README simplifies this as "Groq first, Gemini fallback". The actual code prefers
> **Gemini for large prompts** and **Groq for small prompts**, always keeping the other as fallback.

---

## 9. Real-time (Socket.io)

```mermaid
sequenceDiagram
    autonumber
    participant C as socket.io-client
    participant S as Socket.io server
    participant NS as notificationService.create()

    C->>S: connect({ auth: { token: accessToken } })
    S->>S: io.use(socketAuthMiddleware) → jwt.verify → socket.data.userId
    alt invalid / missing token
        S-->>C: connect_error (rejected)
    else valid
        S->>S: socket.join('user:' + userId)
        NS->>S: emit to room 'user:<userId>'
        S-->>C: 'notification:new' → UI toast / badge
    end
```

Client helper (`client/src/services/socket.ts`): `connectSocket()` (reuses an existing socket),
`onNotificationNew(cb)`, `onAnalyticsUpdate(cb)`, `disconnectSocket()`.
Reconnection: 10 attempts, 1s → 5s backoff, transports `websocket` then `polling`.

---

## 10. End-to-End User Journey (everything combined)

```mermaid
flowchart TD
    A["Open app"] --> B{"Has valid accessToken?"}
    B -->|no| C["/auth/login"] --> C1["POST /auth/login"] --> C2["accessToken → localStorage"]
    C2 --> D
    B -->|yes| D["AuthGuard → AppLayout → /dashboard"]

    D --> E["GET /analytics · GET /notifications · sockets connect"]
    E --> F["/github — connect GitHub account"]
    F --> F1["OAuth popup (§6)"]
    F1 --> G["GET /github/repos (user token → private repos visible)"]
    G --> H["POST /github/repos/import"]

    H --> I["/github — start indexing"]
    I --> I1["POST /indexer/repos/:id/index (§7)"]
    I1 --> J["IndexReport completed"]

    J --> K1["/ai/chat — POST /ai/chat/generate"]
    J --> K2["/ai/code-review — POST /ai/code-review/:reportId"]
    J --> K3["/ai/docs — POST /ai/doc-generator/:reportId/generate"]
    K1 --> L["AI providers via generateFromAI (§8e)"]
    K2 --> L
    K3 --> L
    L --> M["Results rendered with react-markdown / Monaco / Chart.js"]
    M --> N["Notifications pushed live over Socket.io (§9)"]
```

---

## 11. API Surface (base `/api/v1`)

| Module | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `/auth/login` · `/auth/logout` · `/auth/refresh-token` · `PATCH /auth/change-password` · `POST /auth/forgot-password` · `/auth/reset-password` · `GET /auth/verify-email/:token` |
| GitHub | `GET /github/callback` *(public)* · `GET /github/auth/url` · `POST /github/auth/callback` · `/github/disconnect` · `/github/force-disconnect` · `GET /github/status` · `/github/repos` · `/github/repos/imported` · `POST /github/repos/import` · `DELETE /github/repos/imported/:id` · `POST /github/repos/sync` · `GET /github/repos/:owner/:repo` (+ `/branches`, `/commits`, `/pulls`, `/tree`) |
| Indexer | `POST /indexer/repos/:repositoryId/index` · `GET /indexer/reports/:reportId` (+ `/files`, `/files/:fileId`, `/chunks`) · `DELETE /indexer/reports/:reportId` |
| Repo Intelligence | `GET /ai/repo-intelligence/questions` · `/status` · `/reports` · `POST /ai/repo-intelligence/query` · `/ai/repo-intelligence/:reportId/ask` |
| Code Review | `POST /ai/code-review/review` · `/ai/code-review/:reportId` · `GET /ai/code-review/shared/:token` *(public)* · history routes |
| Doc Generator | `GET /ai/doc-generator/types` · `POST /ai/doc-generator/generate` · `/ai/doc-generator/:reportId/generate` |
| Chat | `POST/GET /ai/chat/sessions` · `GET/PATCH/DELETE /ai/chat/sessions/:chatId` · `POST /ai/chat/generate` |
| Analytics / Upload / Health | `GET /analytics` · `POST /upload/single` · `/upload/multiple` · `DELETE /upload/delete` · `GET /health`, `/health/ping` |

---

## 12. Data Models (MongoDB)

| Collection | Purpose | Key fields / indexes |
|---|---|---|
| `User` | Accounts | unique email/username, bcrypt password, role, verification/reset tokens (TTL), `refreshToken` |
| `Chat` / `Message` | AI chat | `type`, `participants[]`, `role`, `type` |
| `GitHubAccount` | OAuth identity | `userId` unique, `githubId`, `accessToken`, `scopes`, `isConnected`, rate-limit tracking |
| `OAuthState` | OAuth CSRF state | unique `state`, TTL index (10 min) |
| `ImportedRepository` | Saved repos | unique `(userId, githubId)`, `fullName`, stars/forks, permissions |
| `IndexReport` | One per index run | `status`, `summary`, `techStack`, `folderStructure`, counts |
| `IndexedFile` | File metadata | unique `(reportId, path)`, functions/classes/imports/exports/dependencies |
| `IndexedChunk` | Code fragments | `(reportId, fileId, index)`, `content`, `type`, `tokenCount` |
| `Notification` / `Upload` | Alerts & uploads | — |

All models serialize `id` (string) instead of `_id`/`__v`, and strip secrets
(`password`, `refreshToken`, `accessToken`, verification tokens).

---

## 13. Security Checklist (mapped to code)

| Concern | Implementation |
|---|---|
| Headers | `helmet()` in `app.ts` |
| CORS | whitelisted `CLIENT_URL`, `credentials: true` |
| Rate limits | global 200/15min · login 10/15min · register 5/15min |
| Validation | Joi `validate()` before controllers |
| Auth | `authenticate` verifies JWT; `authorize(...roles)` for RBAC |
| Errors | `globalErrorHandler` — stack traces logged server-side, never returned |
| OAuth CSRF | random `state`, bound to user, one-time use, 10-min TTL |
| Data isolation | every query filtered by `userId`; socket rooms per user |
| Body limits | 10 MB JSON / url-encoded |
| Deploy | `render.yaml`: API service (`/api/v1/health`) + static SPA with `/index.html` rewrite |
