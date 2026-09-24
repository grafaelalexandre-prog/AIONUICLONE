import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Tools sidebar label', () => {
  it('uses the localized Tools label for the MCP/tools entry', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'packages/desktop/src/renderer/components/layout/Sider/index.tsx'),
      'utf8'
    );
    expect(source).toContain("label={t('settings.tools', { defaultValue: 'Tools' })}");
    expect(source).not.toContain("label={t('agentTasks.plugins')}");
  });
});
