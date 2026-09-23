/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit tests for the Project Agent prompt builders (pure functions).
 *
 * These rules are the core of the MVP contract: the agent must never treat a
 * completed tool call as a completed task, must run ACTION -> OBSERVE ->
 * VERIFY per step, must re-check persistence after writes, and must emit a
 * structured final report. If any of these guarantees drift out of the prompt,
 * these tests fail on purpose.
 */

import { describe, expect, it } from 'vitest';
import {
  buildMissionPrompt,
  buildProjectAgentRules,
  buildProjectAgentSkillMarkdown,
  isValidTargetUrl,
  parseTargetUrlFromJson,
  serializeTargetUrlJson,
} from '@/renderer/pages/conversation/components/ProjectAgent/missionPrompt';
import { PROJECT_AGENT_SKILL_NAME } from '@/renderer/pages/conversation/components/ProjectAgent/constants';

const CONTEXT = {
  project_id: 'OBRA-MODELO-EAP-001',
  project_name: 'Edifício Residencial Modelo EAP',
  workspace: 'C:/projects/obra-modelo',
  target_url: 'https://meu-sistema.onrender.com',
};

describe('buildProjectAgentRules', () => {
  const rules = buildProjectAgentRules();

  it('requires the ACTION -> OBSERVE -> VERIFY loop', () => {
    expect(rules).toContain('ACTION -> OBSERVE -> VERIFY');
  });

  it('requires explicit PASS/FAIL verification markers', () => {
    expect(rules).toContain('`VERIFY: PASS`');
    expect(rules).toContain('`VERIFY: FAIL: <reason>`');
  });

  it('forbids faking success and forbids tool-success == task-success', () => {
    expect(rules).toContain('do NOT fake success');
    expect(rules).toContain('Never claim an operation is complete just because the tool call');
  });

  it('requires a persistence check after writes', () => {
    expect(rules).toContain('Persistence check');
    expect(rules).toContain('is not persistence.');
  });
  it('restricts the agent to the existing browser MCP and forbids invented tools', () => {
    expect(rules).toContain('`aionui-browser`');
    expect(rules).toContain('Never invent tool names.');
  });

  it('bounds retries and keeps the user in control', () => {
    expect(rules).toContain('at most 1 safe alternative');
    expect(rules).toContain('Never close the browser or its tabs.');
  });

  it('defines the structured final report', () => {
    expect(rules).toContain('PROJECT AGENT - RESULT');
    expect(rules).toContain('Status: COMPLETED | FAILED | PARTIAL');
    expect(rules).toContain('Next action:');
  });

  it('requires user-language reporting', () => {
    expect(rules).toContain("user's language");
  });
});

describe('buildMissionPrompt', () => {
  it('embeds the project context, rules and mission', () => {
    const prompt = buildMissionPrompt(CONTEXT, 'Criar obra "Obra Teste Agente" e verificar.');
    expect(prompt).toContain('# Project Agent mission');
    expect(prompt).toContain(`- project_id: ${CONTEXT.project_id}`);
    expect(prompt).toContain(`- project_name: ${CONTEXT.project_name}`);
    expect(prompt).toContain(`- workspace: ${CONTEXT.workspace}`);
    expect(prompt).toContain(`- target_url: ${CONTEXT.target_url}`);
    expect(prompt).toContain('## Project Agent rules');
    expect(prompt).toContain('## Mission');
    expect(prompt).toContain('Criar obra "Obra Teste Agente" e verificar.');
  });

  it('falls back to explicit placeholders instead of blank fields', () => {
    const prompt = buildMissionPrompt(
      { project_id: null, project_name: null, workspace: 'C:/w', target_url: '' },
      'test'
    );
    expect(prompt).toContain('- project_id: (no project linked)');
    expect(prompt).toContain('- project_name: (unknown)');
    expect(prompt).toContain('- target_url: (not set — ask the user for the URL)');
  });
});

describe('buildProjectAgentSkillMarkdown', () => {
  it('emits valid SKILL.md frontmatter with the canonical name', () => {
    const skill = buildProjectAgentSkillMarkdown();
    expect(skill.startsWith('---\n')).toBe(true);
    expect(skill).toContain(`name: ${PROJECT_AGENT_SKILL_NAME}`);
    expect(skill).toMatch(/description: >-/);
  });

  it('carries the same rule source as the mission prompt', () => {
    expect(buildProjectAgentSkillMarkdown()).toContain(buildProjectAgentRules());
  });
});

describe('isValidTargetUrl', () => {
  it('accepts http(s) URLs', () => {
    expect(isValidTargetUrl('https://meu-sistema.onrender.com')).toBe(true);
    expect(isValidTargetUrl('http://127.0.0.1:8787/')).toBe(true);
    expect(isValidTargetUrl('  https://a.b  ')).toBe(true);
  });

  it('rejects non-http schemes, junk and empty input', () => {
    expect(isValidTargetUrl('')).toBe(false);
    expect(isValidTargetUrl('   ')).toBe(false);
    expect(isValidTargetUrl('ftp://x')).toBe(false);
    expect(isValidTargetUrl('file:///C:/x')).toBe(false);
    expect(isValidTargetUrl('javascript:alert(1)')).toBe(false);
    expect(isValidTargetUrl('not a url')).toBe(false);
  });
});

describe('parseTargetUrlFromJson', () => {
  it('reads a valid config file', () => {
    expect(parseTargetUrlFromJson('{"target_url": "https://a.b"}')).toBe('https://a.b');
  });

  it('tolerates missing file, invalid JSON and wrong shapes', () => {
    expect(parseTargetUrlFromJson(null)).toBe('');
    expect(parseTargetUrlFromJson(undefined)).toBe('');
    expect(parseTargetUrlFromJson('')).toBe('');
    expect(parseTargetUrlFromJson('not json')).toBe('');
    expect(parseTargetUrlFromJson('[]')).toBe('');
    expect(parseTargetUrlFromJson('null')).toBe('');
    expect(parseTargetUrlFromJson('{"target_url": 42}')).toBe('');
  });

  it('rejects invalid URLs stored in the file', () => {
    expect(parseTargetUrlFromJson('{"target_url": "javascript:alert(1)"}')).toBe('');
  });
});

describe('serializeTargetUrlJson', () => {
  it('round-trips with the parser', () => {
    const raw = serializeTargetUrlJson('  https://meu-sistema.onrender.com  ');
    expect(parseTargetUrlFromJson(raw)).toBe('https://meu-sistema.onrender.com');
  });
});
