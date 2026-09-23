/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Project Agent entry point: a small header button that opens the mission
 * modal. Rendered only for aionrs conversations bound to a workspace — the
 * built-in agent runtime is the MVP execution path (no ACP, no new runtime).
 */

import type { TChatConversation } from '@/common/config/storage';
import { Button, Tooltip } from '@arco-design/web-react';
import { Rocket } from '@icon-park/react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { iconColors } from '@/renderer/styles/colors';
import ProjectAgentMissionModal from './MissionModal';

const isProjectAgentConversation = (conversation: TChatConversation): boolean =>
  conversation.type === 'aionrs' && Boolean((conversation.extra as { workspace?: string } | undefined)?.workspace);

const ProjectAgentMissionButton: React.FC<{ conversation: TChatConversation }> = ({ conversation }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  if (!isProjectAgentConversation(conversation)) return null;

  return (
    <>
      <Tooltip content={t('conversation.project_agent.button_title')}>
        <Button
          size='mini'
          icon={
            <Rocket
              theme='outline'
              size='14'
              fill={iconColors.primary}
              strokeWidth={3}
              strokeLinejoin='miter'
              strokeLinecap='square'
            />
          }
          onClick={() => setVisible(true)}
        />
      </Tooltip>
      <ProjectAgentMissionModal visible={visible} onClose={() => setVisible(false)} conversation={conversation} />
    </>
  );
};

export default ProjectAgentMissionButton;
