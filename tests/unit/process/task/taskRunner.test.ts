/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * TaskRunner behaviour against a fake aioncore that speaks the real HTTP
 * contract, captured from a live backend:
 *
 *   POST /api/conversations            -> 201, requires `extra.workspace`
 *   POST /api/conversations/:id/messages -> 202, starts the turn
 *   GET  /api/conversations/:id        -> `runtime.state` (starting|running|idle)
 *   GET  /api/conversations/:id/messages -> transcript, agent replies on `left`
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTask, ensureTaskSchema, getTask, type TaskDatabase } from '@process/task/taskRepository';
import { TaskRunner, type TaskRunnerOptions } from '@process/task/taskRunner';

type FakeAioncoreOptions = {
  /** Reject `POST /api/conversations` with this status and body. */
  createFailure?: { status: number; body: unknown };
  /** Values returned by successive `GET /api/conversations/:id` polls. */
  runtimeStates?: string[];
  /** Transcript returned once the turn reports idle. */
  messages?: unknown[];
  /** Rows served by `GET /api/assistants`. Defaults to one online assistant. */
  assistants?: Array<Record<string, unknown>>;
};

type FakeAioncore = {
  port: number;
  createBodies: Record<string, unknown>[];
  sentContents: string[];
  close: () => Promise<void>;
};

async function startFakeAioncore(options: FakeAioncoreOptions = {}): Promise<FakeAioncore> {
  const createBodies: Record<string, unknown>[] = [];
  const sentContents: string[] = [];
  const runtimeStates = options.runtimeStates ?? ['starting', 'running', 'idle'];
  let polls = 0;
  let conversationSeq = 0;

  const detailRoute = /^\/api\/conversations\/[^/]+$/;
  const messagesRoute = /^\/api\/conversations\/[^/]+\/messages$/;

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const url = req.url ?? '';
      const json = (status: number, payload: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      if (req.method === 'GET' && url === '/api/assistants') {
        json(200, {
          success: true,
          data: options.assistants ?? [{ id: 'bare:test-assistant', enabled: true, agent_status: 'online' }],
        });
        return;
      }

      if (req.method === 'POST' && url === '/api/conversations') {
        createBodies.push(JSON.parse(raw) as Record<string, unknown>);
        if (options.createFailure) {
          json(options.createFailure.status, options.createFailure.body);
          return;
        }
        conversationSeq += 1;
        json(201, { success: true, data: { id: `conv-${conversationSeq}` } });
        return;
      }

      if (req.method === 'POST' && messagesRoute.test(url)) {
        sentContents.push((JSON.parse(raw) as { content: string }).content);
        json(202, { success: true, data: { turn_id: 'turn-1' } });
        return;
      }

      if (req.method === 'GET' && messagesRoute.test(url)) {
        json(200, { success: true, data: { items: options.messages ?? [] } });
        return;
      }

      if (req.method === 'GET' && detailRoute.test(url)) {
        const state = runtimeStates[Math.min(polls, runtimeStates.length - 1)];
        polls += 1;
        json(200, { success: true, data: { id: 'conv', runtime: { state } } });
        return;
      }

      json(404, { success: false, error: 'Route not found.', code: 'NOT_FOUND' });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    port,
    createBodies,
    sentContents,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

describe('TaskRunner', () => {
  let db: TaskDatabase;
  let workspace: string;
  let servers: FakeAioncore[];
  let runners: TaskRunner[];

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
    ensureTaskSchema(db);
    workspace = mkdtempSync(join(tmpdir(), 'aionui-task-test-'));
    servers = [];
    runners = [];
  });

  afterEach(async () => {
    for (const runner of runners) runner.stop();
    for (const server of servers) await server.close();
    db.close();
    rmSync(workspace, { recursive: true, force: true });
  });

  function makeRunner(port: number, overrides: Partial<TaskRunnerOptions> = {}): TaskRunner {
    const runner = new TaskRunner({
      db,
      getBackendPort: () => port,
      defaultWorkspace: workspace,
      pollIntervalMs: 5,
      turnTimeoutMs: 500,
      ...overrides,
    });
    runners.push(runner);
    return runner;
  }

  async function startServer(options: FakeAioncoreOptions = {}): Promise<FakeAioncore> {
    const server = await startFakeAioncore(options);
    servers.push(server);
    return server;
  }

  const AGENT_REPLY = 'PROBE_OK';

  let aioncore: FakeAioncore;
  let taskId: string;

  function enqueue(mission: string): string {
    const task = createTask(db, { mission });
    taskId = task.id;
    return task.id;
  }

  describe('dispatching a task', () => {
    beforeEach(async () => {
      aioncore = await startServer({
        messages: [{ type: 'text', position: 'left', status: 'finish', content: { content: AGENT_REPLY } }],
      });
      enqueue('Say exactly: PROBE_OK');
      await makeRunner(aioncore.port).runNext();
    });

    it('completes the task with the agent reply and the real conversation id', () => {
      const settled = getTask(db, taskId);
      expect(settled?.status).toBe('completed');
      expect(settled?.agent_id).toBe('conv-1');
      expect(settled?.result).toBe(AGENT_REPLY);
    });

    it('sends the create body the backend actually accepts', () => {
      expect(aioncore.createBodies).toHaveLength(1);
      const body = aioncore.createBodies[0];
      // Regression guard: `extra.workspace` is mandatory, and the rejected
      // `title` / `type: 'task'` fields must never come back.
      expect(body.extra).toEqual({ workspace, custom_workspace: true });
      expect(body.assistant).toEqual({ id: 'bare:test-assistant' });
      expect(body).not.toHaveProperty('title');
    });

    it('forwards the mission as the conversation message', () => {
      expect(aioncore.sentContents).toEqual(['Say exactly: PROBE_OK']);
    });
  });

  describe('failure paths', () => {
    it('fails the task carrying the backend message when the conversation is rejected', async () => {
      aioncore = await startServer({
        createFailure: {
          status: 400,
          body: { success: false, error: 'Invalid JSON request body.', code: 'BAD_REQUEST' },
        },
      });
      enqueue('this must never look successful');
      await makeRunner(aioncore.port).runNext();

      const settled = getTask(db, taskId);
      expect(settled?.status).toBe('failed');
      expect(settled?.error).toContain('Invalid JSON request body.');
      expect(settled?.result).toBeNull();
    });

    it('fails when the agent answers with an error turn instead of a reply', async () => {
      aioncore = await startServer({
        messages: [
          { type: 'text', position: 'right', status: 'finish', content: { content: 'do the thing' } },
          { type: 'text', position: 'left', status: 'error', content: { content: 'Not logged in' } },
        ],
      });
      enqueue('do the thing');
      await makeRunner(aioncore.port).runNext();

      const settled = getTask(db, taskId);
      expect(settled?.status).toBe('failed');
      expect(settled?.error).toContain('Not logged in');
    });

    it('fails when the agent finishes the turn without any reply', async () => {
      aioncore = await startServer({ messages: [] });
      enqueue('silent treatment');
      await makeRunner(aioncore.port).runNext();

      const settled = getTask(db, taskId);
      expect(settled?.status).toBe('failed');
      expect(settled?.error).toContain('without producing a reply');
    });

    it('gives up instead of hanging when the turn never reaches idle', async () => {
      aioncore = await startServer({ runtimeStates: ['running'] });
      enqueue('never finishes');
      await makeRunner(aioncore.port, { turnTimeoutMs: 60 }).runNext();

      const settled = getTask(db, taskId);
      expect(settled?.status).toBe('failed');
      expect(settled?.error).toContain('did not finish within');
    });

    it('fails without inventing a conversation when aioncore is not running', async () => {
      enqueue('backend is down');
      await makeRunner(0).runNext();

      const settled = getTask(db, taskId);
      expect(settled?.status).toBe('failed');
      expect(settled?.agent_id).toBeNull();
      expect(settled?.error).toContain('aioncore is not running');
    });
  });

  describe('assistant resolution', () => {
    it('prefers an online task-only assistant over other online assistants', async () => {
      aioncore = await startServer({
        assistants: [
          { id: 'bare:other', enabled: true, agent_status: 'online', name: 'Aion CLI' },
          { id: 'bare:cline', enabled: true, agent_status: 'online', name: 'Cline' },
        ],
        messages: [{ type: 'text', position: 'left', status: 'finish', content: { content: AGENT_REPLY } }],
      });
      enqueue('dispatch me');
      await makeRunner(aioncore.port).runNext();

      expect((aioncore.createBodies[0]?.assistant as { id?: string })?.id).toBe('bare:cline');
      expect(getTask(db, taskId)?.status).toBe('completed');
    });

    it('falls back to any online assistant when the task-only one is offline', async () => {
      aioncore = await startServer({
        assistants: [
          { id: 'bare:other', enabled: true, agent_status: 'online', name: 'Aion CLI' },
          { id: 'bare:cline', enabled: true, agent_status: 'offline', name: 'Cline' },
        ],
        messages: [{ type: 'text', position: 'left', status: 'finish', content: { content: AGENT_REPLY } }],
      });
      enqueue('dispatch me');
      await makeRunner(aioncore.port).runNext();

      expect((aioncore.createBodies[0]?.assistant as { id?: string })?.id).toBe('bare:other');
      expect(getTask(db, taskId)?.status).toBe('completed');
    });

    it('never picks a disabled assistant', async () => {
      aioncore = await startServer({
        assistants: [
          { id: 'bare:off', enabled: false, agent_status: 'online', name: 'Disabled' },
          { id: 'bare:on', enabled: true, agent_status: 'unchecked', name: 'Enabled' },
        ],
        messages: [{ type: 'text', position: 'left', status: 'finish', content: { content: AGENT_REPLY } }],
      });
      enqueue('dispatch me');
      await makeRunner(aioncore.port).runNext();

      expect((aioncore.createBodies[0]?.assistant as { id?: string })?.id).toBe('bare:on');
    });
  });

  describe('workspace handling', () => {
    it('creates the fallback workspace directory when it does not exist yet', async () => {
      const nested = join(workspace, 'nested', 'deep');
      aioncore = await startServer({
        messages: [{ type: 'text', position: 'left', status: 'finish', content: { content: AGENT_REPLY } }],
      });
      enqueue('work somewhere new');
      await makeRunner(aioncore.port, { defaultWorkspace: nested }).runNext();

      expect(existsSync(nested)).toBe(true);
      expect(getTask(db, taskId)?.status).toBe('completed');
    });
  });

  describe('queue handling', () => {
    it('reports false when nothing is pending', async () => {
      aioncore = await startServer();
      expect(await makeRunner(aioncore.port).runNext()).toBe(false);
    });

    it('never dispatches the same task twice when two runners poll together', async () => {
      aioncore = await startServer({
        createFailure: { status: 400, body: { success: false, error: 'stop early', code: 'BAD_REQUEST' } },
      });
      enqueue('race me');
      const first = makeRunner(aioncore.port);
      const second = makeRunner(aioncore.port);

      const claimed = await Promise.all([first.runNext(), second.runNext()]);

      expect(claimed.filter(Boolean)).toHaveLength(1);
      expect(aioncore.createBodies).toHaveLength(1);
    });
  });
});
