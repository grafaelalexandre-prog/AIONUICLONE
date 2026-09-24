/** @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Task entity types — shared contract imported by backend, renderer, and
 * other modules (Teams, WebUI, etc.) without pulling in platform-specific code.
 */

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** A single task entity. Stable contract — do not narrow without a migration. */
export type Task = {
  id: string;
  mission: string;
  status: TaskStatus;
  agent_id: string | null;
  assistant_id: string | null;
  /** Team id when the mission targets a team (the leader orchestrates members). Null for single-assistant tasks. */
  team_id: string | null;
  workspace: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  result: string | null;
  error: string | null;
};

export type CreateTaskInput = {
  mission: string;
  assistant_id?: string | null;
  team_id?: string | null;
  workspace?: string | null;
};

export type ListTasksOptions = {
  status?: TaskStatus;
  limit?: number;
  offset?: number;
};

/** Subset of the `runtime.state` values aioncore reports for a conversation. */
export type ConversationRuntimeState = 'idle' | 'starting' | 'running' | string;
