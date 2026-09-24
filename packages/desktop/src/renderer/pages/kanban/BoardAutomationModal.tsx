import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Input, Modal, Select, Spin, Tag } from '@arco-design/web-react';
import { Check, Robot, Send } from '@icon-park/react';
import type { Task } from '@/common/task/taskTypes';
import type {
  KanbanAutomationPlan,
  KanbanBoard,
  KanbanRole,
  UpdateKanbanBoardInput,
} from '@/common/kanban/kanbanTypes';
import { buildManagerPrompt, describeAction, parseAutomationPlan } from './boardAutomation';

type Phase = 'idle' | 'analyzing' | 'preview' | 'applying' | 'done';

type BoardAutomationModalProps = {
  visible: boolean;
  board: KanbanBoard;
  roles: KanbanRole[];
  onClose: () => void;
  onUpdateBoard: (input: UpdateKanbanBoardInput) => Promise<unknown>;
  onApplyPlan: (plan: KanbanAutomationPlan) => Promise<void>;
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitForTask(taskId: string): Promise<Task> {
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    // Poll one task at a time; these awaits are intentionally sequential.
    // eslint-disable-next-line no-await-in-loop
    const task = await window.taskAPI?.get(taskId);
    if (!task) throw new Error('A task de análise desapareceu.');
    if (task.status === 'completed') {
      if (!task.result) throw new Error('O agente terminou sem retornar um plano.');
      return task;
    }
    if (task.status === 'failed' || task.status === 'cancelled') {
      throw new Error(task.error || `A task de análise foi ${task.status}.`);
    }
    // eslint-disable-next-line no-await-in-loop
    await delay(1000);
  }
  throw new Error('A análise do agente excedeu o tempo limite.');
}

export function BoardAutomationModal({
  visible,
  board,
  roles,
  onClose,
  onUpdateBoard,
  onApplyPlan,
}: BoardAutomationModalProps) {
  const { t } = useTranslation();
  const [managerRoleId, setManagerRoleId] = useState<string | null>(board.manager_role_id);
  const [instructions, setInstructions] = useState(board.manager_instructions);
  const [command, setCommand] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [plan, setPlan] = useState<KanbanAutomationPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const managerRole = useMemo(() => roles.find((role) => role.id === managerRoleId), [managerRoleId, roles]);

  useEffect(() => {
    if (!visible) return;
    setManagerRoleId(board.manager_role_id);
    setInstructions(board.manager_instructions);
    setCommand('');
    setPlan(null);
    setError(null);
    setPhase('idle');
  }, [board, visible]);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await onUpdateBoard({ id: board.id, manager_role_id: managerRoleId, manager_instructions: instructions });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSavingSettings(false);
    }
  };

  const analyze = async () => {
    setError(null);
    if (!window.taskAPI) {
      setError(t('agentTasks.kanban.managerUnavailable', { defaultValue: 'The task API is unavailable.' }));
      return;
    }
    if (!managerRole || (!managerRole.assistant_id && !managerRole.team_id)) {
      setError(
        t('agentTasks.kanban.managerRoleRequired', { defaultValue: 'Choose an executable manager role first.' })
      );
      return;
    }
    if (!command.trim()) {
      setError(t('agentTasks.kanban.managerCommandRequired', { defaultValue: 'Describe what the agent should plan.' }));
      return;
    }
    setPhase('analyzing');
    try {
      const task = await window.taskAPI.create(buildManagerPrompt(board, managerRole, command.trim(), instructions), {
        assistant_id: managerRole.assistant_id ?? undefined,
        team_id: managerRole.team_id ?? undefined,
      });
      const completed = await waitForTask(task.id);
      setPlan(parseAutomationPlan(completed.result || '', board));
      setPhase('preview');
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : String(analysisError));
      setPhase('idle');
    }
  };

  const apply = async () => {
    if (!plan) return;
    setError(null);
    setPhase('applying');
    try {
      await onApplyPlan(plan);
      setPhase('done');
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : String(applyError));
      setPhase('preview');
    }
  };

  return (
    <Modal
      visible={visible}
      title={
        <span className='flex items-center gap-8px'>
          <Robot size={16} />
          {t('agentTasks.kanban.managerTitle', { defaultValue: 'Agente do board' })}
        </span>
      }
      onCancel={onClose}
      footer={null}
      style={{ width: 760, borderRadius: '12px' }}
      alignCenter
      getPopupContainer={() => document.body}
    >
      <div className='space-y-14px'>
        <div className='rounded-10px border border-solid border-[var(--color-border-2)] bg-[var(--color-fill-1)] p-12px'>
          <div className='mb-8px text-12px font-medium text-t-primary'>
            {t('agentTasks.kanban.managerRole', { defaultValue: 'Agente responsável' })}
          </div>
          <Select
            className='w-full'
            value={managerRoleId ?? undefined}
            placeholder={t('agentTasks.kanban.managerRolePlaceholder', { defaultValue: 'Selecione um responsável' })}
            onChange={(value) => setManagerRoleId(value)}
            disabled={phase === 'analyzing' || phase === 'applying'}
          >
            {roles.map((role) => (
              <Select.Option key={role.id} value={role.id}>
                {role.name}
              </Select.Option>
            ))}
          </Select>
          <Input
            className='mt-8px'
            value={instructions}
            onChange={(value) => setInstructions(value)}
            placeholder={t('agentTasks.kanban.managerInstructions', { defaultValue: 'Instruções do gerente do board' })}
            disabled={phase === 'analyzing' || phase === 'applying'}
          />
          <Button
            className='mt-8px'
            size='small'
            loading={savingSettings}
            onClick={() => void saveSettings()}
            disabled={phase === 'analyzing' || phase === 'applying'}
          >
            {t('agentTasks.kanban.managerSave', { defaultValue: 'Salvar agente do board' })}
          </Button>
        </div>

        <div>
          <div className='mb-6px text-12px font-medium text-t-primary'>
            {t('agentTasks.kanban.managerCommand', { defaultValue: 'O que você quer automatizar?' })}
          </div>
          <Input.TextArea
            value={command}
            onChange={setCommand}
            autoSize={{ minRows: 3, maxRows: 7 }}
            placeholder={t('agentTasks.kanban.managerCommandPlaceholder', {
              defaultValue: 'Ex.: mova os cards P0 para Execução e atribua revisão ao Hermes.',
            })}
            disabled={phase === 'analyzing' || phase === 'applying' || phase === 'done'}
          />
        </div>

        {error ? (
          <div className='rounded-8px border border-danger-2 bg-danger-1 px-10px py-8px text-12px text-danger-6'>
            {error}
          </div>
        ) : null}

        {phase === 'analyzing' ? (
          <div className='flex items-center justify-center gap-8px py-18px text-12px text-t-secondary'>
            <Spin size={16} />
            {t('agentTasks.kanban.managerAnalyzing', { defaultValue: 'O agente está preparando um plano...' })}
          </div>
        ) : null}

        {phase === 'preview' && plan ? (
          <div className='rounded-10px border border-solid border-primary/30 bg-primary/5 p-12px'>
            <div className='flex items-start gap-8px'>
              <Check theme='outline' size={16} className='mt-2px text-primary' />
              <div className='min-w-0 flex-1'>
                <div className='text-13px font-medium text-t-primary'>
                  {t('agentTasks.kanban.managerPreview', { defaultValue: 'Prévia do plano' })}
                </div>
                <div className='mt-3px text-12px text-t-secondary'>{plan.summary}</div>
              </div>
            </div>
            <div className='mt-10px max-h-220px space-y-6px overflow-y-auto'>
              {plan.actions.length === 0 ? (
                <Empty
                  description={t('agentTasks.kanban.managerNoActions', { defaultValue: 'No changes proposed.' })}
                />
              ) : null}
              {plan.actions.map((action, index) => (
                <div
                  key={`${action.type}-${index}`}
                  className='flex items-start gap-8px rounded-8px bg-[var(--color-bg-1)] px-9px py-7px text-12px text-t-primary'
                >
                  <Tag size='small' color='blue' className='shrink-0'>
                    {action.type}
                  </Tag>
                  <span>{describeAction(action, board)}</span>
                </div>
              ))}
            </div>
            <div className='mt-12px flex justify-end gap-8px'>
              <Button
                onClick={() => {
                  setPlan(null);
                  setPhase('idle');
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button type='primary' icon={<Check size={14} />} onClick={() => void apply()}>
                {t('agentTasks.kanban.managerApply', { defaultValue: 'Aplicar alterações' })}
              </Button>
            </div>
          </div>
        ) : null}

        {phase === 'applying' ? (
          <div className='flex items-center justify-center gap-8px py-18px text-12px text-t-secondary'>
            <Spin size={16} />
            {t('agentTasks.kanban.managerApplying', { defaultValue: 'Aplicando o plano aprovado...' })}
          </div>
        ) : null}

        {phase === 'done' ? (
          <div className='flex items-center justify-between gap-12px rounded-8px border border-success-2 bg-success-1 px-10px py-9px text-12px text-success-6'>
            <span>{t('agentTasks.kanban.managerDone', { defaultValue: 'Board updated successfully.' })}</span>
            <Button type='text' size='small' onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        ) : null}

        {phase === 'idle' ? (
          <div className='flex justify-end'>
            <Button
              type='primary'
              icon={<Send size={14} />}
              onClick={() => void analyze()}
              disabled={!command.trim() || !managerRole}
            >
              {t('agentTasks.kanban.managerAnalyze', { defaultValue: 'Analisar com agente' })}
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
