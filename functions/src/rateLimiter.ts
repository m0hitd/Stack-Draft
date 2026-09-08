import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * Per-user quota, enforced in Firestore rather than an in-memory Map.
 * Cloud Functions instances are ephemeral and horizontally scaled, so an
 * in-memory counter would be wrong the moment there is more than one
 * instance — Firestore gives a single source of truth all instances share.
 */
const MIN_INTERVAL_MS = 5 * 60 * 1000; // 1 request per 5 minutes
const MAX_PER_WINDOW = 3; // 3 requests per rolling 24h
const WINDOW_MS = 24 * 60 * 60 * 1000;

interface UsageDoc {
  lastRequestAt?: admin.firestore.Timestamp;
  requestTimestamps?: admin.firestore.Timestamp[];
  lastIp?: string;
}

/**
 * Checks and records a request for `uid` inside a single Firestore
 * transaction, so concurrent requests from the same user can't race past
 * the limit. Throws `resource-exhausted` if the caller is over quota.
 */
export async function enforceRateLimit(uid: string, ip: string | undefined): Promise<void> {
  const db = admin.firestore();
  const ref = db.collection("usage").doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.data() as UsageDoc) ?? {};
    const now = admin.firestore.Timestamp.now();
    const nowMs = now.toMillis();

    if (data.lastRequestAt) {
      const elapsed = nowMs - data.lastRequestAt.toMillis();
      if (elapsed < MIN_INTERVAL_MS) {
        const retryAfterSec = Math.ceil((MIN_INTERVAL_MS - elapsed) / 1000);
        throw new HttpsError(
          "resource-exhausted",
          `Please wait before generating again. Try again in ${retryAfterSec}s.`,
          { retryAfterSec }
        );
      }
    }

    const recent = (data.requestTimestamps ?? []).filter(
      (ts) => nowMs - ts.toMillis() < WINDOW_MS
    );

    if (recent.length >= MAX_PER_WINDOW) {
      throw new HttpsError(
        "resource-exhausted",
        `Daily limit of ${MAX_PER_WINDOW} requests reached. Try again tomorrow.`
      );
    }

    recent.push(now);

    tx.set(
      ref,
      {
        lastRequestAt: now,
        requestTimestamps: recent,
        lastIp: ip ?? admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );
  });
}
