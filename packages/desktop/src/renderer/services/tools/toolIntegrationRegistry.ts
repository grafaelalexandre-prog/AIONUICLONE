/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ToolDescriptor,
  ToolIntegration,
  ToolIntegrationSource,
  ToolIntegrationStatus,
} from '@/common/types/integrations/toolIntegration';

export type ToolIntegrationSourceSnapshot = {
  source: ToolIntegrationSource;
  integrations: ToolIntegration[];
};

/**
 * Small in-memory catalog registry.
 *
 * The backend MCP catalog remains the source of truth. This registry only
 * normalizes backend, built-in and extension records into one UI-facing view.
 */
export class ToolIntegrationRegistry {
  private readonly integrations = new Map<string, ToolIntegration>();

  register(integration: ToolIntegration): void {
    if (!integration.id) return;
    this.integrations.set(integration.id, integration);
  }

  registerSnapshot(snapshot: ToolIntegrationSourceSnapshot): void {
    for (const integration of snapshot.integrations) {
      // The first source wins for a duplicate id. Callers should register the
      // backend/built-in source before extension records.
      if (!this.integrations.has(integration.id)) {
        this.register(integration);
      }
    }
  }

  unregister(id: string): boolean {
    return this.integrations.delete(id);
  }

  clear(): void {
    this.integrations.clear();
  }

  get(id: string): ToolIntegration | undefined {
    return this.integrations.get(id);
  }

  list(): ToolIntegration[] {
    return Array.from(this.integrations.values());
  }

  getTools(id: string): ToolDescriptor[] {
    return this.get(id)?.tools ?? [];
  }

  getConnectionStatus(id: string): ToolIntegrationStatus | undefined {
    return this.get(id)?.status;
  }
}
