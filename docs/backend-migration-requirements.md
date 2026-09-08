# Backend Migration Requirements — Vertex/Gemini Rate Limiting

## Problem

[vertex.ts](src/lib/vertex.ts) currently:
- Reads `VITE_GEMINI_API_KEY` client-side ([vertex.ts:16](src/lib/vertex.ts#L16)) — the key ships in the built bundle and is extractable by anyone.
- Calls `model.generateContent()` directly from the browser ([vertex.ts:163](src/lib/vertex.ts#L163)) — no server sits between the user and the Gemini bill.
- Each call requests **3 proposals** in one prompt ([vertex.ts:67](src/lib/vertex.ts#L67)) — output tokens are ~3x a single-proposal request.

Firebase is currently hosting-only ([FIREBASE_SETUP.md:10](FIREBASE_SETUP.md#L10)) — no Functions, no Auth, no Firestore, and `.firebaserc` still has the placeholder project ID (no real project connected yet).

A client-side rate limiter cannot fix this — it's trivially bypassed by calling the exposed key directly.

## Decisions made

| Question | Decision |
|---|---|
| Firebase project | Doesn't exist yet — must be created |
| Auth | Firebase Anonymous Auth (silent, no login screen) — gives a stable per-device UID |
| Rate limit shape | 1 request per 5 minutes **and** max 3 requests per rolling 24 hours, per UID |
| IP | Recorded as a fallback signal, not the primary key |
| App Check | Included in this first migration, not deferred |
| Scope | Self-use project — keep this as small/simple as it can correctly be |

## Requirements

### 1. Firebase project setup
- Create a new Firebase project in the console.
- Replace the placeholder in [.firebaserc](.firebaserc) with the real project ID.
- Enable: Authentication, Firestore, Functions, App Check (on the Blaze plan — Functions calling out to Vertex requires it).

### 2. Firebase Authentication (Anonymous)
- Enable the Anonymous provider in the Firebase console.
- On app load, sign in anonymously if no existing session; persist the UID across reloads (Firebase SDK does this by default via IndexedDB/localStorage).
- No UI change — this is invisible to the user.

### 3. Firebase App Check
- Register the web app with reCAPTCHA v3 (or v3 Enterprise) as the App Check provider.
- Enforce App Check on the callable function (reject requests without a valid token).
- Add the App Check SDK + site key to the frontend init.

### 4. Cloud Function (callable) — `generateProposals`
Replace the direct SDK call in [vertex.ts](src/lib/vertex.ts) with a call to this function.

The function must, in order:
1. Verify Firebase Auth context (`context.auth`) — reject if missing.
2. Verify App Check token (`context.app`) — reject if missing.
3. Enforce rate limit (see §5) before touching Vertex — reject with a clear error (e.g. `resource-exhausted`) if over quota, including retry-after info if easy to compute.
4. Validate request payload — cap `requirements` string length, validate `cloudProvider` is one of `GCP | AWS | Azure`, validate `budget` is a number or null.
5. Enforce a concurrency guard — reject if the same UID already has an in-flight request (prevents double-submit/tab-spam from bypassing the 5-minute spacing).
6. Call Vertex AI (moved server-side, using Application Default Credentials / service account — no API key in the function's own env if avoidable, prefer Vertex AI SDK with ADC over the Generative Language API key).
7. Cap `maxOutputTokens` in the generation config.
8. Return the parsed proposals to the client.

Vertex credentials live only in the Cloud Functions runtime (ADC via the function's service account) — `VITE_GEMINI_API_KEY` is removed from the frontend entirely.

### 5. Rate limiting (Firestore-backed, not in-memory)
Collection: `usage/{uid}` (one doc per user).

Fields:
- `lastRequestAt`: timestamp — enforces the 5-minute spacing.
- `requestTimestamps`: array of the last 24h of request timestamps (or a rolling counter reset at 24h) — enforces the 3/day cap.
- `lastIp`: string — recorded for abuse investigation, not used as the primary limit key.

Logic (inside a Firestore transaction, so concurrent requests from the same UID can't race past the limit):
1. Read `usage/{uid}`.
2. Reject if `now - lastRequestAt < 5 minutes`.
3. Prune `requestTimestamps` older than 24h; reject if remaining count >= 3.
4. On success: set `lastRequestAt = now`, append `now` to `requestTimestamps`, update `lastIp`.

Must use a Firestore transaction — not an in-memory `Map` — since Cloud Functions instances are ephemeral and multiple instances would each keep separate, incorrect counters.

### 6. Frontend changes ([vertex.ts](src/lib/vertex.ts))
- Remove `import { GoogleGenerativeAI, ... } from "@google/generative-ai"` and the direct `genAI`/`model` setup.
- Remove `VITE_GEMINI_API_KEY` read and the `apiKey` warning.
- Replace `model.generateContent(prompt)` with a call to the `generateProposals` callable function via the Firebase SDK (`httpsCallable`).
- Surface the rate-limit error to the UI in a friendly way (e.g. "You can generate again in X minutes" / "Daily limit reached").
- Keep `parseTerraform`/`parseDiagram`/`parseProposals` — these are pure formatting functions and can stay client-side (run on the function's response) or move server-side; no strong requirement either way, but moving them server-side means the client trusts the function's shape rather than reimplementing.

### 7. Config / cleanup
- Remove `VITE_GEMINI_API_KEY` from `.env.example` and [FIREBASE_SETUP.md](FIREBASE_SETUP.md) (replace with the new server-side setup: enabling the Vertex AI API on the GCP project, granting the Functions service account the Vertex AI User role).
- Update [FIREBASE_SETUP.md](FIREBASE_SETUP.md)'s architecture diagram to show Browser → Callable Function → Vertex AI, and Firebase as Auth + Functions + Firestore + Hosting, not hosting-only.
- Add `functions/` (new Cloud Functions project: `firebase-functions`, `firebase-admin`, `@google-cloud/vertexai`).

### 8. Out of scope for this first pass (explicitly deferred)
- Redis-backed rate limiting (Firestore is sufficient at this scale/traffic).
- API Gateway quotas / Cloud Armor (infrastructure-level enforcement — not needed for a self-use project).
- Response caching for identical prompts.
- Google Cloud budget alerts — worth doing but is a console setting, not code; can be set up independently at any time.

## Suggested build order
1. Create Firebase project, enable Blaze plan, update `.firebaserc`.
2. Enable Anonymous Auth; wire silent sign-in into the frontend.
3. Scaffold `functions/` with the Vertex AI SDK and move the prompt-building + generation logic there.
4. Add the Firestore transaction-based rate limiter inside the function.
5. Enable App Check (reCAPTCHA v3) on both the web app and the function.
6. Point [vertex.ts](src/lib/vertex.ts) at the callable function; delete the old SDK usage and the API key.
7. Update `.env.example` and [FIREBASE_SETUP.md](FIREBASE_SETUP.md).
8. Manually test: normal use, hitting the 5-minute wall, hitting the 3/day wall, and a request with no App Check token (should be rejected).
