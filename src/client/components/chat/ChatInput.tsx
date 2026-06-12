import React, { useRef, useCallback } from 'react';

const TEXTAREA_MAX_HEIGHT = 160;

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Max textarea height in px. Default: 160 */
  maxHeight?: number;
  /** Forwarded ref to the textarea element */
  textareaRef?: React.Ref<HTMLTextAreaElement>;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
  maxHeight = TEXTAREA_MAX_HEIGHT,
  textareaRef,
}: ChatInputProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef || internalRef;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, [onChange, maxHeight]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }, [onSend]);

  return (
    <div>
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid var(--accent-primary-muted)',
          background: 'var(--bg-elevated)',
          color: 'var(--text-primary)',
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          resize: 'none',
          lineHeight: 1.5,
          maxHeight,
          boxSizing: 'border-box',
          display: 'block',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
        onBlur={e => e.target.style.borderColor = 'var(--accent-primary-muted)'}
      />
      <div style={{
        fontSize: 10,
        color: 'var(--text-tertiary)',
        marginTop: 6,
        textAlign: 'center',
      }}>
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}
