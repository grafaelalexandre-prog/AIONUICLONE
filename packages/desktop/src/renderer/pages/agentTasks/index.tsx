/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import classNames from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Empty, Input, Message, Popconfirm, Select, Spin, Tag } from '@arco-design/web-react';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import SettingsPageHeader from '@/renderer/pages/settings/components/SettingsPageHeader';
import { Delete, Robot, Send } from '@icon-park/react';
import type { Task } from '@/common/task/taskTypes';
import { selectableAssistants } from '@/renderer/utils/model/assistantSelection';
import { isTaskOnlyAssistant } from '@/common/task/taskAssistants';
import { useAssistantList } from '@/renderer/hooks/assistant/useAssistantList';
import { useAgentTasks } from './useAgentTasks';

/** Sentinel select value — the runner resolves the assistant itself (task-only first). */
const AUTO_ASSISTANT = '';

const statusColor = (status: Task['status']): string => {
  switch (status) {
    case 'pending':
      return 'orange';
    case 'running':
      return 'blue';
    case 'completed':
      return 'green';
    case 'failed':
      return 'red';
    default:
      return 'gray';
  }
};

const TaskStatusTag: React.FC<{ status: Task['status'] }> = ({ status }) => {
  const { t } = useTranslation();
  const label = t(`agentTasks.status${status.charAt(0).toUpperCase() + status.slice(1)}`);
  return <Tag color={statusColor(status)}>{label}</Tag>;
};

const AgentTasksPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tasks, loading, error, creating, createTask, deleteTask } = useAgentTasks();
  const { assistants, localeKey } = useAssistantList();
  const [mission, setMission] = useState('');
  const [assistantId, setAssistantId] = useState<string>(AUTO_ASSISTANT);
  const hasTaskApi = typeof window !== 'undefined' && Boolean(window.taskAPI);

  // Enabled assistants with task-only ones (Cline) surfaced first — they are
  // the intended default for autonomous tasks.
  const assistantOptions = useMemo(() => {
    const enabled = selectableAssistants(assistants);
    return [...enabled.filter(isTaskOnlyAssistant), ...enabled.filter((a) => !isTaskOnlyAssistant(a))];
  }, [assistants]);

  const handleCreate = useCallback(async () => {
    const trimmed = mission.trim();
    if (!trimmed || creating) return;
    try {
      const options = assistantId === AUTO_ASSISTANT ? undefined : { assistant_id: assistantId };
      const task = await createTask(trimmed, options);
      if (task) {
        setMission('');
        Message.success(t('agentTasks.taskCreated'));
      }
    } catch (err) {
      Message.error(`${t('agentTasks.createError')}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [mission, assistantId, creating, createTask, t]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteTask(id);
        Message.success(t('agentTasks.deleteSuccess'));
      } catch (err) {
        Message.error(`${t('agentTasks.deleteError')}: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [deleteTask, t]
  );

  const row = (task: Task, index: number) => (
    <div
      className={classNames(
        'group flex items-center justify-between gap-12px rounded-12px border border-solid border-transparent bg-transparent px-12px py-6px transition-colors duration-180 hover:bg-fill-2',
        isMobile ? '' : 'min-h-48px'
      )}
      style={{ marginBottom: index === tasks.length - 1 ? 0 : 12 }}
      onClick={() => task.agent_id && void navigate(`/conversation/${task.agent_id}`)}
    >
      <div className='flex items-center gap-12px min-w-0 flex-1'>
        <span className='shrink-0 flex h-24px w-24px items-center justify-center rounded-full bg-fill-2 text-12px text-t-secondary'>
          <Robot size={16} className='shrink-0' />
        </span>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-8px min-w-0'>
            <span className='min-w-0 truncate text-14px leading-19px font-medium text-t-primary'>{task.mission}</span>
            <TaskStatusTag status={task.status} />
          </div>
          {task.agent_id && (
            <span className='mt-1px block truncate text-12px leading-16px text-t-secondary'>
              {t('agentTasks.conversationLabel')} {task.agent_id.slice(0, 12)}…
            </span>
          )}
        </div>
      </div>
      <div className='flex shrink-0 items-center gap-6px' onClick={(e) => e.stopPropagation()}>
        <Popconfirm content={t('agentTasks.deleteConfirm')} onConfirm={() => handleDelete(task.id)}>
          <Delete
            theme='outline'
            size={14}
            className='shrink-0 text-t-secondary hover:text-danger-6 cursor-pointer'
            aria-label={t('agentTasks.deleteAria')}
          />
        </Popconfirm>
      </div>
    </div>
  );

  if (!hasTaskApi) {
    return (
      <div className='w-full h-full min-h-0 box-border bg-1 flex flex-col overflow-hidden'>
        <div className='px-12px pt-14px pb-14px md:px-40px md:pt-32px md:pb-16px'>
          <SettingsPageHeader title={t('agentTasks.headerTitle')} description={t('agentTasks.headerDescription')} />
        </div>
        <div className='px-12px pb-24px md:px-40px md:pb-32px flex min-h-0 flex-1 items-center justify-center'>
          <Empty description={t('agentTasks.unavailable')} />
        </div>
      </div>
    );
  }

  return (
    <div className='w-full h-full min-h-0 box-border bg-1 flex flex-col overflow-hidden'>
      <div
        className={classNames(
          'shrink-0 bg-1',
          isMobile ? 'px-16px pt-14px pb-14px' : 'px-12px pt-14px pb-14px md:px-40px md:pt-32px md:pb-16px'
        )}
      >
        <div className='mx-auto w-full max-w-800px box-border'>
          <SettingsPageHeader
            sticky={false}
            data-testid='agent-tasks-header'
            title={t('agentTasks.headerTitle')}
            description={t('agentTasks.headerDescription')}
          />
        </div>
      </div>

      {/* Mission composer — task-only assistants are offered first; leaving the
          select on "auto" lets the runner resolve (it prefers task-only too). */}
      <div className={classNames('shrink-0', isMobile ? 'px-16px pb-14px' : 'px-12px pb-14px md:px-40px md:pb-16px')}>
        <div className='mx-auto w-full max-w-800px box-border flex items-stretch gap-8px'>
          <Select
            className='w-180px shrink-0'
            value={assistantId}
            onChange={(value) => setAssistantId(value as string)}
            aria-label={t('agentTasks.assistantLabel')}
            disabled={assistantOptions.length === 0}
          >
            <Select.Option value={AUTO_ASSISTANT}>{t('agentTasks.assistantAuto')}</Select.Option>
            {assistantOptions.map((assistant) => (
              <Select.Option key={assistant.id} value={assistant.id}>
                {assistant.name_i18n?.[localeKey] || assistant.name}
              </Select.Option>
            ))}
          </Select>
          <Input.TextArea
            className='flex-1'
            value={mission}
            placeholder={t('agentTasks.newTaskPlaceholder')}
            onChange={setMission}
            onPressEnter={(event) => {
              if (event.nativeEvent.isComposing) return;
              event.preventDefault();
              void handleCreate();
            }}
            autoSize={{ minRows: 2, maxRows: 6 }}
            disabled={creating}
          />
          <Button
            type='primary'
            icon={<Send size={14} />}
            onClick={handleCreate}
            loading={creating}
            disabled={!mission.trim()}
            className='self-flex-start'
          >
            {t('agentTasks.createNewTask')}
          </Button>
        </div>
      </div>

      {loading && tasks.length === 0 ? (
        <div className='flex min-h-220px items-center justify-center rounded-16px border border-dashed border-border-2 bg-fill-1'>
          <Spin />
        </div>
      ) : error ? (
        <div className='flex min-h-220px items-center justify-center rounded-16px border border-dashed border-border-2 bg-fill-1'>
          <Empty description={t('agentTasks.createError')} />
        </div>
      ) : tasks.length === 0 ? (
        <div className='flex min-h-220px items-center justify-center rounded-16px border border-dashed border-border-2 bg-fill-1'>
          <Empty description={t('agentTasks.noTasks')} />
        </div>
      ) : (
        <div
          className={classNames(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-12px pb-24px md:px-40px md:pb-32px',
            isMobile ? 'px-16px' : ''
          )}
        >
          <div className='mx-auto flex w-full max-w-800px box-border flex-col gap-16px md:gap-14px'>
            {tasks.map((task, index) => (
              <React.Fragment key={task.id}>{row(task, index)}</React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentTasksPage;
