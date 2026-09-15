# Battery QC Vercel update

## What changed
- Added record-level `POST`, `PATCH`, and `DELETE` operations to `/api/data/:key`.
- Kept `GET` and legacy `PUT` for compatibility.
- Changed the frontend `saveStore()` to synchronize individual records instead of replacing an entire store.
- Added clearer HTTP status information to API errors.
- This prevents one device from overwriting another device's latest records with a stale full-array snapshot.

## Deploy
1. Commit and push these files to the `main` branch.
2. Vercel should create a new deployment automatically if Git integration is connected.
3. Confirm the deployment is `Ready`.
4. Hard refresh the production app.
5. Log in and create/edit a test record.
6. In DevTools > Network, saves should use `POST`, `PATCH`, or `DELETE` under `/api/data/...`, not full-store `PUT`.

## Important
Keep production secrets only in Vercel Environment Variables. Do not commit `.env` or secret keys.
