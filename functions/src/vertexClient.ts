import { VertexAI } from "@google-cloud/vertexai";

/**
 * Server-side Vertex AI client. Credentials come from the Cloud Functions
 * runtime's Application Default Credentials (the function's service
 * account) — no API key is stored in this project's env or code.
 */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "";
const LOCATION = "us-central1";

const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });

export const generativeModel = vertexAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    maxOutputTokens: 8192,
  },
});
