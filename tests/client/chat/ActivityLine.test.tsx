// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ActivityLine } from '../../../src/client/components/chat/ActivityLine.js';
import type { CopilotStatusEvent } from '../../../src/client/api.js';

function makeEvent(overrides: Partial<CopilotStatusEvent> = {}): CopilotStatusEvent {
  return { type: 'status', step: 'selecting-model', ...overrides };
}

describe('ActivityLine', () => {
  it('renders a known step label', () => {
    const { container } = render(<ActivityLine event={makeEvent()} isLatest={true} />);
    expect(container.textContent).toContain('Selecting model');
  });

  it('renders the step string for unknown steps', () => {
    const { container } = render(
      <ActivityLine event={makeEvent({ step: 'custom-step' })} isLatest={true} />
    );
    expect(container.textContent).toContain('custom-step');
  });

  it('renders known step icons', () => {
    const { container } = render(<ActivityLine event={makeEvent()} isLatest={true} />);
    expect(container.textContent).toContain('🔍');
  });

  it('renders the fallback icon for unknown steps', () => {
    const { container } = render(
      <ActivityLine event={makeEvent({ step: 'unknown' })} isLatest={true} />
    );
    expect(container.textContent).toContain('•');
  });

  it('renders provider and model', () => {
    const { container } = render(
      <ActivityLine event={makeEvent({ step: 'sending-request', provider: 'anthropic', model: 'claude/sonnet-4' })} isLatest={true} />
    );
    expect(container.textContent).toContain('anthropic/sonnet-4');
  });

  it('renders messageCount with pluralization', () => {
    const { container } = render(
      <ActivityLine event={makeEvent({ step: 'response-received', messageCount: 3 })} isLatest={true} />
    );
    expect(container.textContent).toContain('3 msgs');
  });

  it('renders messageCount singular', () => {
    const { container } = render(
      <ActivityLine event={makeEvent({ step: 'response-received', messageCount: 1 })} isLatest={true} />
    );
    expect(container.textContent).toContain('1 msg');
  });

  it('renders toolCount when > 0', () => {
    const { container } = render(
      <ActivityLine event={makeEvent({ step: 'response-received', toolCount: 2 })} isLatest={true} />
    );
    expect(container.textContent).toContain('2 tools');
  });

  it('omits toolCount when 0', () => {
    const { container } = render(
      <ActivityLine event={makeEvent({ step: 'response-received', toolCount: 0 })} isLatest={false} />
    );
    expect(container.textContent).not.toContain('0 tool');
  });

  it('formats durationMs under 1 second', () => {
    const { container } = render(
      <ActivityLine event={makeEvent({ step: 'response-received', durationMs: 450 })} isLatest={true} />
    );
    expect(container.textContent).toContain('450ms');
  });

  it('formats durationMs over 1 second', () => {
    const { container } = render(
      <ActivityLine event={makeEvent({ step: 'response-received', durationMs: 2500 })} isLatest={true} />
    );
    expect(container.textContent).toContain('2.5s');
  });

  it('renders token counts with k suffix for large values', () => {
    const { container } = render(
      <ActivityLine event={makeEvent({ step: 'response-received', inputTokens: 2500, outputTokens: 800 })} isLatest={true} />
    );
    expect(container.textContent).toContain('2.5k→800 tok');
  });

  it('renders token counts as raw numbers for small values', () => {
    const { container } = render(
      <ActivityLine event={makeEvent({ step: 'response-received', inputTokens: 500 })} isLatest={true} />
    );
    expect(container.textContent).toContain('500 tok');
  });

  it('renders error text', () => {
    const { container } = render(
      <ActivityLine event={makeEvent({ step: 'error', error: 'Rate limited' })} isLatest={true} />
    );
    expect(container.textContent).toContain('Rate limited');
  });

  it('applies higher opacity when isLatest is true', () => {
    const { container: cLatest } = render(<ActivityLine event={makeEvent()} isLatest={true} />);
    const { container: cOld } = render(<ActivityLine event={makeEvent()} isLatest={false} />);
    const latestStyle = cLatest.firstChild as HTMLElement;
    const oldStyle = cOld.firstChild as HTMLElement;
    // isLatest: opacity 1, not isLatest: opacity 0.6
    expect(latestStyle.style.opacity).toBe('1');
    expect(oldStyle.style.opacity).toBe('0.6');
  });

  it('joins multiple parts with middle dot separator', () => {
    const { container } = render(
      <ActivityLine
        event={makeEvent({
          step: 'response-received',
          provider: 'anthropic',
          model: 'sonnet-4',
          durationMs: 1200,
          messageCount: 5,
        })}
        isLatest={true}
      />
    );
    const text = container.textContent!;
    // Should contain middle dot (·) between parts
    expect(text).toContain('·');
  });
});
