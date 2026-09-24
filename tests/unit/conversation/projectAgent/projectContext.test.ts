/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit tests for Project Agent context I/O (path joining, target URL
 * persistence, context resolution). The ipcBridge module is mocked so these
 * run in the node project without Electron/HTTP.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock factories are hoisted above module-scope consts, so the mock fns
// must be created inside vi.hoisted() to be captured by the factory. Bridge
// methods are `{ provider, invoke }` — only `invoke` is exercised here.
const { fsMock, projectMock } = vi.hoisted(() => ({
  fsMock: { readFile: { invoke: vi.fn() }, writeFile: { invoke: vi.fn() } },
  projectMock: { get: { invoke: vi.fn() } },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: fsMock,
    project: projectMock,
  },
}));

const {
  joinWorkspacePath,
  loadProjectAgentContext,
  missionStatePath,
  projectAgentFilePath,
  readMissionState,
  readTargetUrl,
  saveTargetUrl,
  writeMissionState,
} = await import('@/renderer/pages/conversation/components/ProjectAgent/projectContext');

const conversation = (workspace?: string, projectId?: string) =>
  ({ id: 'c1', type: 'aionrs', extra: workspace ? { workspace } : {}, project_id: projectId }) as never;

describe('joinWorkspacePath / projectAgentFilePath', () => {
  it('joins with the workspace separator and never duplicates trailing ones', () => {
    expect(joinWorkspacePath('C:/projects/obra', 'project-agent.json')).toBe('C:/projects/obra/project-agent.json');
    expect(joinWorkspacePath('C:\\projects\\obra\\', 'a.json')).toBe('C:\\projects\\obra\\a.json');
    expect(projectAgentFilePath('/home/u/obra')).toBe('/home/u/obra/project-agent.json');
    expect(missionStatePath('/home/u/obra')).toBe('/home/u/obra/.aion/mission/state.json');
  });
});

describe('readTargetUrl / saveTargetUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers the target URL from .aion/mission/state.json', async () => {
    fsMock.readFile.invoke.mockResolvedValueOnce('{"target_url": "https://state.example"}');
    await expect(readTargetUrl('C:/w')).resolves.toBe('https://state.example');
    expect(fsMock.readFile.invoke).toHaveBeenCalledTimes(1);
    expect(fsMock.readFile.invoke).toHaveBeenNthCalledWith(1, {
      path: 'C:/w/.aion/mission/state.json',
      workspace: 'C:/w',
    });
  });

  it('falls back to project-agent.json when mission state is absent or invalid', async () => {
    fsMock.readFile.invoke
      .mockResolvedValueOnce('not valid state')
      .mockResolvedValueOnce('{"target_url": "https://legacy.example"}');
    await expect(readTargetUrl('C:/w')).resolves.toBe('https://legacy.example');
    expect(fsMock.readFile.invoke).toHaveBeenNthCalledWith(1, {
      path: 'C:/w/.aion/mission/state.json',
      workspace: 'C:/w',
    });
    expect(fsMock.readFile.invoke).toHaveBeenNthCalledWith(2, {
      path: 'C:/w/project-agent.json',
      workspace: 'C:/w',
    });
  });

  it('returns empty string when both mission state and legacy config are missing or invalid', async () => {
    fsMock.readFile.invoke.mockResolvedValueOnce(null).mockResolvedValueOnce('garbage');
    await expect(readTargetUrl('C:/w')).resolves.toBe('');
  });

  it('reads mission state independently and returns null when it cannot be parsed', async () => {
    fsMock.readFile.invoke.mockResolvedValueOnce('{"objective":"Executar missão"}');
    await expect(readMissionState('C:/w')).resolves.toEqual({ objective: 'Executar missão' });
    expect(fsMock.readFile.invoke).toHaveBeenCalledWith({
      path: 'C:/w/.aion/mission/state.json',
      workspace: 'C:/w',
    });

    fsMock.readFile.invoke.mockResolvedValueOnce('invalid');
    await expect(readMissionState('C:/w')).resolves.toBeNull();
  });

  it('writes mission state through /api/fs/write', async () => {
    fsMock.writeFile.invoke.mockResolvedValue(true);
    await writeMissionState('C:/w', { objective: 'Executar missão', plan: [] });
    expect(fsMock.writeFile.invoke).toHaveBeenCalledWith({
      path: 'C:/w/.aion/mission/state.json',
      data: '{\n  "objective": "Executar missão",\n  "plan": []\n}\n',
      workspace: 'C:/w',
    });
  });

  it('writes serialized legacy JSON through /api/fs/write', async () => {
    fsMock.writeFile.invoke.mockResolvedValue(true);
    await saveTargetUrl('C:/w', 'https://a.b');
    expect(fsMock.writeFile.invoke).toHaveBeenCalledWith({
      path: 'C:/w/project-agent.json',
      data: '{\n  "target_url": "https://a.b"\n}\n',
      workspace: 'C:/w',
    });
  });
});

describe('loadProjectAgentContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when the conversation has no workspace', async () => {
    await expect(loadProjectAgentContext(conversation(undefined))).rejects.toThrow('no workspace');
  });

  it('resolves project name from /api/projects/{id} and target url from the workspace', async () => {
    projectMock.get.invoke.mockResolvedValue({ project_id: 'p1', name: 'Obra Modelo', explorer: {} });
    fsMock.readFile.invoke.mockResolvedValue('{"target_url": "https://sys"}');
    const ctx = await loadProjectAgentContext(conversation('C:/w', 'p1'));
    expect(projectMock.get.invoke).toHaveBeenCalledWith({ project_id: 'p1' });
    expect(fsMock.readFile.invoke).toHaveBeenCalledWith({
      path: 'C:/w/.aion/mission/state.json',
      workspace: 'C:/w',
    });
    expect(ctx).toEqual({
      project_id: 'p1',
      project_name: 'Obra Modelo',
      workspace: 'C:/w',
      target_url: 'https://sys',
    });
  });

  it('keeps the project id and null name when the project record cannot be read', async () => {
    projectMock.get.invoke.mockRejectedValue(new Error('404'));
    fsMock.readFile.invoke.mockResolvedValue(null);
    const ctx = await loadProjectAgentContext(conversation('C:/w', 'p1'));
    expect(ctx.project_id).toBe('p1');
    expect(ctx.project_name).toBeNull();
    expect(ctx.target_url).toBe('');
  });

  it('works without a linked project (project fields null)', async () => {
    fsMock.readFile.invoke.mockResolvedValue(null);
    const ctx = await loadProjectAgentContext(conversation('C:/w'));
    expect(ctx.project_id).toBeNull();
    expect(ctx.project_name).toBeNull();
    expect(projectMock.get.invoke).not.toHaveBeenCalled();
  });
});
