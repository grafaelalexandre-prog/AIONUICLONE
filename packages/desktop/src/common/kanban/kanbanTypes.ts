/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared contracts for the activity Kanban. The board is an allocation layer
 * above existing assistants/tasks; it does not create a new agent runtime.
 */

import type { Task } from '@/common/task/taskTypes';

export type KanbanPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type KanbanColumn = {
  id: string;
  board_id: string;
  /** Stable key for built-in columns; custom columns use a generated key. */
  key: string;
  /** Empty for built-in columns whose label is resolved through i18n. */
  name: string;
  position: number;
  color: string;
  system: boolean;
};

export type KanbanRole = {
  id: string;
  board_id: string;
  /** Board-local label; the underlying assistant is not renamed globally. */
  name: string;
  assistant_id: string | null;
  team_id: string | null;
  responsibility: string;
  color: string;
  position: number;
  created_at: number;
  updated_at: number;
};

export type KanbanCard = {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string;
  priority: KanbanPriority;
  role_id: string | null;
  task_id: string | null;
  workspace: string | null;
  position: number;
  archived: boolean;
  created_at: number;
  updated_at: number;
};

export type KanbanBoard = {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  manager_role_id: string | null;
  manager_instructions: string;
  columns: KanbanColumn[];
  roles: KanbanRole[];
  cards: KanbanCard[];
  created_at: number;
  updated_at: number;
};

export type KanbanListOptions = {
  include_archived?: boolean;
};

export type CreateKanbanBoardInput = {
  name: string;
  description?: string;
};

export type UpdateKanbanBoardInput = {
  id: string;
  name?: string;
  description?: string;
  archived?: boolean;
  manager_role_id?: string | null;
  manager_instructions?: string;
};

export type CreateKanbanRoleInput = {
  board_id: string;
  name: string;
  assistant_id?: string | null;
  team_id?: string | null;
  responsibility?: string;
  color?: string;
};

export type DeleteKanbanBoardInput = {
  id: string;
};

export type DeleteKanbanBoardResult = {
  deleted: boolean;
  cards: number;
  roles: number;
  columns: number;
};

export type UpdateKanbanRoleInput = Partial<CreateKanbanRoleInput> & {
  id: string;
};

export type DeleteKanbanRoleInput = {
  id: string;
};

export type CreateKanbanCardInput = {
  board_id: string;
  column_id: string;
  title: string;
  description?: string;
  priority?: KanbanPriority;
  role_id?: string | null;
  workspace?: string | null;
};

export type UpdateKanbanCardInput = {
  id: string;
  title?: string;
  description?: string;
  priority?: KanbanPriority;
  role_id?: string | null;
  column_id?: string;
  task_id?: string | null;
  workspace?: string | null;
  archived?: boolean;
};

export type MoveKanbanCardInput = {
  id: string;
  column_id: string;
  position?: number;
};

export type CreateKanbanColumnInput = {
  board_id: string;
  name: string;
  color?: string;
};

export type UpdateKanbanColumnInput = {
  id: string;
  name?: string;
  color?: string;
};

export type DeleteKanbanColumnInput = {
  id: string;
};

export type DispatchKanbanCardInput = {
  card_id: string;
  mission: string;
  assistant_id?: string | null;
  team_id?: string | null;
  workspace?: string | null;
  column_id?: string;
};

export type DispatchKanbanCardResult = {
  card: KanbanCard;
  task: Task;
  reused: boolean;
};

export type KanbanAutomationAction =
  | {
      type: 'create_card';
      title: string;
      description?: string;
      column_id?: string;
      role_id?: string | null;
      priority?: KanbanPriority;
      workspace?: string | null;
    }
  | { type: 'move_card'; card_id: string; column_id: string }
  | { type: 'assign_card'; card_id: string; role_id: string | null }
  | { type: 'dispatch_card'; card_id: string }
  | {
      type: 'update_card';
      card_id: string;
      title?: string;
      description?: string;
      priority?: KanbanPriority;
      role_id?: string | null;
    }
  | { type: 'archive_card'; card_id: string };

export type KanbanAutomationPlan = {
  summary: string;
  actions: KanbanAutomationAction[];
};

/** Built-in columns created for every new board. */
export const KANBAN_DEFAULT_COLUMNS = [
  { key: 'triage', color: '#6b7280' },
  { key: 'todo', color: '#64748b' },
  { key: 'scheduled', color: '#d97706' },
  { key: 'ready', color: '#2563eb' },
  { key: 'running', color: '#0ea5a4' },
  { key: 'review', color: '#7c3aed' },
  { key: 'done', color: '#16a34a' },
  { key: 'blocked', color: '#dc2626' },
] as const;

export type KanbanAPI = {
  list: (options?: KanbanListOptions) => Promise<KanbanBoard[]>;
  createBoard: (input: CreateKanbanBoardInput) => Promise<KanbanBoard>;
  updateBoard: (input: UpdateKanbanBoardInput) => Promise<KanbanBoard>;
  deleteBoard: (input: DeleteKanbanBoardInput) => Promise<DeleteKanbanBoardResult>;
  createRole: (input: CreateKanbanRoleInput) => Promise<KanbanRole>;
  updateRole: (input: UpdateKanbanRoleInput) => Promise<KanbanRole>;
  deleteRole: (input: DeleteKanbanRoleInput) => Promise<boolean>;
  createCard: (input: CreateKanbanCardInput) => Promise<KanbanCard>;
  updateCard: (input: UpdateKanbanCardInput) => Promise<KanbanCard>;
  moveCard: (input: MoveKanbanCardInput) => Promise<KanbanCard>;
  dispatchCard: (input: DispatchKanbanCardInput) => Promise<DispatchKanbanCardResult>;
  createColumn: (input: CreateKanbanColumnInput) => Promise<KanbanColumn>;
  updateColumn: (input: UpdateKanbanColumnInput) => Promise<KanbanColumn>;
  deleteColumn: (input: DeleteKanbanColumnInput) => Promise<boolean>;
};
