import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MomentOverlay from './Moments';
import type { MomentsState } from '../lib/moments';

const ms: MomentsState = {
  days: [{
    key: 'day:Thu Oct 8', day: 'Thu Oct 8', dow: 'Thursday', courses: 'Mammoth Dunes',
    headline: 'Vikes take the opening day',
    pts: { a: 1.5, b: 0.5 }, cum: { a: 1.5, b: 0.5 }, toClinch: 4,
    rows: [{ a: 'Griffin / Matt', b: 'Kyle / JT', label: 'VIK 4 & 3', w: 'a' }],
    next: { course: 'The Commons', rd: 'Round 2', fmt: 'Foursomes', holes: 12, tees: '8:00am and 8:10am' },
  }],
  duelPending: true,
  tie: { a: 5, b: 5 },
  won: {
    key: 'won', winner: 'b', pts: { a: 4.5, b: 5.5 },
    kick: 'Saturday · Sedge Valley · 2:41pm',
    how: 'Clinched when Justin closed out Devin, 2 & 1.',
    viaShootout: false, shootout: null,
    roster: 'Kyle, Phil, Justin and JT',
    mvp: { name: 'Justin', line: '−4 net across three rounds' },
  },
  captains: { a: 'Griffin', b: 'Kyle' },
};

const render = (openKey: string, commissioner = false) =>
  renderToStaticMarkup(
    <MomentOverlay
      ms={ms} openKey={openKey} commissioner={commissioner}
      onClose={() => {}} onSeeLive={() => {}} onEnterScores={() => {}}
    />,
  );

describe('MomentOverlay', () => {
  it('leaves the day recap and the finale to the share cards', () => {
    expect(render('day:Thu Oct 8')).toBe('');
    expect(render('won')).toBe('');
  });

  it('renders the shootout intro; the commissioner gets the entry door', () => {
    expect(render('duel')).toContain('To the practice green');
    const commish = render('duel', true);
    expect(commish).toContain('Enter the putts');
    expect(commish).toContain('The Knee Knocker');
  });

  it('renders nothing for a key with no derived moment behind it', () => {
    expect(render('day:Fri Oct 9')).toBe('');
  });
});
