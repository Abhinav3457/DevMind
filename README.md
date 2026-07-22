# 🧠 DevMind AI

> Full Stack AI Software Engineer Workspace

DevMind AI is a production-ready, full-stack workspace that enables developers to interact with AI to write, review, and manage code — all from a browser-based IDE powered by Monaco Editor and Google's Gemini AI.

---

## 🏗️ Architecture

```
DevMind AI/
├── client/          # React 19 + Vite + TypeScript + Tailwind CSS
├── server/          # Express.js + MongoDB + TypeScript
├── docs/            # Documentation
├── package.json     # Root workspace scripts
└── README.md
```

### Frontend (`client/`)

| Layer | Technology |
|-------|------------|
| UI Framework | React 19 |
| Build Tool | Vite 6 |
| Language | TypeScript 5.7 |
| Styling | Tailwind CSS 3.4 |
| Routing | React Router DOM 7 |
| State Management | Zustand 5 |
| Server State | TanStack React Query 5 |
| Forms | React Hook Form + Zod |
| Editor | Monaco Editor |
| Animations | Framer Motion |
| Charts | Chart.js + react-chartjs-2 |
| HTTP Client | Axios |
| Real-time | Socket.io Client |
| Notifications | React Hot Toast |

### Backend (`server/`)

| Layer | Technology |
|-------|------------|
| Runtime | Node.js |
| Framework | Express.js 4 |
| Language | TypeScript 5.7 |
| Database | MongoDB + Mongoose 8 |
| Auth | JWT + bcryptjs |
| Real-time | Socket.io 4 |
| AI | Google Gemini API + LangChain |
| Vector DB | ChromaDB (integration ready) |
| File Upload | Multer + Cloudinary |
| Email | Nodemailer |
| GitHub | Octokit (GitHub REST API) |

### Design Patterns

- **MVC Architecture** — Controllers, Services, Models
- **Service-Repository Pattern** — Business logic & data access separation
- **SOLID Principles** — Single responsibility, Dependency inversion, etc.
- **Clean Architecture** — Separation of concerns at every layer

---

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **MongoDB** >= 6.0 (local or Atlas)
- **Git**

---

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd devmind-ai
npm run install:all
```

### 2. Configure Environment Variables

**Server:**
```bash
cp server/.env.example server/.env
# Edit server/.env with your values
```

Key variables to configure:
- `MONGODB_URI` — Your MongoDB connection string
- `JWT_SECRET` — Secret key for JWT tokens
- `GEMINI_API_KEY` — Google Gemini API key
- `CLOUDINARY_*` — Cloudinary credentials (for file uploads)
- `GITHUB_TOKEN` — GitHub personal access token
- `SMTP_*` — Email server credentials

**Client:**
```bash
cp client/.env.example client/.env
```

### 3. Start Development

```bash
# Start both client and server in development mode
npm run dev

# Or start them individually:
npm run dev:client   # Vite dev server on port 5173
npm run dev:server   # Express dev server on port 5000
```

### 4. Build for Production

```bash
npm run build
npm start
```

---

## 📜 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both client & server in dev mode |
| `npm run dev:client` | Start Vite dev server (port 5173) |
| `npm run dev:server` | Start Express dev server with nodemon (port 5000) |
| `npm run build` | Build both client and server |
| `npm run build:client` | Build client for production |
| `npm run build:server` | Build server TypeScript |
| `npm run start` | Start production server |
| `npm run install:all` | Install all dependencies (root + client + server) |
| `npm run lint` | Lint both client and server |
| `npm run format` | Format code with Prettier |

---

## 📁 Project Structure

### Client (`client/`)

```
src/
├── api/            # Axios instance & React Query client
├── assets/         # Images, icons
├── components/     # Reusable UI components
│   ├── ui/         # Low-level UI primitives
│   ├── common/     # Shared components
│   ├── editor/     # Monaco editor components
│   ├── chat/       # AI chat components
│   ├── auth/       # Auth-related components
│   ├── layout/     # Layout components
│   └── dashboard/  # Dashboard components
├── constants/      # App constants
├── context/        # React context providers
├── hooks/          # Custom hooks
├── pages/          # Page components
├── routes/         # Route configuration
├── services/       # API service functions
├── store/          # Zustand state management
├── styles/         # Global styles
├── types/          # TypeScript types/interfaces
└── utils/          # Utility functions
```

### Server (`server/`)

```
src/
├── ai/             # AI service integrations
├── config/         # App configuration (DB, auth, external services)
├── constants/      # Application constants
├── controllers/    # Route handlers
├── database/       # Database utilities
├── github/         # GitHub API integrations
├── helpers/        # Helper functions
├── middlewares/     # Express middlewares (auth, validation, error handling)
├── models/         # Mongoose models
├── repositories/   # Data access layer
├── routes/         # Express route definitions
├── services/       # Business logic layer
├── socket/         # Socket.io event handlers
├── uploads/        # File upload directory
├── utils/          # Utility functions
└── validators/     # Joi validation schemas
```

---

## 🛡️ Security

- Helmet.js for HTTP security headers
- CORS with whitelisted origins
- Rate limiting on API routes
- JWT-based authentication with refresh tokens
- Password hashing with bcryptjs
- Input validation with Joi
- File upload type & size restrictions

---

## 🧪 Tech Stack

**Frontend:** React 19, Vite 6, TypeScript 5.7, Tailwind CSS 3.4, Zustand 5, TanStack Query 5, Monaco Editor, Framer Motion, Chart.js

**Backend:** Node.js, Express 4, TypeScript, MongoDB + Mongoose 8, JWT, Socket.io 4, Google Gemini AI, LangChain, ChromaDB, Octokit (GitHub)

**Dev Tools:** ESLint, Prettier, Husky, Lint-Staged, Nodemon, Concurrently

---

## 📄 License

MIT

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
