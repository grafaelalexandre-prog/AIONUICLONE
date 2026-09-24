import React, { useEffect, useState } from 'react';
import { Alert, Input, Modal, Radio, Space } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import type { IMcpServer } from '@/common/config/storage';
import {
  buildMcpToolDraft,
  normalizeRemoteMcpUrl,
  type McpToolAuthMode,
  type McpToolKind,
} from '@/renderer/services/tools/toolCatalog';

interface AddToolModalProps {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (server: Omit<IMcpServer, 'id' | 'created_at' | 'updated_at'>) => Promise<unknown>;
}

const AddToolModal: React.FC<AddToolModalProps> = ({ visible, onCancel, onSubmit }) => {
  const { t } = useTranslation();
  const [kind, setKind] = useState<McpToolKind>('remote-mcp');
  const [authMode, setAuthMode] = useState<McpToolAuthMode>('none');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setKind('remote-mcp');
    setAuthMode('none');
    setName('');
    setUrl('');
    setCommand('');
    setArgs('');
    setError('');
    setSubmitting(false);
  }, [visible]);

  const handleSubmit = async () => {
    if (submitting) return;
    setError('');

    if (kind === 'remote-mcp') {
      const urlResult = normalizeRemoteMcpUrl(url);
      if (!urlResult.ok) {
        setError(t('settings.mcpRemoteUrlInvalid', { defaultValue: 'Enter a valid HTTP(S) MCP URL.' }));
        return;
      }
    }

    try {
      const draft = buildMcpToolDraft({ kind, authMode, name, url, command, args });
      setSubmitting(true);
      const result = await onSubmit(draft);
      if (result !== false) onCancel();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('settings.mcpImportFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={t('settings.addTool', { defaultValue: 'Add tool' })}
      visible={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText={t('settings.mcpAddServer', { defaultValue: 'Add MCP server' })}
      cancelText={t('common.cancel')}
      okButtonProps={{ loading: submitting }}
      style={{ width: 620 }}
      data-testid='add-tool-modal'
    >
      <Space direction='vertical' size='medium' style={{ width: '100%' }}>
        {error && <Alert type='error' showIcon content={error} />}

        <div>
          <div className='mb-8px text-sm text-t-primary'>{t('settings.toolType', { defaultValue: 'Tool type' })}</div>
          <Radio.Group value={kind} onChange={setKind}>
            <Radio value='remote-mcp'>{t('settings.mcpRemote', { defaultValue: 'Remote MCP' })}</Radio>
            <Radio value='local-mcp'>{t('settings.mcpLocal', { defaultValue: 'Local MCP' })}</Radio>
          </Radio.Group>
        </div>

        <div>
          <div className='mb-8px text-sm text-t-primary'>{t('settings.mcpName', { defaultValue: 'Name' })}</div>
          <Input
            value={name}
            onChange={setName}
            placeholder={t('settings.mcpNamePlaceholder', { defaultValue: 'My MCP server' })}
            data-testid='add-tool-name'
          />
        </div>

        {kind === 'remote-mcp' ? (
          <>
            <div>
              <div className='mb-8px text-sm text-t-primary'>{t('settings.mcpRemoteUrl', { defaultValue: 'MCP endpoint URL' })}</div>
              <Input
                value={url}
                onChange={setUrl}
                placeholder='https://example.com/mcp'
                data-testid='add-tool-url'
              />
              <div className='mt-6px text-11px text-t-tertiary'>
                {t('settings.mcpStreamableHttpHint', {
                  defaultValue: 'Uses the MCP Streamable HTTP transport through the existing backend connection.',
                })}
              </div>
            </div>
            <div>
              <div className='mb-8px text-sm text-t-primary'>{t('settings.mcpAuth', { defaultValue: 'Authentication' })}</div>
              <Radio.Group value={authMode} onChange={setAuthMode}>
                <Radio value='none'>{t('settings.mcpAuthNone', { defaultValue: 'None' })}</Radio>
                <Radio value='oauth'>{t('settings.mcpAuthOAuth', { defaultValue: 'OAuth' })}</Radio>
                <Radio value='bearer' disabled>
                  {t('settings.mcpAuthBearer', { defaultValue: 'Bearer token' })} · {t('common.comingSoon', { defaultValue: 'Coming soon' })}
                </Radio>
              </Radio.Group>
              {authMode === 'oauth' && (
                <Alert
                  className='mt-8px'
                  type='info'
                  content={t('settings.mcpOAuthAfterSave', {
                    defaultValue: 'After saving, the existing MCP OAuth flow will ask the backend to authenticate this URL.',
                  })}
                />
              )}
            </div>
          </>
        ) : (
          <>
            <div>
              <div className='mb-8px text-sm text-t-primary'>{t('settings.mcpCommand', { defaultValue: 'Command' })}</div>
              <Input
                value={command}
                onChange={setCommand}
                placeholder='npx'
                data-testid='add-tool-command'
              />
            </div>
            <div>
              <div className='mb-8px text-sm text-t-primary'>{t('settings.mcpArgs', { defaultValue: 'Arguments' })}</div>
              <Input.TextArea
                value={args}
                onChange={setArgs}
                placeholder={'-y\n@org/mcp-server'}
                autoSize={{ minRows: 3, maxRows: 6 }}
                data-testid='add-tool-args'
              />
              <div className='mt-6px text-11px text-t-tertiary'>
                {t('settings.mcpArgsHint', { defaultValue: 'One argument per line.' })}
              </div>
            </div>
          </>
        )}
      </Space>
    </Modal>
  );
};

export default AddToolModal;
