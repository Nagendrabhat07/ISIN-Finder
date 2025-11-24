# ISIN Extractor

Full-stack JavaScript application that extracts every ISIN code from any publicly accessible PDF link. Paste the PDF URL in the frontend, the backend downloads it, parses the text, and returns the detected ISINs.

## Tech Stack

- **Frontend:** React + Vite, plain CSS
- **Backend:** Node.js, Express, pdf-parse, axios
- **Tooling:** Concurrently for combined dev workflow

## Prerequisites

- Node.js 18+ and npm

## Quick Start

Clone or download this repository, then install dependencies in the root, client, and server folders:

```bash
# from the project root
npm install           # installs root dev tooling (concurrently)
cd server && npm install && cd ..   # backend deps
cd client && npm install && cd ..   # frontend deps
```

### Run both apps together

```bash
npm run dev
```

This launches:

- Backend API: `http://localhost:4000`
- Vite frontend: `http://localhost:5173`

### Run backend only

```bash
cd server
npm start
```

### Run frontend only

```bash
cd client
npm run dev
```

Visit `http://localhost:5173` in your browser. Paste a PDF URL, press **Extract ISIN**, and the UI will show the number of codes plus the full list.

## API Overview

- `GET /health` → `{ "status": "ok" }`
- `POST /extract-isin` → body `{ "pdfUrl": "https://..." }`, response `{ pdfUrl, isins: [], count }`

Errors return helpful messages such as `pdfUrl is required` or `Failed to process the PDF`.

## Deployment

This app can be deployed to Render. See [DEPLOY.md](./DEPLOY.md) for detailed deployment instructions.

### Quick Deploy to Render

1. Push your code to GitHub
2. Create a new Blueprint on Render and connect your repo
3. Render will auto-detect `render.yaml` and create both services
4. Set environment variables:
   - Backend: `FRONTEND_URL` = your frontend URL
   - Frontend: `VITE_API_URL` = your backend URL
5. Redeploy both services

For step-by-step instructions, see [DEPLOY.md](./DEPLOY.md).

