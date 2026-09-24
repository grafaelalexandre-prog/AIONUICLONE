/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Project Agent context I/O.
 *
 * Source-of-truth policy (MVP):
 * - project_id / project_name / workspace: sourced from the existing backend
 *   (conversation `project_id` + `GET /api/projects/{id}`) — never duplicated.
 * - target_url: read from `.aion/mission/state.json` (preferred) with
 *   fallback to `project-agent.json` for backward compatibility.
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { PROJECT_AGENT_FILE_NAME } from './constants';
import { parseTargetUrlFromJson, serializeTargetUrlJson } from './missionPrompt';
import type { ProjectAgentContext } from './types';

/** Mission directory inside the workspace. */
export const MISSION_DIR = '.aion/mission';

/** Join a path segment to a workspace root without node:path (renderer). */
export function joinWorkspacePath(workspace: string, ...segments: string[]): string {
  const separator = workspace.includes('\\') ? '\\' : '/';
  const root = workspace.replace(/[\\/]+$/, '');
  return [root, ...segments].join(separator);
}

/** Absolute path of the project-agent config file inside a workspace. */
export function projectAgentFilePath(workspace: string): string {
  return joinWorkspacePath(workspace, PROJECT_AGENT_FILE_NAME);
}

/** Absolute path of the mission state.json inside a workspace. */
export function missionStatePath(workspace: string): string {
  return joinWorkspacePath(workspace, MISSION_DIR, 'state.json');
}

/** Read the persisted target URL from state.json (preferred) or project-agent.json (fallback). */
export async function readTargetUrl(workspace: string): Promise<string> {
  // Prefer .aion/mission/state.json if it exists and carries a target_url.
  try {
    const stateRaw = await ipcBridge.fs.readFile.invoke({ path: missionStatePath(workspace), workspace });
    if (stateRaw) {
      const state = JSON.parse(stateRaw) as { target_url?: string };
      if (state.target_url) return state.target_url;
    }
  } catch {
    // state.json absent or invalid — fall through to project-agent.json.
  }
  const raw = await ipcBridge.fs.readFile.invoke({ path: projectAgentFilePath(workspace), workspace });
  return parseTargetUrlFromJson(raw);
}

/** Read the full mission state.json, returning null when absent. */
export async function readMissionState(workspace: string): Promise<unknown | null> {
  try {
    const raw = await ipcBridge.fs.readFile.invoke({ path: missionStatePath(workspace), workspace });
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Persist a mission state.json. Best-effort: failure is swallowed so that
 *  a file write error never blocks the task/mission flow. */
export async function writeMissionState(workspace: string, state: unknown): Promise<void> {
  try {
    await ipcBridge.fs.writeFile.invoke({
      path: missionStatePath(workspace),
      data: JSON.stringify(state, null, 2) + '\n',
      workspace,
    });
  } catch {
    // Tolerated — the task/mission proceeds without the durable mirror.
    console.warn('[ProjectAgent] could not write mission state.json');
  }
}

/** Persist the target URL into the workspace config file. */
export async function saveTargetUrl(workspace: string, targetUrl: string): Promise<void> {
  await ipcBridge.fs.writeFile.invoke({
    path: projectAgentFilePath(workspace),
    data: serializeTargetUrlJson(targetUrl),
    workspace,
  });
}

/**
 * Resolve the minimal project context for a conversation. Never throws for
 * missing optional data: a conversation without a linked project still gets a
 * usable context (project fields fall back to null/''), but a conversation
 * without a workspace cannot host missions (the workspace is where the agent
 * works and where project-agent.json lives), so that case throws.
 */
export async function loadProjectAgentContext(conversation: TChatConversation): Promise<ProjectAgentContext> {
  const workspace = (conversation.extra as { workspace?: string } | undefined)?.workspace ?? '';
  if (!workspace) {
    throw new Error('conversation has no workspace');
  }

  let projectId = conversation.project_id ?? null;
  let projectName: string | null = null;
  if (projectId) {
    try {
      const detail = await ipcBridge.project.get.invoke({ project_id: projectId });
      projectName = detail.name ?? null;
    } catch (error) {
      // The project record is authoritative; if it cannot be read (deleted
      // while loading, backend hiccup) keep the id and continue without a name
      // rather than blocking the mission.
      console.warn('[ProjectAgent] failed to load project detail', projectId, error);
      projectName = null;
    }
  }

  const targetUrl = await readTargetUrl(workspace);
  return { project_id: projectId, project_name: projectName, workspace, target_url: targetUrl };
}
