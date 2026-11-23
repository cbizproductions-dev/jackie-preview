/**
 * Readability emphasis (Kris, Nov 23): inside a sentence, numbers/money/dates/times render in IBM Plex Mono
 * (tabular, a shade brighter, one weight heavier) and status words are semibold and tinted. The words never change.
 */
import React from 'react';

const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?';
const DAY = '(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\\s+';
const PARTS = [
  // status words (semibold + tint; the word itself stays)
  `(?<st>✓ sent|\\bpast due\\b|\\boverdue\\b|\\bdue today\\b|\\bexpected\\b|\\bbooked\\b|\\bdelivered\\b|\\bhot\\b)`,
  // dates like "Mon Nov 23", "Nov 23, 2026", "2026-11-23"
  `(?<date>(?:${DAY})?${MONTH}\\s+\\d{1,2}(?:[–-]\\d{1,2})?(?:,\\s*\\d{4})?|\\b\\d{4}-\\d{2}-\\d{2}\\b)`,
  // times like "6:30–8:30 PM", "7 PM"
  `(?<time>\\b\\d{1,2}(?::\\d{2})?(?:\\s?[–-]\\s?\\d{1,2}(?::\\d{2})?)?\\s?(?:AM|PM)\\b|\\b\\d{1,2}:\\d{2}\\b)`,
  // money like "$1,780", "~$660", "$75/hr", "$15.2k"
  `(?<money>[~+−-]?\\$\\d[\\d,]*(?:\\.\\d+)?[kKmM]?(?:\\/(?:hr|wk|mo|yr|week|month|year))?)`,
  // counts, percents, multipliers like "8", "36%", "+14%", "3.8×", "×2", "1 → 81"
  `(?<num>(?:[~+−-]|×)?\\b\\d[\\d,]*(?:\\.\\d+)?(?:%|×|x\\b)?)`,
];
const RE = new RegExp(PARTS.join('|'), 'gi');
const TONE: Record<string, string> = { 'past due': 'bad', overdue: 'bad', 'due today': 'warn', expected: 'warn', booked: 'ok', delivered: 'ok', '✓ sent': 'ok', hot: 'warn' };

export function emph(text: string | null | undefined): React.ReactNode {
  if (!text) return text ?? '';
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    const g = m.groups ?? {};
    if (g.st) out.push(<span key={k++} className={`st ${TONE[g.st.toLowerCase()] ?? 'info'}`}>{m[0]}</span>);
    else out.push(<span key={k++} className="n">{m[0]}</span>);
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
}

/** <T>text</T>: the same text with emphasis. */
export function T({ children }: { children: string | null | undefined }) {
  return <>{emph(children)}</>;
}
