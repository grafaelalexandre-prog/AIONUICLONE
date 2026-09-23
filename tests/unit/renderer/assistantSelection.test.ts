/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import { isTaskOnlyAssistant, TASK_ONLY_ASSISTANT_NAMES } from '@/common/task/taskAssistants';
import {
  assistantOrderAfterToggle,
  chatSelectableAssistants,
  selectableAssistants,
} from '@/renderer/utils/model/assistantSelection';

const mk = (id: string, source: Assistant['source'], sort_order: number, enabled = true): Assistant =>
  ({
    id,
    source,
    name: id,
    name_i18n: {},
    description_i18n: {},
    enabled,
    sort_order,
    enabled_skills: [],
    custom_skill_names: [],
    disabled_builtin_skills: [],
    context_i18n: {},
    prompts: [],
    prompts_i18n: {},
    models: [],
    agent_status: 'online',
    team_selectable: true,
    deletable: source === 'user',
  }) as Assistant;

describe('selectableAssistants', () => {
  it('keeps the legacy source order when no preference exists', () => {
    const result = selectableAssistants([
      mk('builtin-a', 'builtin', 5),
      mk('user-b', 'user', 20),
      mk('cli-a', 'generated', 30),
      mk('user-a', 'user', 10),
      mk('cli-b', 'generated', 40),
    ]);
    expect(result.map((a) => a.id)).toEqual(['cli-a', 'cli-b', 'user-a', 'user-b', 'builtin-a']);
  });

  it('drops disabled assistants', () => {
    const result = selectableAssistants([
      mk('cli-on', 'generated', 10, true),
      mk('cli-off', 'generated', 20, false),
      mk('user-off', 'user', 30, false),
    ]);
    expect(result.map((a) => a.id)).toEqual(['cli-on']);
  });

  it('keeps CLI agents ahead of official even when official has a lower sort_order', () => {
    const result = selectableAssistants([mk('official', 'builtin', 1), mk('cli', 'generated', 999)]);
    expect(result[0].id).toBe('cli');
  });

  it('applies one preferred order across CLI, custom, and official assistants', () => {
    const assistants = [mk('official', 'builtin', 1), mk('custom', 'user', 1), mk('cli', 'generated', 1)];

    const result = selectableAssistants(assistants, ['official', 'cli', 'custom']);

    expect(result.map((assistant) => assistant.id)).toEqual(['official', 'cli', 'custom']);
  });

  it('ignores duplicate and stale IDs, then appends new assistants deterministically', () => {
    const assistants = [mk('official-new', 'builtin', 2), mk('custom-known', 'user', 1), mk('cli-new', 'generated', 3)];

    const result = selectableAssistants(assistants, ['missing', 'custom-known', 'custom-known']);

    expect(result.map((assistant) => assistant.id)).toEqual(['custom-known', 'cli-new', 'official-new']);
  });
});

describe('isTaskOnlyAssistant / chatSelectableAssistants', () => {
  it('matches the reserved task-only names case-insensitively with trimmed whitespace', () => {
    expect(TASK_ONLY_ASSISTANT_NAMES.has('cline')).toBe(true);
    expect(isTaskOnlyAssistant({ name: 'Cline' })).toBe(true);
    expect(isTaskOnlyAssistant({ name: '  CLINE  ' })).toBe(true);
    expect(isTaskOnlyAssistant({ name: 'Claude Code' })).toBe(false);
    expect(isTaskOnlyAssistant({})).toBe(false);
    expect(isTaskOnlyAssistant(null)).toBe(false);
    expect(isTaskOnlyAssistant(undefined)).toBe(false);
  });

  it('keeps task-only assistants out of chat selection but visible in the full list', () => {
    const cline = { ...mk('cline', 'generated', 1), name: 'Cline' };
    const assistants = [cline, mk('cli-a', 'generated', 2), mk('builtin-a', 'builtin', 3)];

    expect(chatSelectableAssistants(assistants).map((a) => a.id)).toEqual(['cli-a', 'builtin-a']);
    // The unfiltered list still includes them — settings/tasks surfaces rely on it.
    expect(selectableAssistants(assistants).map((a) => a.id)).toEqual(['cline', 'cli-a', 'builtin-a']);
  });

  it('honors the stored preferred order while excluding task-only assistants', () => {
    const assistants = [
      { ...mk('cline', 'generated', 1), name: 'Cline' },
      mk('official', 'builtin', 2),
      mk('cli', 'generated', 3),
    ];

    expect(chatSelectableAssistants(assistants, ['official', 'cline', 'cli']).map((a) => a.id)).toEqual([
      'official',
      'cli',
    ]);
  });
});

describe('assistantOrderAfterToggle', () => {
  const assistants = [
    mk('cli', 'generated', 1),
    mk('custom', 'user', 1),
    mk('official', 'builtin', 1),
    mk('disabled', 'builtin', 2, false),
  ];

  it('removes a disabled assistant from the enabled order', () => {
    expect(assistantOrderAfterToggle(assistants, ['official', 'cli', 'custom'], 'cli', false)).toEqual([
      'official',
      'custom',
    ]);
  });

  it('appends a re-enabled assistant to the end', () => {
    expect(assistantOrderAfterToggle(assistants, ['official', 'cli', 'custom'], 'disabled', true)).toEqual([
      'official',
      'cli',
      'custom',
      'disabled',
    ]);
  });
});
