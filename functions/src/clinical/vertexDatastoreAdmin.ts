import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { GoogleAuth } from "google-auth-library";

const DISCOVERY_ENGINE_BASE = "https://discoveryengine.googleapis.com/v1";
const SERVICE_USAGE_BASE = "https://serviceusage.googleapis.com/v1";
const DEFAULT_LOCATION = "global";
const DEFAULT_COLLECTION = "default_collection";
const DEFAULT_DATASTORE_ID = "pessy-vet-kb";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

async function getGoogleAccessToken(): Promise<string> {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = asString(tokenResponse.token);
  if (!token) throw new Error("google_access_token_missing");
  return token;
}

async function googleJsonRequest(args: {
  token: string;
  url: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const response = await fetch(args.url, {
    method: args.method || "GET",
    headers: {
      Authorization: `Bearer ${args.token}`,
      "Content-Type": "application/json",
    },
    ...(args.body ? { body: JSON.stringify(args.body) } : {}),
  });
  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    throw new Error(`google_api_${response.status}:${text.slice(0, 1200)}`);
  }
  return parsed;
}

async function enableDiscoveryEngineApi(project: string, token: string): Promise<void> {
  const enableUrl = `${SERVICE_USAGE_BASE}/projects/${encodeURIComponent(project)}/services/discoveryengine.googleapis.com:enable`;
  try {
    const operation = await googleJsonRequest({
      token,
      url: enableUrl,
      method: "POST",
      body: {},
    });
    const operationName = asString(operation.name);
    if (!operationName) return;
    if (
      operationName === "DONE_OPERATION" ||
      operationName.endsWith("/operations/DONE_OPERATION") ||
      operationName.includes("DONE_OPERATION")
    ) {
      return;
    }

    const operationUrl = `${SERVICE_USAGE_BASE}/${operationName}`;
    for (let i = 0; i < 20; i += 1) {
      const state = await googleJsonRequest({ token, url: operationUrl, method: "GET" });
      if (state.done === true) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    const message = String((error as Error)?.message || error);
    // API may already be enabled or caller may not have permission to enable.
    if (
      message.includes("ALREADY_EXISTS") ||
      message.includes("already enabled") ||
      message.includes("SERVICE_DISABLED")
    ) {
      return;
    }
    throw error;
  }
}

function buildDatastorePath(args: {
  project: string;
  location: string;
  collection: string;
  datastoreId: string;
}): string {
  return `projects/${args.project}/locations/${args.location}/collections/${args.collection}/dataStores/${args.datastoreId}`;
}

async function listDatastores(args: {
  token: string;
  project: string;
  location: string;
  collection: string;
}): Promise<Array<Record<string, unknown>>> {
  const url =
    `${DISCOVERY_ENGINE_BASE}/projects/${args.project}/locations/${args.location}/collections/${args.collection}/dataStores`;
  const payload = await googleJsonRequest({ token: args.token, url, method: "GET" });
  const stores = Array.isArray(payload.dataStores) ? payload.dataStores : [];
  return stores.map((row) => asRecord(row));
}

async function waitOperation(args: {
  token: string;
  operationName: string;
  maxAttempts?: number;
}): Promise<Record<string, unknown>> {
  if (
    args.operationName === "DONE_OPERATION" ||
    args.operationName.endsWith("/operations/DONE_OPERATION") ||
    args.operationName.includes("DONE_OPERATION")
  ) {
    return {
      done: true,
      warning: "done_operation_short_circuit",
    };
  }
  const maxAttempts = args.maxAttempts || 40;
  const operationUrl = `${DISCOVERY_ENGINE_BASE}/${args.operationName}`;
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const state = await googleJsonRequest({ token: args.token, url: operationUrl, method: "GET" });
      if (state.done === true) return state;
    } catch (error) {
      const message = String((error as Error)?.message || error);
      // Some create operations may become inaccessible quickly even though resource was created.
      if (message.includes("google_api_404")) {
        return {
          done: true,
          warning: "operation_not_found_after_create",
        };
      }
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`operation_timeout:${args.operationName}`);
}

async function createDatastore(args: {
  token: string;
  project: string;
  location: string;
  collection: string;
  datastoreId: string;
  displayName: string;
}): Promise<Record<string, unknown>> {
  const createUrl =
    `${DISCOVERY_ENGINE_BASE}/projects/${args.project}/locations/${args.location}` +
    `/collections/${args.collection}/dataStores?dataStoreId=${encodeURIComponent(args.datastoreId)}`;

  const candidateBodies: Array<Record<string, unknown>> = [
    {
      displayName: args.displayName,
      industryVertical: "GENERIC",
      solutionTypes: ["SOLUTION_TYPE_SEARCH"],
      contentConfig: "CONTENT_REQUIRED",
    },
    {
      displayName: args.displayName,
      industryVertical: "GENERIC",
      solutionTypes: ["SOLUTION_TYPE_SEARCH"],
      contentConfig: "NO_CONTENT",
    },
    {
      displayName: args.displayName,
      industryVertical: "GENERIC",
      solutionTypes: ["SOLUTION_TYPE_SEARCH"],
    },
  ];

  const errors: string[] = [];
  for (const body of candidateBodies) {
    try {
      const operation = await googleJsonRequest({
        token: args.token,
        url: createUrl,
        method: "POST",
        body,
      });
      const operationName = asString(operation.name);
      if (!operationName) return operation;
      return await waitOperation({
        token: args.token,
        operationName,
      });
    } catch (error) {
      const message = String((error as Error)?.message || error).slice(0, 500);
      if (message.includes("google_api_409")) {
        return {
          done: true,
          warning: "datastore_already_exists",
        };
      }
      errors.push(message);
    }
  }
  throw new Error(`datastore_create_failed:${errors.join(" || ")}`);
}

export const provisionPessyVertexDatastore = functions
  .runWith({
    timeoutSeconds: 300,
    memory: "1GB",
    secrets: ["GMAIL_FORCE_SYNC_KEY"],
  })
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    const configuredKey = asString(process.env.GMAIL_FORCE_SYNC_KEY);
    const incomingHeader =
      asString(req.headers["x-force-sync-key"]) ||
      asString(req.headers.authorization).replace(/^Bearer\s+/i, "");
    if (!configuredKey || !incomingHeader || incomingHeader !== configuredKey) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const body = asRecord(req.body);
    const project =
      asString(body.project) ||
      asString(process.env.GCLOUD_PROJECT) ||
      asString(process.env.GOOGLE_CLOUD_PROJECT);
    if (!project) {
      res.status(500).json({ ok: false, error: "missing_project_id" });
      return;
    }

    const location = asString(body.location) || DEFAULT_LOCATION;
    const collection = asString(body.collection) || DEFAULT_COLLECTION;
    const datastoreId = asString(body.datastoreId) || DEFAULT_DATASTORE_ID;
    const displayName = asString(body.displayName) || "Pessy Vet Knowledge Base";

    try {
      const token = await getGoogleAccessToken();
      await enableDiscoveryEngineApi(project, token);

      const existing = await listDatastores({
        token,
        project,
        location,
        collection,
      });
      const existingPath = existing
        .map((row) => asString(row.name))
        .find((name) => name.endsWith(`/dataStores/${datastoreId}`));

      let operation: Record<string, unknown> | null = null;
      const datastorePath = existingPath || buildDatastorePath({
        project,
        location,
        collection,
        datastoreId,
      });
      if (!existingPath) {
        operation = await createDatastore({
          token,
          project,
          location,
          collection,
          datastoreId,
          displayName,
        });
      }

      await admin.firestore().collection("system_config").doc("grounding").set(
        {
          project,
          location,
          collection,
          datastore_id: datastoreId,
          datastore_path: datastorePath,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );

      res.status(200).json({
        ok: true,
        project,
        location,
        collection,
        datastore_id: datastoreId,
        datastore_path: datastorePath,
        existed: Boolean(existingPath),
        operation,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: "provision_datastore_failed",
        detail: String((error as Error)?.message || error).slice(0, 1500),
      });
    }
  });
