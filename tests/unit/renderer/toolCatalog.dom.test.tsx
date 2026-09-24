import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IMcpServer } from '@/common/config/storage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key }),
}));

vi.mock('@arco-design/web-react', () => ({
  Alert: ({ content }: { content: string }) => <div>{content}</div>,
  Empty: ({ description }: { description: string }) => <div>{description}</div>,
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) => <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />,
  Spin: () => <div data-testid='spin' />,
}));

vi.mock('@icon-park/react', () => ({ Search: () => <span data-testid='search-icon' /> }));

vi.mock('@/renderer/components/base/TalkToButlerButton', () => ({
  default: ({ label, onManual }: { label: string; onManual: () => void }) => (
    <button onClick={onManual}>{label}</button>
  ),
}));

vi.mock('@/renderer/pages/settings/ToolsSettings/McpServerItem', () => ({
  default: ({
    server,
    selectedToolIds,
    onToggleTool,
  }: {
    server: IMcpServer;
    selectedToolIds?: string[];
    onToggleTool?: (id: string) => void;
  }) => (
    <div data-testid={`server-${server.id}`}>
      <span>{server.name}</span>
      <span data-testid={`selection-${server.id}`}>{selectedToolIds?.join(',') ?? ''}</span>
      <button onClick={() => onToggleTool?.(`${server.id}:tool-one`)}>toggle</button>
    </div>
  ),
}));

import ToolCatalog from '@/renderer/pages/settings/ToolsSettings/ToolCatalog';

const server = (overrides: Partial<IMcpServer> = {}): IMcpServer =>
  ({
    id: 'mcp-1',
    name: 'Engineering MCP',
    enabled: true,
    transport: { type: 'http', url: 'https://example.test/mcp' },
    tools: [{ name: 'tool-one', description: 'Real tool' }],
    last_test_status: 'connected',
    created_at: 1,
    updated_at: 1,
    original_json: '{}',
    ...overrides,
  }) as IMcpServer;

const renderCatalog = (onAddTool = vi.fn()) =>
  render(
    <ToolCatalog
      backendServers={[server()]}
      extensionServers={[]}
      isCollapsed={{}}
      testingServers={{}}
      oauthStatus={{}}
      loggingIn={{}}
      onToggleCollapse={vi.fn()}
      onTestConnection={vi.fn()}
      onEditServer={vi.fn()}
      onDeleteServer={vi.fn()}
      onOAuthLogin={vi.fn()}
      onAddTool={onAddTool}
      onImportJson={vi.fn()}
      onImportOneClick={vi.fn()}
    />
  );

describe('ToolCatalog', () => {
  it('renders the normalized MCP catalog and keeps tool selection as UI state', () => {
    renderCatalog();
    expect(screen.getByText('My tools')).toBeInTheDocument();
    expect(screen.getByTestId('server-mcp-1')).toHaveTextContent('Engineering MCP');
    expect(screen.getByTestId('selection-mcp-1')).toHaveTextContent('mcp-1:tool-one');

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByTestId('selection-mcp-1')).not.toHaveTextContent('mcp-1:tool-one');
  });

  it('filters the catalog by server and real tool metadata', () => {
    renderCatalog();
    fireEvent.change(screen.getByPlaceholderText('Search tools...'), { target: { value: 'real tool' } });
    expect(screen.getByTestId('server-mcp-1')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search tools...'), { target: { value: 'not found' } });
    expect(screen.queryByTestId('server-mcp-1')).not.toBeInTheDocument();
  });

  it('opens the new tool action without changing the route', () => {
    const onAddTool = vi.fn();
    renderCatalog(onAddTool);
    fireEvent.click(screen.getByRole('button', { name: 'Add tool' }));
    expect(onAddTool).toHaveBeenCalledTimes(1);
  });
});
