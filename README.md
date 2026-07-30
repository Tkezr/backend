# WholeLexora Backend

This backend serves the Lexora frontend with dummy in-memory data and optional Gemini integration.

Quick start (local):

```bash
cd backend
npm install
npm run dev    # fast dev using ts-node
```

Production build:

```bash
cd backend
npm install --production=false
npm run build
npm start
```

Docker:

```bash
docker build -t wholelexora-backend:latest .
docker run -p 4000:4000 --env-file .env --rm wholelexora-backend:latest
```

Set `GEMINI_API_KEY` and `GEMINI_API_URL` in your environment to enable real model calls.
