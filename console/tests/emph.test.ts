import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { emph } from '../src/app/emph';

const html = (s: string) => renderToStaticMarkup(React.createElement(React.Fragment, null, emph(s)));
describe('Readability emphasis', () => {
  it('wraps numbers, money, dates and times; keeps every word', () => {
    const h = html('Deliver Artist S’s ~2 mixes · Overdue 13 days (due Tue, Nov 10) · $150 at 6:30–8:30 PM · +14%');
    expect(h.replace(/<[^>]+>/g, '')).toBe('Deliver Artist S’s ~2 mixes · Overdue 13 days (due Tue, Nov 10) · $150 at 6:30–8:30 PM · +14%');
    expect(h).toContain('<span class="n">~2</span>');
    expect(h).toContain('<span class="n">Tue, Nov 10</span>');
    expect(h).toContain('<span class="n">$150</span>');
    expect(h).toContain('<span class="n">6:30–8:30 PM</span>');
    expect(h).toContain('<span class="st bad">Overdue</span>');
  });
  it('status words keep their word, tinted by meaning', () => {
    expect(html('✓ sent')).toContain('st ok');
    expect(html('due today')).toContain('st warn');
    expect(html('unpaid and rebooked')).not.toContain('class="st');
  });
});
