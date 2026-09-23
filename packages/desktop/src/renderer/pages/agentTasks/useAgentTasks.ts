/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '@/common/task/taskTypes';

export type UseAgentTasksResult = {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  createTask: (mission: string) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const POLL_INTERVAL_MS = 2000;

/**
 * Agent-tasks data hook. Reads through `window.taskAPI` (preload → IPC →
 * taskService → aioncore). Polls while any task is still active so status
 * transitions surface without a reload. In WebUI browser mode `taskAPI` is
 * absent — callers must render the `unavailable` state instead of crashing.
 */
export function useAgentTasks(): UseAgentTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const tasksRef = useRef<Task[]>([]);
  tasksRef.current = tasks;

  const refresh = useCallback(async () => {
    const api = window.taskAPI;
    if (!api) {
      setLoading(false);
      return;
    }
    try {
      const result = await api.list();
      setTasks(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => {
      const active = tasksRef.current.some((task) => task.status === 'pending' || task.status === 'running');
      if (active) void refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const createTask = useCallback(
    async (mission: string): Promise<Task | null> => {
      const api = window.taskAPI;
      if (!api) return null;
      setCreating(true);
      try {
        const task = await api.create(mission);
        await refresh();
        return task;
      } finally {
        setCreating(false);
      }
    },
    [refresh]
  );

  const deleteTask = useCallback(
    async (id: string): Promise<void> => {
      const api = window.taskAPI;
      if (!api) return;
      await api.remove(id);
      await refresh();
    },
    [refresh]
  );

  return { tasks, loading, error, creating, createTask, deleteTask, refresh };
}
