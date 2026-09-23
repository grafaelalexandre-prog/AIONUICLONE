/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Task runner — dispatches pending tasks to aioncore as real conversations and
 * records the agent's actual reply.
 *
 * Failure policy: every non-2xx response, timeout and empty turn marks the task
 * `failed`, carrying the backend's own message. A task becomes `completed` only
 * when aioncore reported the turn finished AND an assistant reply exists.
 */

import { mkdirSync } from 'node:fs';
import type { Task } from '@/common/task/taskTypes';
import { isTaskOnlyAssistant } from '@/common/task/taskAssistants';
import {
  createConversation,
  getConversation,
  getMessages,
  listAssistants,
  sendMessage,
  type AioncoreMessage,
} from './aioncoreClient';
import {
  claimNextPendingTask,
  getTask,
  markTaskCompleted,
  markTaskFailed,
  setTaskConversation,
  type TaskDatabase,
} from './taskRepository';

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_TURN_TIMEOUT_MS = 10 * 60 * 1_000;
/** Transient poll failures tolerated before the turn is declared lost. */
const MAX_CONSECUTIVE_POLL_ERRORS = 5;

export type TaskRunnerOptions = {
  db: TaskDatabase;
  /** Resolves the live aioncore port — only known after backend startup. */
  getBackendPort: () => number;
  /** Workspace used when a task was created without one. */
  defaultWorkspace: string;
  pollIntervalMs?: number;
  turnTimeoutMs?: number;
  onTaskSettled?: (task: Task) => void;
  log?: (message: string) => void;
};

type TurnOutcome = { ok: true; reply: string | null } | { ok: false; error: string };

export class TaskRunner {
  private readonly db: TaskDatabase;
  private readonly getBackendPort: () => number;
  private readonly defaultWorkspace: string;
  private readonly pollIntervalMs: number;
  private readonly turnTimeoutMs: number;
  private readonly onTaskSettled?: (task: Task) => void;
  private readonly log: (message: string) => void;

  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;

  constructor(options: TaskRunnerOptions) {
    this.db = options.db;
    this.getBackendPort = options.getBackendPort;
    this.defaultWorkspace = options.defaultWorkspace;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.turnTimeoutMs = options.turnTimeoutMs ?? DEFAULT_TURN_TIMEOUT_MS;
    this.onTaskSettled = options.onTaskSettled;
    this.log = options.log ?? (() => {});
  }

  /** Begin polling for pending tasks. Idempotent. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
  }

  /** Stop polling. An in-flight turn settles on its own timeout. */
  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      // Drain the queue so a burst of tasks is not throttled by the poll interval.
      while (await this.runNext()) {
        /* keep draining */
      }
    } finally {
      this.busy = false;
    }
  }

  /** Claim and process one pending task. Returns false when none is waiting. */
  async runNext(): Promise<boolean> {
    const task = claimNextPendingTask(this.db);
    if (!task) return false;

    try {
      await this.runTask(task);
    } catch (error) {
      // runTask handles its own failures; this is the last-resort guard so an
      // unexpected throw never leaves a task stuck in `running` forever.
      markTaskFailed(this.db, task.id, error instanceof Error ? error.message : String(error));
    }

    const settled = getTask(this.db, task.id);
    if (settled) this.onTaskSettled?.(settled);
    return true;
  }

  private async runTask(task: Task): Promise<void> {
    const port = this.getBackendPort();
    if (!port || port <= 0) {
      markTaskFailed(this.db, task.id, 'aioncore is not running — cannot dispatch the task');
      return;
    }

    try {
      const assistantId = task.assistant_id ?? (await this.resolveAssistantId(port));
      if (!assistantId) {
        markTaskFailed(this.db, task.id, 'no enabled assistant is available in aioncore to run this task');
        return;
      }

      const workspace = task.workspace ?? this.defaultWorkspace;
      mkdirSync(workspace, { recursive: true });

      // 1. Conversation. `extra.workspace` is mandatory; `title` / `type: 'task'`
      //    are not part of the create schema and are answered with a 400.
      const conversationId = await createConversation(port, {
        name: task.mission.slice(0, 80) || 'Task',
        assistantId,
        workspace,
      });
      setTaskConversation(this.db, task.id, conversationId);
      this.log(`[TaskRunner] ${task.id} -> conversation ${conversationId}`);

      // 2. Message — starts the agent turn (202 Accepted).
      await sendMessage(port, conversationId, task.mission);

      // 3. Wait for the turn to finish and read the agent's real reply.
      const reply = await this.awaitTurn(port, conversationId);
      markTaskCompleted(this.db, task.id, reply);
    } catch (error) {
      // Every failure path — HTTP rejection, unusable workspace, timeout, agent
      // error turn — lands here with the backend's own message. Nothing is ever
      // reported as completed unless a real reply was read back.
      markTaskFailed(this.db, task.id, describeError(error));
    }
  }

  /** Pick an enabled assistant, preferring a task-only one, then an online one. */
  private async resolveAssistantId(port: number): Promise<string | null> {
    const assistants = await listAssistants(port);
    const enabled = assistants.filter((assistant) => assistant.enabled !== false && Boolean(assistant.id));
    const online = enabled.filter((assistant) => assistant.agent_status === 'online');
    return (online.find((assistant) => isTaskOnlyAssistant(assistant)) ?? online[0] ?? enabled[0])?.id ?? null;
  }

  /**
   * Poll until the conversation reports `runtime.state === 'idle'`, then read the
   * transcript and return the agent's reply.
   *
   * Poll errors are tolerated a few times (the backend may be restarting), but a
   * sustained outage throws instead of silently waiting out the whole timeout.
   */
  private async awaitTurn(port: number, conversationId: string): Promise<string | null> {
    const deadline = Date.now() + this.turnTimeoutMs;
    let consecutiveErrors = 0;

    while (Date.now() < deadline) {
      let detail;
      try {
        detail = await getConversation(port, conversationId);
        consecutiveErrors = 0;
      } catch (error) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          throw new Error(`lost contact with aioncore while waiting for the turn: ${describeError(error)}`, {
            cause: error,
          });
        }
        await delay(this.pollIntervalMs);
        continue;
      }
      if ((detail.runtime?.state ?? '') === 'idle') {
        // Transcript errors propagate immediately: once the turn is idle, a
        // missing or error reply is the task outcome — never a poll blip.
        // (extractReply throwing inside the try above used to be swallowed by
        // the poll tolerance and surfaced as a generic timeout instead of the
        // real cause, e.g. `Not logged in`.)
        return this.extractReply(await getMessages(port, conversationId));
      }
      await delay(this.pollIntervalMs);
    }

    throw new Error(`the turn did not finish within ${Math.round(this.turnTimeoutMs / 1000)}s`);
  }

  /**
   * Read the agent's answer from the transcript.
   *
   * Assistant messages are the ones aioncore positions on the `left`. A reply
   * carrying `status: 'error'` (e.g. `Not logged in · Please run /login`) is a
   * task failure — reporting it as success is exactly the bug this module exists
   * to prevent.
   */
  private extractReply(messages: AioncoreMessage[]): string | null {
    const replies = messages.filter((message) => message.position === 'left' && message.type === 'text');
    const last = replies[replies.length - 1];
    if (!last) {
      throw new Error('the agent finished the turn without producing a reply');
    }
    const text = this.messageText(last) || null;
    if (last.status === 'error') {
      throw new Error(text ?? 'the agent reported an error turn');
    }
    return text;
  }

  private messageText(message: AioncoreMessage): string {
    const content = message.content;
    if (typeof content === 'string') return content.trim();
    if (content && typeof content === 'object' && typeof content.content === 'string') {
      return content.content.trim();
    }
    return '';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Normalize an unknown thrown value into a message worth showing the user. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
