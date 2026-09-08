import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * Prevents a single user from having two proposal-generation requests
 * in flight at once (e.g. double-clicking submit, or a second browser
 * tab) — closes a gap the 5-minute spacing alone wouldn't catch since
 * both requests could land inside the same window before either resolves.
 */
const STALE_LOCK_MS = 2 * 60 * 1000; // treat a lock older than this as abandoned

export async function acquireLock(uid: string): Promise<void> {
  const db = admin.firestore();
  const ref = db.collection("locks").doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const lockedAt = snap.data()?.lockedAt as admin.firestore.Timestamp | undefined;

    if (lockedAt && Date.now() - lockedAt.toMillis() < STALE_LOCK_MS) {
      throw new HttpsError(
        "resource-exhausted",
        "A request is already in progress. Please wait for it to finish."
      );
    }

    tx.set(ref, { lockedAt: admin.firestore.Timestamp.now() });
  });
}

export async function releaseLock(uid: string): Promise<void> {
  await admin.firestore().collection("locks").doc(uid).delete();
}
