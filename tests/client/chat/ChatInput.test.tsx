// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '../../../src/client/components/chat/ChatInput.js';

describe('ChatInput', () => {
  it('renders a textarea with the given value', () => {
    render(<ChatInput value="hello" onChange={vi.fn()} onSend={vi.fn()} />);
    const textarea = screen.getByPlaceholderText('Type a message...');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('hello');
  });

  it('calls onChange when typing', async () => {
    const onChange = vi.fn();
    render(<ChatInput value="" onChange={onChange} onSend={vi.fn()} />);
    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: 'hi' } });
    expect(onChange).toHaveBeenCalledWith('hi');
  });

  it('calls onSend when Enter is pressed without Shift', () => {
    const onSend = vi.fn();
    render(<ChatInput value="hello" onChange={vi.fn()} onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onSend when Shift+Enter is pressed', () => {
    const onSend = vi.fn();
    render(<ChatInput value="hello" onChange={vi.fn()} onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('renders disabled textarea when disabled=true', () => {
    render(<ChatInput value="" onChange={vi.fn()} onSend={vi.fn()} disabled={true} />);
    const textarea = screen.getByPlaceholderText('Type a message...');
    expect(textarea).toBeDisabled();
  });

  it('renders custom placeholder', () => {
    render(<ChatInput value="" onChange={vi.fn()} onSend={vi.fn()} placeholder="Ask away..." />);
    expect(screen.getByPlaceholderText('Ask away...')).toBeInTheDocument();
  });

  it('shows keyboard shortcut hint', () => {
    render(<ChatInput value="" onChange={vi.fn()} onSend={vi.fn()} />);
    expect(screen.getByText(/Press Enter to send/)).toBeInTheDocument();
  });

  it('uses the forwarded textareaRef', () => {
    const ref = { current: null as HTMLTextAreaElement | null };
    render(<ChatInput value="" onChange={vi.fn()} onSend={vi.fn()} textareaRef={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('TEXTAREA');
  });

  it('respects maxHeight prop', () => {
    render(<ChatInput value="" onChange={vi.fn()} onSend={vi.fn()} maxHeight={200} />);
    const textarea = screen.getByPlaceholderText('Type a message...');
    expect(textarea.style.maxHeight).toBe('200px');
  });

  it('defaults maxHeight to 160', () => {
    render(<ChatInput value="" onChange={vi.fn()} onSend={vi.fn()} />);
    const textarea = screen.getByPlaceholderText('Type a message...');
    expect(textarea.style.maxHeight).toBe('160px');
  });
});
