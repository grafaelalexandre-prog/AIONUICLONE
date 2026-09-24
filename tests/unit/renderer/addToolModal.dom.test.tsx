import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key }),
}));

vi.mock('@arco-design/web-react', () => ({
  Alert: ({ content }: { content: string }) => <div data-testid='alert'>{content}</div>,
  Input: Object.assign(
    ({ value, onChange, placeholder, ...props }: { value: string; onChange: (value: string) => void; placeholder?: string }) => (
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} {...props} />
    ),
    {
      TextArea: ({ value, onChange, placeholder, ...props }: { value: string; onChange: (value: string) => void; placeholder?: string }) => (
        <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} {...props} />
      ),
    }
  ),
  Modal: ({ visible, onOk, okText, children }: { visible: boolean; onOk: () => void; okText: string; children: React.ReactNode }) =>
    visible ? (
      <div>
        {children}
        <button onClick={onOk}>{okText}</button>
      </div>
    ) : null,
  Radio: Object.assign(({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) => <label>{children}{disabled ? ' disabled' : ''}</label>, {
    Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
  Space: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import AddToolModal from '@/renderer/pages/settings/ToolsSettings/AddToolModal';

describe('AddToolModal', () => {
  it('submits a real remote MCP draft through the existing server contract', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AddToolModal visible onCancel={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('add-tool-name'), { target: { value: 'Remote Engineering' } });
    fireEvent.change(screen.getByTestId('add-tool-url'), { target: { value: 'https://example.test/mcp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add MCP server' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        name: 'Remote Engineering',
        transport: { type: 'http', url: 'https://example.test/mcp' },
      })
    );
  });

  it('rejects an invalid remote URL before calling the backend', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AddToolModal visible onCancel={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('add-tool-name'), { target: { value: 'Remote Engineering' } });
    fireEvent.change(screen.getByTestId('add-tool-url'), { target: { value: 'file:///tmp/mcp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add MCP server' }));

    await waitFor(() => expect(screen.getByTestId('alert')).toHaveTextContent('Enter a valid HTTP(S) MCP URL.'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
