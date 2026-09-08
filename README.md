# AWS SBG MEC Live Q and A

Live anonymous Q and A for AWS Student Builder Group events at Mailam Engineering College.

Audience phones post questions. Projector shows the live wall. One hidden moderator approves posts. No sign in for audience. No answers stored in this version.

Stack: React 19 + Vite 8 + TypeScript + plain CSS + Firebase Firestore + Firebase Auth.

## Purpose

This app runs a live hall Q and A without passing a mic or collecting names.

Use it when you have a projector, a host laptop, and a hall full of phones on mixed college WiFi.

## How a live event runs

QR flow for the host:

1. Open `/wall` on the projector laptop. Keep it full screen.
2. Show a QR code that points to `/` on the same deployment. Most hosts print it on a slide and tape it to chairs.
3. Audience scans, lands on Ask, posts anonymously as `anon-XXXX`, waits for moderation.
4. Moderator opens `/admin` on a second device, approves or features posts.
5. Wall updates live. Audience upvotes once per device to push good questions up.

Routes:

| Route | Who | What |
|-------|-----|------|
| `/` | Audience | Ask form, 2 to 280 chars, pending until approved |
| `/wall` | Projector | Live approved and featured questions, sorted featured first then votes |
| `/admin` | Moderator only | Hidden route, no nav link, sign in required in live mode |

Rules at a glance:

| Rule | Value |
|------|-------|
| Identity | Random `anon-XXXX`, no name or login |
| Length | 2 to 280 chars, emails and phones masked |
| Post rate | Max 3 posts per minute per browser, client checked |
| Upvote | Once per device per question, triple checked by local list plus vote doc plus rules |
| Status changes | Admin only, enforced by Firestore rules |
| Answers | None stored or shown in this version |

## Live mode only

| State | When | Data | Auth |
|------|------|------|------|
| Live | All required `VITE_FIREBASE_*` keys set | Firestore `questions` collection | Firebase Auth plus admin allowlist |
| Not configured | Firebase env missing or placeholder | Zero rows, config-required error | `/admin` shows setup panel, no local moderation |

Missing env shows: `Live setup required: Firebase env is missing.` No seed rows, no browser-only posts. Fill `.env` and restart to go live.

## Host setup, 10 minutes

This is the full path from clone to projector.

```bash
npm install
cp .env.example .env
npm run dev
```

Then in order:

1. Fill `.env` with live keys. See Config below.
2. Deploy rules and indexes. See Firebase below.
3. Create admin user and grant access. See Admin below.
4. Run `npm run dev` for rehearsal or `npm run build` for the projector build.
5. Open `/admin` and approve one test post. Open `/wall` and confirm it shows.

If step 5 works, you are ready for the hall.

## Setup

### 1. Install

```bash
npm install
npm run dev
```

`npm run dev` starts Vite on `http://localhost:5173` [inferred, standard Vite default, verify on first run].

Build for hosting:

```bash
npm run build
npm run preview
```

`dist/` is the static output. Host it on Firebase Hosting or any static host.

### 2. Config

Copy the example and fill live values:

```bash
cp .env.example .env
```

Never commit `.env`. It is already ignored.

| Key | Required for live | Notes |
|-----|-------------------|-------|
| `VITE_FIREBASE_API_KEY` | Yes | From Firebase console, project settings |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Usually `{project}.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Must match Firestore project |
| `VITE_FIREBASE_APP_ID` | Yes | From Firebase console, web app entry |
| `VITE_FIREBASE_STORAGE_BUCKET` | No | Optional for this Firestore only build |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | No | Optional for this Firestore only build |
| `VITE_POLL_INTERVAL_MS` | No | Default 5000, minimum 2000 |

Live mode needs API key plus auth domain plus project ID plus app ID. If any one is missing or still contains words like `placeholder` or `example`, the app shows the live-required error with zero rows [verified in `src/lib/firebase.ts` and `src/hooks/useQuestions.ts`].

### 3. Firebase

Deploy rules and composite indexes:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

Or together:

```bash
firebase deploy --only firestore
```

Files used:

| File | Purpose |
|------|---------|
| `firestore.rules` | Anonymous may create pending only and bump `upvote_count` by 1 on live docs. Admin has full write. Vote reads admin only. |
| `firestore.indexes.json` | Composite index on `status` plus `created_at`, and on `status` plus `upvote_count` plus `created_at`. Wall query needs the first one. |
| `firebase.json` | Points deploy to the two files above. |

If you skip indexes, the wall query `where(status in [approved, featured])` plus `orderBy(created_at)` fails with a missing index error. The console link in the error creates it in one click, but deploy before doors open.

### 4. Admin access, manual

There is no sign up page. Do this once in the Firebase console [verified in `src/pages/Admin.tsx` and `.env.example`]:

1. Create a user in Firebase Auth with email and password.
2. Grant admin one of two ways:
   - Option A, custom claim: `firebase auth:set-custom-user-claims <uid> '{"is_admin": true}'`
   - Option B, allowlist doc: create `admins/{uid}` with any field, for example `{ "email": "host@example.com" }`
3. Sign in at `/admin` with that email and password.
4. First admin must be bootstrapped by someone with console access. Later admins can be added from `/admin` session plus console.

Keep `/admin` URL private. It is not linked in the top nav. Share it only with moderators.

## Moderation steps

Open `/admin` on a phone or second laptop.

| Action | Effect on wall |
|--------|----------------|
| Approve | Post goes live under voted list |
| Feature | Post pins to top featured section |
| Unfeature | Post returns to voted list |
| Reject or Remove | Post leaves wall at once |

Flow per question: pending queue, then live list, then projector. Rejected posts stay in Firestore but never query on `/wall`.

If an action fails with `Moderation failed. Check rules / admin allowlist`, recheck claim or `admins` doc and redeploy rules.

## Projector and college WiFi

College WiFi often blocks websockets and captive portals break live sockets.

This app already handles that:

- Firestore uses `experimentalForceLongPolling: true` [verified in `src/lib/firebase.ts`].
- Wall also polls every 5 seconds and has a `Refresh now` button [verified in `src/pages/Wall.tsx` and `src/hooks/useQuestions.ts`].
- Last sync time shows next to the LIVE count so the host sees staleness.

Fallback plan if the wall stalls:

1. Click `Refresh now`.
2. Toggle laptop hotspot for the projector only, keep audience on college WiFi.
3. Lower `VITE_POLL_INTERVAL_MS` to 5000 or higher, never below 2000 to avoid quota burn.
4. Keep a second tab of `/wall` open so a reload is instant.

Wall text is projector sized. Featured posts render in a larger grid.

## Known limits

| Limit | What happens | Workaround |
|-------|--------------|------------|
| Vote spam | Upvote dedup is device based: localStorage plus one vote doc per voter hash. A user who clears storage or switches browser can vote again. Accepted for college event scale. | Moderator watches counts, features best questions manually. |
| Post spam | Client rate limit is 3 posts per minute per browser. No server quota per IP in this version. Accepted. | Reject floods from `/admin`, rules still enforce length and pending only. |
| No answers | Questions only. There is no answer field, no reply thread, no export. | Read answers live on mic. Screenshot wall for records. |
| Anonymous list guard | Anonymous wall queries must filter to live statuses or Firestore rejects the whole query. Pending never leaks to `/wall`. | Do not change `useQuestions` wall filter without updating rules. |
| Polling cost | 5 second polling plus snapshot listener costs reads per projector per hall. Fine for one event, not for always on kiosks. | Close projector tab after event. |

## Assets

| File | Status |
|------|--------|
| `src/assets/mec-logo.jpg` | Approved header banner, keep aspect ratio, white chip backing |
| `src/assets/aws-logo.jpeg` | Quarantined, do not import. File is a pixel identicon, not official AWS branding. UI uses text lockup `AWS SBG` instead. See `src/assets/README-quarantine.md`. |
| `src/assets/react.svg` | Vite template leftover, unused [inferred from Layout import of mec logo only]. Safe to delete in a later cleanup. |
| `public/vite.svg` | Vite template favicon, still referenced by `index.html`. Replace with MEC or SBG mark before public hosting [inferred]. |

Do not add new logos without checking trademark and source. Keep the quarantine note.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Live setup required` banner on projector | `.env` missing or still placeholder. Fill 4 required keys, restart `npm run dev`. |
| Wall empty but Ask posts succeed | Posts are pending. Approve one in `/admin`. Wall shows approved and featured only. |
| `Missing or insufficient permissions` | Redeploy `firestore.rules`. Check wall filter is live statuses only. |
| `The query requires an index` | Deploy `firestore.indexes.json` or click console link to create index, wait a few minutes. |
| `/admin` says not admin after sign in | Set `is_admin` claim or create `admins/{uid}` doc for that UID, then sign out and in to refresh token. |
| Wall freezes on hall WiFi | Click `Refresh now`. Move projector to hotspot. Long polling plus 5s poll recovers on its own. |
| Upvote says already voted | Expected after one vote per device. That block is by design. |

## Scripts

| Command | Use |
|---------|-----|
| `npm run dev` | Local rehearsal with hot reload |
| `npm run build` | Type check plus production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint check |

## Docs audit

- Changeset: not needed. No `packages/` directory, no changeset system in this repo.
- Internal docs: none missing. `src/assets/README-quarantine.md` kept as provenance record.
- User docs: this README is the single runbook. No `docs/` folder or docs site yet [inferred from repo listing].
