# Blend Field

Job tracking for Blend Property maintenance: the office creates and assigns jobs, and the field team works them on their phones (status, photos, customer signature).

Planning docs live in `../replica/ramtracking/` (recon, architecture, schema, design system, build log).

| Folder | What |
| --- | --- |
| `web/` | Next.js 15 office app, plus the API the field app calls (`/api/field/*`) |
| `field/` | Expo SDK 58 field app (iOS, Android, web) |
| `design/` | `tokens.json` → `node design/build-tokens.mjs` → web CSS + Tailwind theme and field theme |

## Run it (M0)

```
cd web && npm install && npm run dev        # http://localhost:3000, sign in as "Naledi (office)"
cd field && npm install && npm run web      # http://localhost:8081, sign in as an engineer
```

M0 uses a fake data store at `web/.data/db.json` (delete it to reseed) and dev sign-in (`DEV_AUTH=1` in `web/.env.development`). Neither works in production; Supabase replaces both in `/replica-backend`.

For a phone on the same Wi-Fi, set `EXPO_PUBLIC_API_URL=http://<your-pc-ip>:3000` before `npx expo start`.
