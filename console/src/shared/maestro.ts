/**
 * Copy-and-paste prompt for Maestro, one per "This week's 5" pick (Kris, Nov 23).
 * Maestro already knows which template and playlist to use (Kris: don't tell him). The prompt only gives the contact,
 * what they ask for, and the Sync Tracker's existing rules. It adds no new process.
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
    "Same rules as always (Sync Tracker): check the row and Gmail first that they haven't been contacted yet, and skip anyone on the Durango hold. Put it in a Gmail draft for Kris and set the row to Draft ready. Once it's sent, update Status, Last contacted and Follow-up on the row.",
    "If something they ask for doesn't fit what we have (for example exclusive-only material or a format we don't have ready), tell Kris instead of guessing.",
  ].join('\n');
}
