/**
 * Copy-and-paste prompt for Maestro, one per "This week's 5" pick (Kris, Nov 23).
 * Maestro already knows which template and playlist to use and how he works (Kris: don't tell him, don't over-describe).
 * The prompt only gives the contact, what they ask for, and a short reminder of the holds.
 */
export type Pick = { name: string; company: string; type: string; email: string; how: string; row: string };

export function maestroPrompt(p: Pick, weekLabel?: string): string {
  const ask = (p.how ?? '').trim();
  return [
    `Maestro, one of Kris's sync picks for this week${weekLabel ? ` (${weekLabel})` : ''}. Please handle it with your usual system.`,
    '',
    `Contact: ${p.name}${p.company ? ` (${p.company})` : ''}, ${p.type || 'contact'}`,
    `Email: ${p.email}`,
    ...(p.row ? [`Tracker row: ${p.row}`] : []),
    '',
    'Only tailor your usual outreach to what they ask for:',
    ask ? `- ${ask}` : '- Nothing special on file; send it the way you normally would.',
    '',
    "Same rules as always. Skip anyone on the Durango hold, and anyone you've been told not to contact or to hold off on.",
  ].join('\n');
}
