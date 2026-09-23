/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Minimal Project Agent mission UI: project context, target URL and mission
 * text. Starting a mission sends the composed prompt as a normal chat message
 * through the existing conversation runtime (no new execution pipeline) and
 * persists the target URL into `project-agent.json` inside the workspace.
 *
 * RISK (deliberately visible to the user): the in-app browser session
 * (`persist:aionui-browser`) is global — cookies/sign-in state are shared
 * across projects and tabs. The warning below states this; per-project session
 * isolation is out of MVP scope.
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { Input, Message, Modal, Typography } from '@arco-design/web-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildMissionPrompt, isValidTargetUrl } from './missionPrompt';
import { loadProjectAgentContext, saveTargetUrl } from './projectContext';
import { ensureProjectAgentSkillInstalled } from './skillInstaller';
import type { ProjectAgentContext } from './types';

export interface ProjectAgentMissionModalProps {
  visible: boolean;
  onClose: () => void;
  conversation: TChatConversation;
}

const ProjectAgentMissionModal: React.FC<ProjectAgentMissionModalProps> = ({ visible, onClose, conversation }) => {
  const { t } = useTranslation();
  const [context, setContext] = useState<ProjectAgentContext | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [urlText, setUrlText] = useState('');
  const [missionText, setMissionText] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setContext(null);
    setContextError(null);
    let cancelled = false;
    loadProjectAgentContext(conversation)
      .then((loaded) => {
        if (cancelled) return;
        setContext(loaded);
        setUrlText(loaded.target_url);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[ProjectAgent] failed to load context:', error);
        setContextError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [visible, conversation]);

  const handleStart = async () => {
    if (!context || starting) return;
    const mission = missionText.trim();
    const url = urlText.trim();
    if (!mission) {
      Message.warning(t('conversation.project_agent.mission_required'));
      return;
    }
    if (!isValidTargetUrl(url)) {
      Message.warning(t('conversation.project_agent.url_invalid'));
      return;
    }
    setStarting(true);
    try {
      if (url !== context.target_url) {
        await saveTargetUrl(context.workspace, url);
      }
      // Best effort: the mission prompt carries the rules inline, so a skill
      // install failure must not block the mission.
      await ensureProjectAgentSkillInstalled();
      const prompt = buildMissionPrompt({ ...context, target_url: url }, mission);
      await ipcBridge.conversation.sendMessage.invoke({ input: prompt, conversation_id: conversation.id });
      Message.success(t('conversation.project_agent.mission_started'));
      onClose();
    } catch (error) {
      console.error('[ProjectAgent] failed to start mission:', error);
      Message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setStarting(false);
    }
  };

  const projectLabel = context
    ? `${context.project_name ?? t('conversation.project_agent.no_project')}${context.project_id ? ` (${context.project_id})` : ''}`
    : '';

  return (
    <Modal
      title={t('conversation.project_agent.modal_title')}
      visible={visible}
      onCancel={onClose}
      confirmLoading={starting}
      onOk={() => void handleStart()}
      okText={t('conversation.project_agent.start_mission')}
      cancelText={t('conversation.project_agent.cancel')}
      okButtonProps={{ disabled: !context }}
      className='w-[90vw] md:w-[560px]'
      unmountOnExit
    >
      {contextError ? (
        <Typography.Text type='error'>
          {t('conversation.project_agent.context_error', { reason: contextError })}
        </Typography.Text>
      ) : !context ? (
        <Typography.Text type='secondary'>{t('conversation.project_agent.loading_context')}</Typography.Text>
      ) : (
        <div className='flex flex-col gap-12px'>
          <div>
            <Typography.Text type='secondary' className='text-12px'>
              {t('conversation.project_agent.project')}
            </Typography.Text>
            <div className='text-13px'>{projectLabel}</div>
            <Typography.Text type='secondary' className='text-12px'>
              {t('conversation.project_agent.workspace')}
            </Typography.Text>
            <div className='text-13px break-all'>{context.workspace}</div>
          </div>
          <div>
            <Typography.Text className='text-13px font-medium'>
              {t('conversation.project_agent.target_url')}
            </Typography.Text>
            <Input
              className='mt-4px'
              placeholder={t('conversation.project_agent.url_placeholder')}
              value={urlText}
              onChange={setUrlText}
              allowClear
            />
          </div>
          <div>
            <Typography.Text className='text-13px font-medium'>
              {t('conversation.project_agent.mission')}
            </Typography.Text>
            <Input.TextArea
              className='mt-4px'
              placeholder={t('conversation.project_agent.mission_placeholder')}
              value={missionText}
              onChange={setMissionText}
              autoSize={{ minRows: 4, maxRows: 10 }}
            />
          </div>
          <Typography.Text type='warning' className='text-12px'>
            {t('conversation.project_agent.shared_session_warning')}
          </Typography.Text>
        </div>
      )}
    </Modal>
  );
};

export default ProjectAgentMissionModal;
