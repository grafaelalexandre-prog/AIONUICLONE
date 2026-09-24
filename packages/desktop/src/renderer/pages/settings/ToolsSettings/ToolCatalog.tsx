import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Empty, Input, Spin } from '@arco-design/web-react';
import { Search } from '@icon-park/react';
import { useTranslation } from 'react-i18next';
import type { IMcpServer } from '@/common/config/storage';
import type { ToolSelectionState } from '@/common/types/integrations/toolIntegration';
import type { McpOAuthStatus } from '@/renderer/hooks/mcp/useMcpOAuth';
import { createToolCatalog } from '@/renderer/services/tools/toolCatalog';
import TalkToButlerButton from '@/renderer/components/base/TalkToButlerButton';
import McpServerItem from './McpServerItem';

interface ToolCatalogProps {
  backendServers: IMcpServer[];
  extensionServers: IMcpServer[];
  isLoading?: boolean;
  isCollapsed: Record<string, boolean>;
  testingServers: Record<string, boolean>;
  oauthStatus: Record<string, McpOAuthStatus>;
  loggingIn: Record<string, boolean>;
  onToggleCollapse: (serverId: string) => void;
  onTestConnection: (server: IMcpServer) => void;
  onEditServer: (server: IMcpServer) => void;
  onDeleteServer: (serverId: string) => void;
  onOAuthLogin: (server: IMcpServer) => void;
  onAddTool: () => void;
  onImportJson: () => void;
  onImportOneClick: () => void;
}

const ToolCatalog: React.FC<ToolCatalogProps> = ({
  backendServers,
  extensionServers,
  isLoading,
  isCollapsed,
  testingServers,
  oauthStatus,
  loggingIn,
  onToggleCollapse,
  onTestConnection,
  onEditServer,
  onDeleteServer,
  onOAuthLogin,
  onAddTool,
  onImportJson,
  onImportOneClick,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedTools, setSelectedTools] = useState<ToolSelectionState>({});
  const registry = useMemo(
    () => createToolCatalog(backendServers, extensionServers),
    [backendServers, extensionServers]
  );
  const integrations = useMemo(() => registry.list(), [registry]);
  const serversById = useMemo(() => {
    const map = new Map<string, IMcpServer>();
    for (const server of backendServers) map.set(server.id, server);
    for (const server of extensionServers) {
      if (!map.has(server.id)) map.set(server.id, server);
    }
    return map;
  }, [backendServers, extensionServers]);

  useEffect(() => {
    setSelectedTools((previous) => {
      const next = { ...previous };
      for (const integration of integrations) {
        const available = new Set(integration.tools.map((tool) => tool.id));
        const current = next[integration.id] ?? integration.tools.map((tool) => tool.id);
        next[integration.id] = current.filter((toolId) => available.has(toolId));
      }
      return next;
    });
  }, [integrations]);

  const visibleIntegrations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return integrations;
    return integrations.filter((integration) => {
      const haystack = [
        integration.name,
        integration.description ?? '',
        integration.provider,
        ...integration.tools.map((tool) => `${tool.name} ${tool.description ?? ''}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [integrations, query]);

  const handleToggleTool = (integrationId: string, toolId: string) => {
    setSelectedTools((previous) => {
      const current = new Set(previous[integrationId] ?? []);
      if (current.has(toolId)) current.delete(toolId);
      else current.add(toolId);
      return { ...previous, [integrationId]: Array.from(current) };
    });
  };

  return (
    <div className='flex flex-col gap-12px min-h-0'>
      <div className='flex items-center justify-between gap-12px'>
        <div>
          <div className='text-14px text-t-primary'>{t('settings.myTools', { defaultValue: 'My tools' })}</div>
          <div className='text-11px text-t-tertiary'>
            {integrations.length} {t('settings.toolsConfigured', { defaultValue: 'configured integrations' })}
          </div>
        </div>
        <TalkToButlerButton
          label={t('settings.addTool', { defaultValue: 'Add tool' })}
          chatLabel={t('settings.talkToButler.addViaChat', { defaultValue: 'Add via chat' })}
          prompt={t('settings.talkToButler.prompt.addMcp', { defaultValue: 'Help me set up an MCP server.' })}
          onManual={onAddTool}
          manualLabel={t('settings.addTool', { defaultValue: 'Add tool' })}
          extraActions={[
            { key: 'json', label: t('settings.mcpImportFromJSON'), onClick: onImportJson },
            { key: 'oneclick', label: t('settings.mcpOneKeyImport'), onClick: onImportOneClick },
          ]}
          data-testid='add-tool-button'
        />
      </div>

      <Input
        value={query}
        onChange={setQuery}
        prefix={<Search size={16} />}
        placeholder={t('settings.searchTools', { defaultValue: 'Search tools...' })}
        allowClear
        data-testid='tools-search'
      />

      <Alert
        type='info'
        content={t('settings.toolSelectionNotice', {
          defaultValue:
            'Tool checkboxes are catalog intent for this phase. Agent execution remains server-scoped through the existing MCP selection until the backend exposes a tool ACL contract.',
        })}
      />

      {isLoading ? (
        <div className='flex justify-center py-24px'>
          <Spin />
        </div>
      ) : visibleIntegrations.length === 0 ? (
        <Empty description={t('settings.mcpNoServersFound')} />
      ) : (
        <div className='space-y-12px'>
          {visibleIntegrations.map((integration) => {
            const server = serversById.get(integration.connection.id);
            if (!server) return null;
            const isExtension = integration.source === 'extension-mcp';
            const isReadOnly = isExtension || server.builtin === true;
            return (
              <McpServerItem
                key={integration.id}
                server={server}
                providerLabel={`${integration.provider} · ${integration.connection.kind}`}
                isCollapsed={isCollapsed[server.id] || false}
                isTestingConnection={testingServers[server.id] || false}
                oauthStatus={oauthStatus[server.id]}
                isLoggingIn={loggingIn[server.id]}
                isReadOnly={isReadOnly}
                selectedToolIds={selectedTools[integration.id]}
                onToggleTool={(toolId) => handleToggleTool(integration.id, toolId)}
                onToggleCollapse={() => onToggleCollapse(server.id)}
                onTestConnection={onTestConnection}
                onEditServer={onEditServer}
                onDeleteServer={onDeleteServer}
                onOAuthLogin={onOAuthLogin}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ToolCatalog;
