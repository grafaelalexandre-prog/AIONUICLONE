/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Minimal context handed to the Project Agent. Fields that already exist in the
 * backend (project_id/name via GET /api/projects/{id}, workspace on the
 * conversation) are sourced from there — never duplicated. `target_url` is the
 * only project-local datum, persisted as `project-agent.json` inside the
 * project workspace (single source of truth, editable by the user).
 */
export type ProjectAgentContext = {
  project_id: string | null;
  project_name: string | null;
  workspace: string;
  target_url: string;
};

/**
 * On-disk shape of `project-agent.json`. Deliberately tiny: only data the
 * backend does not already own for this project. Unknown keys are preserved on
 * round-trip (see serializeTargetUrlJson callers) so the file stays forward
 * compatible.
 */
export type ProjectAgentFile = {
  target_url?: string;
};
