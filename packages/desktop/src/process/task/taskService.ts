/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Task service — owns the SQLite connection, the runner and the `task:*` IPC
 * surface exposed to the renderer.
 *
 * Started once the backend is up, because the runner needs the live aioncore
 * port and a running backend to create conversations.
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { ipcMain } from 'electron';
import type { CreateTaskInput, ListTasksOptions } from '@/common/task/taskTypes';
import { createTask, deleteTask, ensureTaskSchema, getTask, listTasks, type TaskDatabase } from './taskRepository';
import { TaskRunner } from './taskRunner';

export type TaskServiceOptions = {
  /** Absolute path of the task SQLite file. */
  dbPath: string;
  /** Resolves the live aioncore port. */
  getBackendPort: () => number;
  /** Workspace handed to conversations created without an explicit one. */
  defaultWorkspace: string;
};

export type TaskServiceHandle = {
  /** Stop the runner and close the database. Safe to call more than once. */
  stop: () => void;
};

const CHANNELS = ['task:create', 'task:list', 'task:get', 'task:delete'] as const;

/** Normalize renderer input — the mission is the only required field. */
function toCreateInput(raw: CreateTaskInput | undefined): CreateTaskInput {
  const mission = typeof raw?.mission === 'string' ? raw.mission.trim() : '';
  if (!mission) {
    throw new Error('task mission must not be empty');
  }
  return {
    mission,
    assistant_id: raw?.assistant_id ?? null,
    workspace: raw?.workspace ?? null,
  };
}

export function startTaskService(options: TaskServiceOptions): TaskServiceHandle {
  mkdirSync(dirname(options.dbPath), { recursive: true });
  const db: TaskDatabase = new BetterSqlite3(options.dbPath);
  ensureTaskSchema(db);

  const runner = new TaskRunner({
    db,
    getBackendPort: options.getBackendPort,
    defaultWorkspace: options.defaultWorkspace,
    onTaskSettled: (task) => {
      console.log(`[TaskService] ${task.id} ${task.status}${task.error ? `: ${task.error}` : ''}`);
    },
    log: (message) => console.log(message),
  });

  ipcMain.handle('task:create', (_event, raw: CreateTaskInput | undefined) => {
    const task = createTask(db, toCreateInput(raw));
    // Kick the runner immediately so the UI does not wait a poll interval.
    void runner.runNext();
    return task;
  });

  ipcMain.handle('task:list', (_event, listOptions: ListTasksOptions | undefined) => listTasks(db, listOptions ?? {}));

  ipcMain.handle('task:get', (_event, id: string) => getTask(db, id));

  ipcMain.handle('task:delete', (_event, id: string) => {
    deleteTask(db, id);
    return true;
  });

  runner.start();

  let stopped = false;
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      runner.stop();
      for (const channel of CHANNELS) {
        ipcMain.removeHandler(channel);
      }
      db.close();
    },
  };
}
