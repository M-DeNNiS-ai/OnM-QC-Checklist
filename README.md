# Battery QC — proper backend deployment

This package keeps the existing Battery QC front-end and adds a real Node.js/Express backend with a SQLite database, authenticated server sessions, role-based permissions, audit logging, and database backup.

## What stays
- Existing single-page Battery QC UI and workflows.
- O&M 3-stage chain and CAPA logic.
- Plant, Inventory and Quality sectors.
- FPY calculations and Chart.js dashboards.
- Excel export.
- Light/dark UI.

## What is added
- Persistent SQLite database: `data/battery-qc.sqlite`.
- Express API under `/api`.
- HttpOnly session cookie using JWT.
- Server-side role permissions.
- Audit log for login/read/write/backup events.
- Merge-safe writes by record ID, reducing multi-user overwrite risk.
- Health endpoint: `/api/health`.
- Admin backup endpoint: `/api/backup`.
- `.env` configuration for secrets/PINs.

## Install on Windows
1. Install Node.js 20 LTS or newer.
2. Open Command Prompt in this folder.
3. Run:
   `npm install`
4. Copy `.env.example` to `.env`.
5. Change `JWT_SECRET` and all PINs before production use.
6. Start:
   `npm start`
7. Open:
   `http://localhost:3000`

## Important
Do not commit `.env` or `data/battery-qc.sqlite` to GitHub if it contains operational data. Add both to `.gitignore`.

## GitHub
The repository should contain `public/index.html`, `server.js`, `package.json`, `.env.example`, `.gitignore`, and `README.md`. The live database should remain on the server/PC.
