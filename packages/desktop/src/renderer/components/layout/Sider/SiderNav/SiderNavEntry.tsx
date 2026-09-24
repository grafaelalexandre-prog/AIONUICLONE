/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tooltip } from '@arco-design/web-react';
import classNames from 'classnames';
import React from 'react';
import type { SiderTooltipProps } from '@renderer/utils/ui/siderTooltip';

interface SiderNavEntryProps {
  label: string;
  icon: React.ReactNode;
  isActive?: boolean;
  disabled?: boolean;
  collapsed: boolean;
  isMobile?: boolean;
  siderTooltipProps: SiderTooltipProps;
  onClick?: () => void;
  trailing?: React.ReactNode;
}

const SiderNavEntry: React.FC<SiderNavEntryProps> = ({
  label,
  icon,
  isActive = false,
  disabled = false,
  collapsed,
  isMobile = false,
  siderTooltipProps,
  onClick,
  trailing,
}) => {
  const rowClassName = classNames(
    'box-border group h-34px w-full flex items-center shrink-0 cursor-pointer transition-colors text-t-primary',
    collapsed ? 'justify-center px-0 rd-8px' : 'justify-start gap-8px ps-10px pe-8px rd-8px',
    isMobile && 'sider-action-btn-mobile',
    isActive ? 'bg-fill-3' : 'hover:bg-fill-3 active:bg-fill-4',
    disabled && 'cursor-not-allowed opacity-55 hover:bg-transparent active:bg-transparent'
  );

  const content = (
    <div
      className={rowClassName}
      role={disabled ? 'button' : undefined}
      aria-disabled={disabled || undefined}
      aria-current={isActive ? 'page' : undefined}
      onClick={disabled ? undefined : onClick}
    >
      <span className='size-22px flex items-center justify-center shrink-0 text-t-primary'>{icon}</span>
      {!collapsed && <span className='collapsed-hidden truncate text-14px font-[500] leading-24px'>{label}</span>}
      {!collapsed && trailing && <span className='ms-auto shrink-0'>{trailing}</span>}
    </div>
  );

  return (
    <Tooltip {...siderTooltipProps} content={label} position='right'>
      {content}
    </Tooltip>
  );
};

export default SiderNavEntry;
