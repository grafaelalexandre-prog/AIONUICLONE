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

const { joinWorkspacePath, projectAgentFilePath, readTargetUrl, saveTargetUrl, loadProjectAgentContext } =
  await import('@/renderer/pages/conversation/components/ProjectAgent/projectContext');

const conversation = (workspace?: string, projectId?: string) =>
  ({ id: 'c1', type: 'aionrs', extra: workspace ? { workspace } : {}, project_id: projectId }) as never;

describe('joinWorkspacePath / projectAgentFilePath', () => {
  it('joins with the workspace separator and never duplicates trailing ones', () => {
    expect(joinWorkspacePath('C:/projects/obra', 'project-agent.json')).toBe('C:/projects/obra/project-agent.json');
    expect(joinWorkspacePath('C:\\projects\\obra\\', 'a.json')).toBe('C:\\projects\\obra\\a.json');
    expect(projectAgentFilePath('/home/u/obra')).toBe('/home/u/obra/project-agent.json');
  });
});

describe('readTargetUrl / saveTargetUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the URL from project-agent.json via /api/fs/read', async () => {
    fsMock.readFile.invoke.mockResolvedValue('{"target_url": "https://a.b"}');
    await expect(readTargetUrl('C:/w')).resolves.toBe('https://a.b');
    expect(fsMock.readFile.invoke).toHaveBeenCalledWith({ path: 'C:/w/project-agent.json', workspace: 'C:/w' });
  });

  it('returns empty string when the file is missing or invalid', async () => {
    fsMock.readFile.invoke.mockResolvedValue(null);
    await expect(readTargetUrl('C:/w')).resolves.toBe('');
    fsMock.readFile.invoke.mockResolvedValue('garbage');
    await expect(readTargetUrl('C:/w')).resolves.toBe('');
  });

  it('writes serialized JSON through /api/fs/write', async () => {
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
