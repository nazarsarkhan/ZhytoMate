import { config } from "../config/index.js";
import { ApiError } from "./ApiError.js";

// The ONLY module allowed to call ml-service (the FastAPI RAG + vision backend). Its
// X-Internal-Token is a service-to-service secret and must never reach the browser - every
// ml-service call happens here, server-side, on behalf of an already-authenticated citizen.
const CHAT_TIMEOUT_MS = 20_000;
const VISION_TIMEOUT_MS = 25_000;
const ACTION_TIMEOUT_MS = 15_000;
const APP_ROUTE_ALLOWLIST = new Set([
  "/services",
  "/services/contacts",
  "/services/polls",
  "/services/appeals",
  "/services/transport",
  "/services/outages",
  "/places",
  "/news",
  "/notifications",
  "/profile",
  "/chat-history",
]);

export function sanitizeAppLinks(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const links = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { capability, label, route, reason } = item;
    if ([capability, label, route, reason].some((field) => typeof field !== "string")) continue;
    if (!APP_ROUTE_ALLOWLIST.has(route) || route.startsWith("/admin") || route.includes("\\")) continue;
    if (seen.has(route)) continue;
    seen.add(route);
    links.push({ capability, label, route, reason });
    if (links.length === 3) break;
  }
  return links;
}

async function callMlService(path, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${config.mlBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-token": config.internalToken,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw ApiError.gatewayTimeout("AI service took too long to respond");
    }
    throw ApiError.badGateway("AI service is unreachable");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw await translateMlError(response);
  }

  return response.json();
}

async function translateMlError(response) {
  let mlMessage = response.statusText;
  try {
    const body = await response.json();
    mlMessage = body?.error?.message || mlMessage;
  } catch {
    // ml-service always replies with JSON on error; fall back to statusText if it somehow doesn't.
  }

  // ml-service's 401 means backend_app's own INTERNAL_TOKEN is missing/wrong - a config bug
  // between our two services, never the calling citizen's fault. Never surface as `unauthorized`,
  // that would wrongly imply their own session is invalid.
  if (response.status === 401) return ApiError.badGateway("AI service is temporarily unavailable");
  if (response.status === 400) return ApiError.badRequest(mlMessage);
  if (response.status === 429) return new ApiError(429, mlMessage);
  return ApiError.badGateway(mlMessage);
}

export async function queryAssistant({ userQuery, userId, district }) {
  const result = await callMlService(
    "/api/v1/chat/query",
    { user_query: userQuery, user_id: userId, district: district || null },
    CHAT_TIMEOUT_MS,
  );
  return {
    answer: result.answer,
    sourcesUsed: result.sources_used,
    confidence: result.confidence,
    actionIntent: result.action_intent || null,
    grounded: result.grounded === true,
    verified: result.verified === true,
    answerStatus: result.answer_status || "ungrounded",
    appLinks: sanitizeAppLinks(result.app_links),
  };
}

export async function analyzeVision({ imageBase64, mimeType }) {
  const result = await callMlService(
    "/api/v1/vision/analyze",
    { image_base64: imageBase64, mime_type: mimeType },
    VISION_TIMEOUT_MS,
  );
  return {
    isValid: result.is_valid,
    category: result.category,
    severity: result.severity,
    title: result.title,
    description: result.description,
  };
}

export async function extractActionSlots({ message, slotSchema, currentSlots }) {
  const result = await callMlService(
    "/api/v1/assistant/extract-slots",
    {
      message,
      slot_schema: slotSchema.map((field) => ({
        name: field.name,
        description: field.description,
        enum_values: field.enumValues || null,
      })),
      current_slots: currentSlots,
    },
    ACTION_TIMEOUT_MS,
  );
  return {
    slots: result.slots,
    wantsCancel: result.wants_cancel,
    isUnrelated: result.is_unrelated,
  };
}

export default { queryAssistant, analyzeVision, extractActionSlots };
