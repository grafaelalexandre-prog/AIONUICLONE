import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createKanbanCard,
  createKanbanRole,
  deleteKanbanBoard,
  dispatchKanbanCard,
  ensureKanbanSchema,
  listKanbanBoards,
  moveKanbanCard,
  updateKanbanBoard,
  updateKanbanCard,
} from '@process/task/kanbanRepository';
import { ensureTaskSchema, getTask, listTasks, type TaskDatabase } from '@process/task/taskRepository';

describe('kanbanRepository', () => {
  let db: TaskDatabase;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
    ensureTaskSchema(db);
    ensureKanbanSchema(db);
  });

  afterEach(() => {
    if (db) db.close();
  });

  it('creates a default board with the built-in workflow columns', () => {
    const boards = listKanbanBoards(db);
    expect(boards).toHaveLength(1);
    expect(boards[0].columns.map((column) => column.key)).toEqual([
      'triage',
      'todo',
      'scheduled',
      'ready',
      'running',
      'review',
      'done',
      'blocked',
    ]);
  });

  it('renames and deletes a board while preserving task rows', () => {
    const board = listKanbanBoards(db)[0];
    const renamed = updateKanbanBoard(db, { id: board.id, name: 'Board renamed' });
    expect(renamed.name).toBe('Board renamed');
    const card = createKanbanCard(db, { board_id: board.id, column_id: board.columns[0].id, title: 'Preserve task' });
    const dispatched = dispatchKanbanCard(db, { card_id: card.id, mission: 'Keep task history' });
    const result = deleteKanbanBoard(db, board.id);
    expect(result.deleted).toBe(true);
    expect(result.cards).toBe(1);
    expect(getTask(db, dispatched.task.id)?.id).toBe(dispatched.task.id);
    expect(listKanbanBoards(db)).toHaveLength(1);
  });

  it('persists a local role and card, then dispatches and links one task', () => {
    const board = listKanbanBoards(db)[0];
    const role = createKanbanRole(db, {
      board_id: board.id,
      name: 'Arquiteto',
      assistant_id: 'assistant-1',
      responsibility: 'Desenhar a solução.',
    });
    const card = createKanbanCard(db, {
      board_id: board.id,
      column_id: board.columns[0].id,
      title: 'Definir arquitetura',
      description: 'Levantar restrições e decidir a abordagem.',
      role_id: role.id,
    });

    const first = dispatchKanbanCard(db, {
      card_id: card.id,
      mission: 'Definir arquitetura',
      assistant_id: role.assistant_id,
      column_id: board.columns.find((column) => column.key === 'running')?.id,
    });
    expect(first.reused).toBe(false);
    expect(first.card.task_id).toBe(first.task.id);
    expect(getTask(db, first.task.id)?.assistant_id).toBe('assistant-1');

    const second = dispatchKanbanCard(db, {
      card_id: card.id,
      mission: 'Não deve criar outra task',
      assistant_id: role.assistant_id,
    });
    expect(second.reused).toBe(true);
    expect(second.task.id).toBe(first.task.id);
    expect(listTasks(db)).toHaveLength(1);
  });

  it('moves cards between columns and archives them without deleting task history', () => {
    const board = listKanbanBoards(db)[0];
    const triage = board.columns[0];
    const done = board.columns.find((column) => column.key === 'done');
    expect(done).toBeDefined();
    const card = createKanbanCard(db, {
      board_id: board.id,
      column_id: triage.id,
      title: 'Card de teste',
    });

    const moved = moveKanbanCard(db, { id: card.id, column_id: done!.id });
    expect(moved.column_id).toBe(done!.id);
    const archived = updateKanbanCard(db, { id: card.id, archived: true });
    expect(archived.archived).toBe(true);
    expect(listKanbanBoards(db)[0].cards.find((item) => item.id === card.id)?.archived).toBe(true);
  });
});
