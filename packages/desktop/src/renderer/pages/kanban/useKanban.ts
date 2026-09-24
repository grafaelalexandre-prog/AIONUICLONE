import { useCallback } from 'react';
import useSWR from 'swr';
import type {
  CreateKanbanBoardInput,
  CreateKanbanCardInput,
  CreateKanbanColumnInput,
  CreateKanbanRoleInput,
  DispatchKanbanCardInput,
  KanbanBoard,
  KanbanCard,
  KanbanColumn,
  KanbanRole,
  MoveKanbanCardInput,
  UpdateKanbanBoardInput,
  UpdateKanbanCardInput,
  UpdateKanbanColumnInput,
  UpdateKanbanRoleInput,
} from '@/common/kanban/kanbanTypes';

const KANBAN_SWR_KEY = 'kanban/boards';

function requireApi() {
  const api = typeof window !== 'undefined' ? window.kanbanAPI : undefined;
  if (!api) throw new Error('Kanban API is unavailable in this runtime');
  return api;
}

export function useKanban() {
  const hasApi = typeof window !== 'undefined' && Boolean(window.kanbanAPI);
  const { data, error, isLoading, mutate } = useSWR<KanbanBoard[]>(
    hasApi ? KANBAN_SWR_KEY : null,
    () => requireApi().list({ include_archived: true }),
    {
      refreshInterval: 2500,
      revalidateOnFocus: true,
    }
  );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const createBoard = useCallback(
    async (input: CreateKanbanBoardInput) => {
      const result = await requireApi().createBoard(input);
      await mutate();
      return result;
    },
    [mutate]
  );

  const updateBoard = useCallback(
    async (input: UpdateKanbanBoardInput) => {
      const result = await requireApi().updateBoard(input);
      await mutate();
      return result;
    },
    [mutate]
  );

  const deleteBoard = useCallback(
    async (id: string) => {
      const result = await requireApi().deleteBoard({ id });
      await mutate();
      return result;
    },
    [mutate]
  );

  const createRole = useCallback(
    async (input: CreateKanbanRoleInput) => {
      const result = await requireApi().createRole(input);
      await mutate();
      return result;
    },
    [mutate]
  );

  const updateRole = useCallback(
    async (input: UpdateKanbanRoleInput) => {
      const result = await requireApi().updateRole(input);
      await mutate();
      return result;
    },
    [mutate]
  );

  const deleteRole = useCallback(
    async (id: string) => {
      const result = await requireApi().deleteRole({ id });
      await mutate();
      return result;
    },
    [mutate]
  );

  const createCard = useCallback(
    async (input: CreateKanbanCardInput) => {
      const result = await requireApi().createCard(input);
      await mutate();
      return result;
    },
    [mutate]
  );

  const updateCard = useCallback(
    async (input: UpdateKanbanCardInput) => {
      const result = await requireApi().updateCard(input);
      await mutate();
      return result;
    },
    [mutate]
  );

  const moveCard = useCallback(
    async (input: MoveKanbanCardInput) => {
      const result = await requireApi().moveCard(input);
      await mutate();
      return result;
    },
    [mutate]
  );

  const dispatchCard = useCallback(
    async (input: DispatchKanbanCardInput) => {
      const result = await requireApi().dispatchCard(input);
      await mutate();
      return result;
    },
    [mutate]
  );

  const createColumn = useCallback(
    async (input: CreateKanbanColumnInput) => {
      const result = await requireApi().createColumn(input);
      await mutate();
      return result;
    },
    [mutate]
  );

  const updateColumn = useCallback(
    async (input: UpdateKanbanColumnInput) => {
      const result = await requireApi().updateColumn(input);
      await mutate();
      return result;
    },
    [mutate]
  );

  const deleteColumn = useCallback(
    async (id: string) => {
      const result = await requireApi().deleteColumn({ id });
      await mutate();
      return result;
    },
    [mutate]
  );

  return {
    boards: data ?? [],
    loading: isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    hasApi,
    refresh,
    createBoard,
    updateBoard,
    deleteBoard,
    createRole,
    updateRole,
    deleteRole,
    createCard,
    updateCard,
    moveCard,
    dispatchCard,
    createColumn,
    updateColumn,
    deleteColumn,
  };
}

export type UseKanbanResult = ReturnType<typeof useKanban>;
export type { KanbanBoard, KanbanCard, KanbanColumn, KanbanRole };
