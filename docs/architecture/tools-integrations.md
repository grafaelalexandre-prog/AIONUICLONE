# Tools integrations

## Why the UI says Tools

The former **Plugins** entry is now presented as **Tools**. In this phase the
source of truth is still the existing MCP catalog; the rename is a product
language change, not a rename of channel plugins, extension APIs, or backend
contracts. The route remains `/settings/tools` for compatibility.

## Current flow

```text
Tools
  → Tool catalog
  → Native MCP / Remote MCP
  → existing MCP test-connection flow
  → real tool discovery
  → tool catalog selection
  → existing MCP server selection
  → backend
  → existing agent runtime
```

MCP local uses the existing `stdio` transport. Remote MCP uses the existing
MCP HTTP backend path, normalized by the current contract to the backend's
`http` transport (Streamable HTTP). Legacy SSE remains supported where the
existing MCP implementation already supports it.

The add form's **Test connection** action uses the existing backend
create/test/delete path with a short-lived preflight record. The record is
removed immediately after the real test; the displayed tool list comes only
from the MCP response. If the user then saves, the normal CRUD path creates the
real catalog entry. This is a compatibility bridge for the current backend
contract, not a second MCP runtime or a permanent mock.

## Domain boundary

The renderer normalizes backend, built-in and extension MCP records into:

- `ToolIntegration` — catalog entry;
- `ToolConnection` — MCP server/session reference and status;
- `ToolDescriptor` — real MCP `name`, `description` and `input_schema`;
- `ToolSelectionState` — catalog intent for the next contract phase.

The normalized model is not a second persistence layer. Backend MCP records
remain authoritative. Tool checkboxes in this phase do not claim per-tool
authorization: the existing `selected_mcp_server_ids` and
`selected_session_mcp_servers` continue to control agent access at server
scope.

## Remote MCP security

The add form accepts a remote HTTP(S) endpoint but performs no renderer-side
network request. URL validation rejects unsupported protocols, embedded
credentials and fragments. OAuth continues through the existing backend MCP
OAuth endpoints. Bearer-token entry is intentionally disabled until a backend
credential-reference operation exists; secrets must not become renderer or
localStorage state.

## Adding a provider later

A future provider adapter should implement the same domain boundary:

```text
ProviderAdapter
  → discover integrations
  → inspect connection status
  → discover real tools
  → return ToolIntegration records
```

Nango and Composio can then be added as providers without changing the meaning
of a Tool or creating another agent executor. They are not implemented in this
phase, and no placeholder tools or endpoints are created.
