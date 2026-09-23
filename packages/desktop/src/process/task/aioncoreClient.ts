/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Minimal aioncore HTTP client for the task service.
 *
 * The desktop main process spawns aioncore in `--local` identity mode
 * (see `packages/web-host/src/backend-launcher.ts`), which answers every
 * ordinary route with an injected default user and requires no token.
 *
 * Response envelope is always `{ success, data }` / `{ success: false, error, code }`.
 */

import http from 'node:http';

const REQUEST_TIMEOUT_MS = 30_000;

/** Assistant row as returned by `GET /api/assistants`. */
export type AioncoreAssistant = {
  id: string;
  name?: string;
  enabled?: boolean;
  agent_status?: string;
  agent?: { type?: string };
};

/** Conversation message as returned by `GET /api/conversations/:id/messages`. */
export type AioncoreMessage = {
  type?: string;
  position?: 'left' | 'right';
  status?: string;
  content?: { content?: string } | string;
};

/** Shape of `GET /api/conversations/:id`. */
export type AioncoreConversationDetail = {
  id: string;
  status?: string;
  runtime?: { state?: string; is_processing?: boolean };
};

/**
 * Thrown when aioncore rejects a request. Mirrors the renderer adapter's
 * throw-based contract (`BackendHttpError`) instead of a result union, so a
 * rejected call can never be mistaken for a successful one.
 */
export class AioncoreError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AioncoreError';
    this.status = status;
  }
}

export type CreateConversationParams = {
  name: string;
  assistantId: string;
  /** Required by the backend — a request without `extra.workspace` is a 400. */
  workspace: string;
};

function request(
  port: number,
  path: string,
  method: 'GET' | 'POST',
  body?: unknown
): Promise<{ status: number; payload: unknown }> {
  return new Promise((resolve, reject) => {
    if (!port || port <= 0) {
      reject(new Error('aioncore port is not available yet'));
      return;
    }

    const serialized = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          Accept: 'application/json',
          ...(serialized
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(serialized) }
            : {}),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let payload: unknown = raw;
          try {
            payload = JSON.parse(raw);
          } catch {
            // Non-JSON body (e.g. an HTML error page) — keep the raw text so the
            // caller can surface it instead of guessing.
          }
          resolve({ status: res.statusCode ?? 0, payload });
        });
      }
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`aioncore request timed out after ${REQUEST_TIMEOUT_MS}ms: ${method} ${path}`));
    });
    req.on('error', reject);
    if (serialized) req.write(serialized);
    req.end();
  });
}

/**
 * Run a request and unwrap the `{ success, data }` envelope.
 *
 * Throws `AioncoreError` for a transport failure, a non-2xx status, an explicit
 * `success: false`, or a response carrying no `data` — the task service must
 * never turn a rejected request into a success.
 */
async function call<T>(port: number, path: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  const { status, payload } = await request(port, path, method, body);
  const envelope = (payload ?? {}) as { success?: unknown; data?: unknown; error?: unknown };

  if (status < 200 || status >= 300) {
    throw new AioncoreError(describeFailure(envelope, payload, status), status);
  }

  if (envelope.success === false) {
    const detail = typeof envelope.error === 'string' ? envelope.error : 'aioncore reported success: false';
    throw new AioncoreError(`${detail} (HTTP ${status})`, status);
  }

  if (envelope.data === undefined) {
    throw new AioncoreError(`aioncore response carried no data (HTTP ${status})`, status);
  }

  return envelope.data as T;
}

/** Prefer the backend's own message; fall back to a body excerpt, then the status. */
function describeFailure(envelope: { error?: unknown }, payload: unknown, status: number): string {
  if (typeof envelope.error === 'string' && envelope.error.length > 0) {
    return `${envelope.error} (HTTP ${status})`;
  }
  if (typeof payload === 'string' && payload.length > 0) {
    return `${payload.slice(0, 500)} (HTTP ${status})`;
  }
  return `aioncore request failed (HTTP ${status})`;
}

/** List assistants registered in the backend. */
export async function listAssistants(port: number): Promise<AioncoreAssistant[]> {
  const data = await call<AioncoreAssistant[] | { items?: AioncoreAssistant[] }>(port, '/api/assistants', 'GET');
  return Array.isArray(data) ? data : (data.items ?? []);
}

/**
 * Create a conversation bound to an assistant.
 *
 * `extra.workspace` is mandatory: a body without it is answered with
 * `400 Invalid JSON request body`. `title` and `type: 'task'` are not part of
 * the schema at all — the only accepted types are `acp` and `aionrs`.
 */
export async function createConversation(port: number, params: CreateConversationParams): Promise<string> {
  const created = await call<{ id?: string }>(port, '/api/conversations', 'POST', {
    name: params.name,
    assistant: { id: params.assistantId },
    extra: { workspace: params.workspace, custom_workspace: true },
  });

  if (!created.id) {
    throw new AioncoreError('aioncore created a conversation without returning an id', 200);
  }
  return created.id;
}

/** Send a message, which starts the agent turn. Answers 202 Accepted. */
export async function sendMessage(port: number, conversationId: string, content: string): Promise<void> {
  await call<unknown>(port, `/api/conversations/${encodeURIComponent(conversationId)}/messages`, 'POST', { content });
}

/** Read a conversation, including its `runtime.state`. */
export async function getConversation(port: number, conversationId: string): Promise<AioncoreConversationDetail> {
  return call<AioncoreConversationDetail>(port, `/api/conversations/${encodeURIComponent(conversationId)}`, 'GET');
}

/** Read the conversation transcript, oldest first. */
export async function getMessages(port: number, conversationId: string): Promise<AioncoreMessage[]> {
  const data = await call<AioncoreMessage[] | { items?: AioncoreMessage[] }>(
    port,
    `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
    'GET'
  );
  return Array.isArray(data) ? data : (data.items ?? []);
}
