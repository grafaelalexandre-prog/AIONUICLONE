/** @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Task-only assistant policy — agents reserved for autonomous Agent Tasks.
 *
 * Cline is registered as a custom ACP agent and is dedicated to autonomous
 * task dispatch: it must not be offered in chat selection surfaces, and the
 * task runner prefers it when a task does not pin an assistant.
 *
 * Identification is by normalized display name because the backend assistant
 * model has no task-only flag yet. Renaming the assistant drops it from this
 * policy — documented limitation until a backend flag exists.
 */

/** Lowercase assistant display names reserved for autonomous tasks only. */
export const TASK_ONLY_ASSISTANT_NAMES: ReadonlySet<string> = new Set(['cline']);

/** Whether an assistant is reserved for autonomous Agent Tasks. */
export function isTaskOnlyAssistant(assistant: { name?: string } | null | undefined): boolean {
  const name = assistant?.name?.trim().toLowerCase();
  return Boolean(name && TASK_ONLY_ASSISTANT_NAMES.has(name));
}
