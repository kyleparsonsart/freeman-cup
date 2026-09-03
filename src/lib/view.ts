/**
 * Acting as: the commissioner's two jobs, behind one switch. Player is
 * the default — scores-anywhere powers arm only while acting as
 * commissioner, and the header wears the crown so armed thumbs are
 * never a surprise. Per-device, survives reopen; the cog menu stays
 * the commissioner's in both modes.
 */
export type Acting = 'player' | 'commish';

const KEY = 'fc-acting';

export function getActing(): Acting {
  try {
    return localStorage.getItem(KEY) === 'commish' ? 'commish' : 'player';
  } catch {
    return 'player';
  }
}

export function setActing(a: Acting): void {
  try {
    localStorage.setItem(KEY, a);
  } catch { /* private mode: the session keeps its in-memory choice */ }
}
