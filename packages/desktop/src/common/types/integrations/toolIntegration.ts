/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Domain model for the Tools catalog.
 *
 * MCP remains the persistence and execution source of truth. These types are a
 * renderer-side normalization layer; they must not be used as a second store
 * for server credentials or tool definitions.
 */

export type ToolIntegrationSource = 'backend-mcp' | 'builtin-mcp' | 'extension-mcp';

export type ToolProviderKind = 'native-mcp' | 'nango' | 'composio' | 'http' | 'oauth' | 'api-key';

export type ToolConnectionKind = 'local-mcp' | 'remote-mcp' | 'unknown';

export type ToolAuthKind = 'none' | 'oauth' | 'bearer' | 'api-key' | 'unknown';

export type ToolIntegrationStatus =
  | 'CONFIGURED'
  | 'CONNECTED'
  | 'NOT_CONFIGURED'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'TESTING';

export type ToolAvailability = 'available' | 'unavailable' | 'unknown';

export interface ToolDescriptor {
  /** Stable within the owning integration, without exposing credentials. */
  id: string;
  name: string;
  description?: string;
  inputSchema?: unknown;
  enabled: boolean;
  availability: ToolAvailability;
}

export interface ToolConnection {
  id: string;
  kind: ToolConnectionKind;
  auth: ToolAuthKind;
  status: ToolIntegrationStatus;
}

export interface ToolIntegration {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  category: 'mcp' | 'http' | 'oauth' | 'api-key' | 'extension' | 'other';
  provider: ToolProviderKind;
  source: ToolIntegrationSource;
  connection: ToolConnection;
  status: ToolIntegrationStatus;
  tools: ToolDescriptor[];
}

/** Selection intent is intentionally ephemeral until the backend exposes a tool ACL contract. */
export type ToolSelectionState = Record<string, string[]>;
