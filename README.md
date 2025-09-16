DocBot - Smart Document Assistant

DocBot is a document-aware chat application that implements Retrieval-Augmented Generation (RAG). Upload documents (PDF, DOCX/DOC, TXT, Markdown, RTF, ODT), then ask questions and get answers grounded in the uploaded content. The app extracts text, builds embeddings, retrieves relevant chunks, and generates concise answers with source snippets.

## Features

- Authentication: register, email verification via OTP, login, refresh token, logout, password reset (OTP-based)
- Secure cookies: HttpOnly, SameSite=None, Secure
- Document handling: drag-and-drop upload, multi-file support, server-side size limit 20 MB per file
- Retrieval-Augmented Generation (RAG): embeddings + similarity search over file chunks, followed by LLM generation
- Chat sessions: create, rename, list, delete; per-session files and messages
- AI answers using Groq API with document-grounded context
- Modern frontend with light/dark theme

## Architecture

- Frontend: vanilla HTML/CSS/JS under `client/` with a small `APIClient` wrapper; served locally by a Node HTTPS server for cookie-secure flows
- Backend: FastAPI app under `server/` with routers, controllers, services, and Supabase models
- Storage/DB: Supabase (PostgreSQL + Storage); schema in `server/database/supabase-schema.sql`
- Embeddings: calls a hosted Gradio endpoint `BienKieu/sentence-embedding` to produce 384-d vectors
- LLM: Groq Chat Completions API (model `openai/gpt-oss-120b`) for answer generation

## Project Structure

```
DocBot/
├── client/                 # Frontend (HTML, CSS, JS)
│   ├── app/                # Main app UI
│   ├── login/              # Auth pages
│   └── shared/             # API client
├── server/                 # Backend (FastAPI)
│   ├── controllers/        # HTTP controllers
│   ├── models/             # Supabase client + DB access
│   ├── routes/             # FastAPI routes
│   ├── services/           # Business logic
│   ├── database/           # SQL schema
│   ├── app.py              # Vercel entry
│   └── server.py           # Local uvicorn with HTTPS
├── certs/                  # Local HTTPS self-signed certs
├── https-server.js         # Local HTTPS static server for client
├── vercel.json             # Vercel config (Python + static)
└── requirements.txt        # Python deps
```

## Prerequisites

- Node.js 16+
- Python 3.11 recommended (as in vercel.json); 3.9+ likely works
- A Supabase project (URL, service key, Storage bucket)
- Groq API key
- Optional: Tesseract OCR installed locally if you expect OCR for image-based PDFs (pytesseract + pdf2image are included; also requires poppler for pdf2image)

## Environment Variables

Create a `.env` file in `server/` with at least:

- SUPABASE_URL
- SUPABASE_KEY
- SUPABASE_BUCKET (default: chat-files)
- SUPABASE_JWT_SECRET (used to sign/verify access tokens)
- SMTP_HOST (optional, for sending emails)
- SMTP_PORT (optional, default 587)
- SMTP_USER (optional)
- SMTP_PASSWORD (optional)
- GROQ_API_KEY (required by the Groq SDK)

Note: If SMTP is not configured, the app will still proceed and show messages instructing the user to check the OTP; email sending will be effectively skipped.

## Install Dependencies

Backend (Python):

```bash
pip install -r requirements.txt
```

Frontend (Node for local HTTPS static server only):

```bash
npm install
```

## Run Locally

1) Start the backend (HTTPS via uvicorn using local certs):

```bash
cd server
python server.py
```

This binds to https://localhost:8000 using `certs/cert.pem` and `certs/key.pem`.

2) Start the frontend static server over HTTPS (for secure cookies in the browser):

```bash
node https-server.js
```

This serves the client at https://localhost:5501 and proxies no requests; the client calls the FastAPI server directly via absolute paths configured in `client/shared/api-client.js` (baseURL is empty, so the browser origin is used; when opened from https://localhost:5501 it will call https://localhost:5501/... unless you set window.API_BASE_URL).

Tip: If you want to point the web app to the FastAPI backend on port 8000, set in the browser console before navigating: `window.API_BASE_URL = 'https://localhost:8000'`.

3) Open the app

- Navigate to https://localhost:5501/login to sign in
- The main app is at https://localhost:5501/app

## Database Schema

See `server/database/supabase-schema.sql`. It defines tables for users, refresh tokens, OTP codes, chat sessions, files, session-file links, chat messages, and file chunks with a 384-d vector column. There are RLS policies and indexes, including ivfflat index for vector cosine similarity.

## API Endpoints

Base path depends on deployment. Locally with uvicorn, it is https://localhost:8000.

Authentication (`/user`):

- POST /user/register { email, password }
- POST /user/verify { email, otp_code }
- POST /user/login { email, password } → sets cookies: access_token, refresh_token
- POST /user/refresh-token { refresh_token? } or from cookie
- POST /user/forgot-password { email }
- POST /user/reset-password { email, otp_code, new_password }
- POST /user/resend-verification { email }
- POST /user/logout
- GET /user/profile (requires access_token cookie)

Chat (`/chat`):

- GET /chat/user/
- POST /chat/create?title=New%20Chat
- GET /chat/user/{user_id} (internal/testing)
- GET /chat/file/{file_id}
- GET /chat/session/{chat_id}
- GET /chat/session/{chat_id}/messages
- GET /chat/session/{chat_id}/files
- POST /chat/session/{session_id}/upload (multipart form-data, field name: file)
- POST /chat/session/{chat_id}/messages { role, content }
- POST /chat/session/{chat_id}/process { user_message }
- PUT /chat/session/{chat_id}/rename { new_name }
- DELETE /chat/session/{chat_id}
- DELETE /chat/file/{file_id}

Health:

- GET /health → { ok: true }

## RAG pipeline

1) Ingestion: file is uploaded to Supabase Storage; metadata is stored and linked to a chat session.
2) Text extraction: backend downloads the file and extracts text (pdfplumber/DOCX/TXT/MD, optional OCR for image PDFs with pytesseract/pdf2image).
3) Indexing: text is split into overlapping chunks and embedded (384-d) via a Gradio-hosted sentence embedding model; embeddings are stored in Postgres (pgvector) as `file_chunks`.
4) Retrieval: a user query is embedded and the most similar chunks are retrieved using cosine similarity.
5) Generation: retrieved snippets are composed into a prompt and sent to Groq Chat Completions; the generated answer is stored along with the conversation.

## Deployment (Vercel)

`vercel.json` configures:

- Python serverless function at `server/app.py` (runtime: Python 3.11)
- Static hosting for everything under `client/`
- Routes mapping `/chat/*`, `/user/*`, `/health` to the Python app, and `/login`, `/app` to static files.

Environment variables must be set in Vercel Project Settings. Ensure GROQ_API_KEY and Supabase variables are configured. If you rely on OCR, Vercel’s Python runtime may not have system packages for Tesseract/Poppler; consider disabling OCR or hosting that part elsewhere.

## Troubleshooting

- 401 from API on first request: the client auto-attempts a refresh; ensure cookies are sent over HTTPS and you are using https://localhost origins.
- Email not received: verify SMTP variables; if not configured, the backend still returns success with a note that email may be unavailable.
- Large file errors: the server enforces a 20 MB limit and will return 413.
- Empty or image-only PDFs: install Tesseract and Poppler locally to enable OCR fallback, or provide text-based PDFs.
- CORS: `server/app.py` allows `*` in serverless, and `server/server.py` whitelists localhost:5501 for local HTTPS testing.

## License

MIT

## Acknowledgments

- FastAPI
- Supabase
- Groq
- pdfplumber, python-docx, pytesseract, pdf2image
