import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { enforceRateLimit } from "./rateLimiter";
import { acquireLock, releaseLock } from "./concurrencyGuard";
import { validateRequest, buildPrompt } from "./promptBuilder";
import { generativeModel } from "./vertexClient";

admin.initializeApp();

/**
 * Callable entry point used by the frontend (see src/lib/vertex.ts on the
 * client). Vertex credentials never leave this function — the client only
 * ever talks to this endpoint, authenticated + App-Check-verified + rate
 * limited.
 */
export const generateProposals = onCall(
  { enforceAppCheck: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign-in required.");
    }

    const ip = request.rawRequest?.ip;

    let payload;
    try {
      payload = validateRequest(request.data);
    } catch (err) {
      throw new HttpsError("invalid-argument", (err as Error).message);
    }

    await enforceRateLimit(uid, ip);
    await acquireLock(uid);

    try {
      const prompt = buildPrompt(payload);
      const result = await generativeModel.generateContent(prompt);
      const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const data = JSON.parse(text);
      return { proposals: data.proposals };
    } finally {
      await releaseLock(uid);
    }
  }
);
