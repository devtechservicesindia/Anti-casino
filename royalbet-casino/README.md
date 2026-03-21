# 🎰 RoyalBet Casino – Monorepo

A full-stack online casino platform built with a modern, scalable architecture.

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React 18, Vite 5, TailwindCSS 3, Framer Motion 11 |
| Game UI    | PixiJS 8 (Slots + Roulette rendering)           |
| Mobile     | Flutter 3, Dart 3                               |
| Backend    | Node.js 20 LTS, Express.js 4, Socket.io 4      |
| Database   | PostgreSQL 16, Prisma ORM 5                     |
| Cache      | Redis 7                                         |
| Payments   | Razorpay Node SDK 2                             |
| Hosting    | Google Cloud Run (backend), Firebase Hosting (frontend) |

---

## Monorepo Structure

```
royalbet-casino/
├── frontend/          # React + Vite web app
├── backend/           # Node.js + Express API
├── mobile/            # Flutter mobile app
├── admin/             # Admin dashboard (React)
└── .github/workflows/ # CI/CD pipelines
```

---

## Prerequisites

- Node.js 20 LTS (`https://nodejs.org`)
- npm 10+
- PostgreSQL 16
- Redis 7
- Flutter SDK 3 + Dart SDK 3 (`https://flutter.dev`)
- Google Cloud SDK (for deployment)
- Firebase CLI (for frontend hosting)

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-org/royalbet-casino.git
cd royalbet-casino
```

### 2. Install all Node.js dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp backend/.env.example backend/.env
# Fill in all values in backend/.env
```

### 4. Initialize the database

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Start development servers

```bash
# Frontend (http://localhost:5173)
npm run dev:frontend

# Backend (http://localhost:4000)
npm run dev:backend

# Admin (http://localhost:5174)
npm run dev:admin
```

### 6. Flutter mobile app

```bash
cd mobile
flutter pub get
flutter run
```

---

## CI/CD

GitHub Actions workflows are located in `.github/workflows/`:

- `ci.yml` – Lint, test, and build all packages on every push/PR

---

## Deployment

| Service         | Platform            |
|-----------------|---------------------|
| Frontend        | Firebase Hosting    |
| Admin           | Firebase Hosting    |
| Backend API     | Google Cloud Run    |
| Database        | Cloud SQL (PG 16)   |
| Cache           | Memorystore (Redis) |

---

## License

UNLICENSED – Proprietary software. All rights reserved.
