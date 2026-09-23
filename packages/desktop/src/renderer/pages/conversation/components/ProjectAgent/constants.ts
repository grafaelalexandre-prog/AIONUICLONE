/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The Project Agent's project-local config file, stored in the workspace root.
 * Single source of truth for `target_url`; read/written through the existing
 * `/api/fs/read` and `/api/fs/write` endpoints (no new persistence).
 */
export const PROJECT_AGENT_FILE_NAME = 'project-agent.json';

/**
 * Registered name of the Project Agent skill. The skill file is generated from
 * `buildProjectAgentSkillMarkdown()` (same rule text as the mission prompt) and
 * installed into the backend's `user_skills_dir` — one canonical rule source,
 * two delivery vehicles (inline prompt + discoverable skill).
 */
export const PROJECT_AGENT_SKILL_NAME = 'project-agent';

/** Expected URL schemes for a navigable target. Anything else is rejected. */
export const PROJECT_AGENT_ALLOWED_URL_SCHEMES = ['http:', 'https:'] as const;
