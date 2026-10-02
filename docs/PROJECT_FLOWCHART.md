# DevMind AI — Master Project Flowchart

One consolidated chart of how the whole project works, traced from the real source
(`client/src`, `server/src`, `server/src/app.ts`, `server/src/routes/index.ts`).

---

## Master Flow (end to end)

```mermaid
flowchart TD
    U(["User opens the app in a browser"]) --> BOOT

    subgraph CLIENT["CLIENT - React 19 + Vite - port 5173"]
        direction TB
        BOOT["main.tsx<br/>QueryClientProvider + BrowserRouter"] --> ROUTES["routes/index.tsx"]
        ROUTES --> PUB["Public routes<br/>login / register / forgot-password<br/>reset-password / verify-email<br/>github callback / shared review"]
        ROUTES --> GUARD{"AuthGuard<br/>accessToken present?"}
        GUARD -- "no" --> PUB
        GUARD -- "yes" --> LAYOUT["AppLayout - sidebar + header"]
        LAYOUT --> PAGES["Pages<br/>Dashboard / GitHub / AI Chat<br/>Code Review / Docs / Analytics"]
        PAGES --> SVC["services/* and page-level calls"]
        SVC --> AX["apiClient - axios<br/>baseURL /api/v1 + withCredentials"]
        AX --> REQINT["Request interceptor<br/>Authorization: Bearer accessToken"]
        PAGES -.-> ZUSTAND["Zustand - auth, ui state"]
        PAGES -.-> RQ["React Query cache - staleTime 5 min"]
        PAGES -.-> SOCKC["socket.io-client"]
    end

    REQINT --> HTTP["HTTP request<br/>method + path + JSON body"]
    HTTP --> MW

    subgraph SERVER["SERVER - Express 4 - port 5000"]
        direction TB
        MW["Middleware chain<br/>helmet → cors CLIENT_URL → rate limit<br/>→ json 10mb → compression → morgan"]
        MW --> HEALTH{"path = /api/v1/health ?"}
        HEALTH -- "yes" --> OK["200 health payload (skips limiter)"]
        HEALTH -- "no" --> ROUTER["routes/index.ts → module router"]
        ROUTER --> CHAIN["validate Joi → authenticate JWT → asyncHandler"]
        CHAIN --> CTRL["Controller - thin HTTP layer"]
        CTRL --> SERVICE["Service - business logic"]
        SERVICE --> DOMAIN["Domain modules<br/>indexer · repo-intelligence<br/>code-review · doc-generator"]
        SERVICE --> MODELS["Mongoose models"]
        CHAIN -.->|"invalid input / bad token"| ERR["globalErrorHandler"]
        CTRL -.->|"rejected promise"| ERR
        SERVICE -.->|"throws"| ERR
    end

    MODELS --> DB[("MongoDB<br/>User · Chat · Message · GitHubAccount<br/>ImportedRepository · IndexReport<br/>IndexedFile · IndexedChunk · OAuthState")]
    DOMAIN --> GH["GitHub API - Octokit<br/>repos · branches · commits · zipball"]
    DOMAIN --> AIP["AI providers<br/>Groq ↔ Gemini auto-fallback"]
    SERVICE --> EXT["Cloudinary - uploads<br/>Nodemailer - email"]

    OK --> RESP["ApiResponse envelope<br/>success: true/false, message, data | errors"]
    ERR --> RESP
    DB --> RESP
    GH --> RESP
    AIP --> RESP
    EXT --> RESP

    RESP --> RESPINT["Response interceptor<br/>401 → refresh token → retry<br/>other errors → toast"]
    RESPINT --> RENDER["Render result<br/>markdown · Monaco · Chart.js · toasts"]
    RENDER --> U

    SOCKC <-->|"WebSocket + JWT handshake"| SOCKSRV["Socket.io server<br/>room user:userId"]
    SOCKSRV --> NOTIF["notificationService<br/>emit notification:new"]
    NOTIF --> RENDER

    classDef clientStyle fill:#1e3a8a,stroke:#60a5fa,color:#e5edff
    classDef serverStyle fill:#14532d,stroke:#4ade80,color:#e8fff1
    classDef dataStyle fill:#78350f,stroke:#fbbf24,color:#fff7e6
    classDef extStyle fill:#4c1d95,stroke:#a78bfa,color:#f3ecff

    class BOOT,ROUTES,PUB,GUARD,LAYOUT,PAGES,SVC,AX,REQINT,ZUSTAND,RQ,SOCKC clientStyle
    class MW,HEALTH,OK,ROUTER,CHAIN,CTRL,SERVICE,DOMAIN,MODELS,ERR serverStyle
    class DB,RESP dataStyle
    class GH,AIP,EXT,SOCKSRV,NOTIF extStyle
```

---

## Request Lifecycle (sequence view)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant P as React Page
    participant A as Axios apiClient
    participant E as Express app.ts
    participant M as validate + authenticate
    participant C as Controller
    participant S as Service
    participant D as MongoDB
    participant X as GitHub / AI

    U->>P: click / submit
    P->>A: apiClient.post(path, body)
    A->>A: attach Authorization: Bearer token
    A->>E: HTTP request
    E->>E: helmet → cors → rate limit → parse → compress
    E->>M: matched module router
    M->>M: Joi validate body/params
    M->>M: jwt.verify → req.user
    M->>C: next()
    C->>S: service.method(params, userId)
    S->>D: query scoped by userId
    S->>X: external call when needed
    X-->>S: token / AI text / repo data
    S-->>C: domain result
    C-->>A: 200 success envelope
    A-->>P: response.data.data
    P-->>U: render + toast
    Note over E,M: any failure → globalErrorHandler → success:false, message
    Note over A: 401 → POST /auth/refresh-token → retry original request
```

---

## Plain-text version (for terminals / no renderer)

```
USER
 └─> CLIENT (React 19 + Vite, :5173)
      main.tsx -> Router -> AuthGuard -> Pages
        Pages -> services/page calls
              -> apiClient (axios) -> request interceptor adds Bearer token
              -> Zustand (auth/ui)  -> React Query (server cache)
              -> socket.io-client (live notifications)
 └─> NETWORK  HTTP /api/v1  +  WebSocket (JWT handshake)
 └─> SERVER (Express 4, :5000)
      helmet -> cors -> rate-limit -> json(10mb) -> compression -> morgan
        -> /api/v1/health  (short-circuits)
        -> routes/index.ts -> module router
             -> validate(Joi) -> authenticate(JWT) -> asyncHandler(controller)
                  -> controller (thin)
                  -> service (business logic)
                       -> domain modules: indexer / repo-intelligence /
                                          code-review / doc-generator
                       -> Mongoose models
                  -> success envelope { success, message, data }
             -> globalErrorHandler { success:false, message }
 └─> DATA & EXTERNAL
      MongoDB: User, Chat, Message, GitHubAccount, ImportedRepository,
               IndexReport, IndexedFile, IndexedChunk, OAuthState
      GitHub (Octokit)   AI: Groq <-> Gemini   Cloudinary   Nodemailer
 └─> RESPONSE back up the same path (401 -> refresh -> retry)
 └─> REALTIME: Socket.io room user:<userId> pushes notification:new
```

---

## How to read it

| Band | Meaning |
|---|---|
| **CLIENT** | Everything that runs in the browser. Only ever speaks HTTP + WebSocket. |
| **SERVER** | The only component holding secrets. Layer order is fixed: middleware → route → controller → service → model. |
| **DATA** | MongoDB collections; every query is scoped by `userId`. |
| **EXTERNAL** | Third-party systems the server calls on the user's behalf. |
