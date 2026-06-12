// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ThinkingIndicator } from '../../../src/client/components/chat/ThinkingIndicator.js';

describe('ThinkingIndicator', () => {
  it('renders the default "Thinking" label', () => {
    render(<ThinkingIndicator />);
    expect(screen.getByText('Thinking')).toBeInTheDocument();
  });

  it('renders a custom label when provided', () => {
    render(<ThinkingIndicator label="Analyzing" />);
    expect(screen.getByText('Analyzing')).toBeInTheDocument();
    expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
  });

  it('renders exactly 3 pulsing dots', () => {
    const { container } = render(<ThinkingIndicator />);
    const dots = container.querySelectorAll('div[style]');
    // The outer wrapper + 3 dot divs = 4 minimum children of styled divs
    // More precisely: find the dot elements (width:6, height:6, borderRadius:50%)
    const allDivs = container.querySelectorAll('div');
    // The indicator wrapper has 3 dot children + 1 label span
    const wrapper = allDivs[0]; // outermost div
    const dotElements = Array.from(wrapper.children).filter(
      el => el instanceof HTMLDivElement
    );
    expect(dotElements).toHaveLength(3);
  });
});
