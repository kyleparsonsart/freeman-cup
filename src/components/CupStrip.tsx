import { useEffect, useState } from 'react';
import { totals, half, CFG, MATCHES } from '../lib/scoring';

/** Cup score strip: points each side, the jug, the tug bar, clinch ticks. */
export default function CupStrip() {
  const { a, b } = totals();
  const T = MATCHES.length || 1;
  const C = Math.floor(T / 2) + 0.5;
  const pa = a / T * 100, pb = b / T * 100, cp = C / T * 100;
  const lead = a === b ? 'All square' : `${a > b ? CFG.teams.a.name : CFG.teams.b.name} lead`;

  // the bars grow in from zero on mount (CSS transitions the widths)
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  const paw = grown ? pa : 0, pbw = grown ? pb : 0;

  return (
    <div className="strip">
      <div className="striptop">
        <div className="sside a">
          <span className="pt">{half(a)}</span>
          <span className="nm">{CFG.teams.a.name}</span>
        </div>
        <div className="jugwrap">
          <TrophySvg />
          <span className="juglbl">{CFG.trophy}</span>
        </div>
        <div className="sside r b">
          <span className="nm">{CFG.teams.b.name}</span>
          <span className="pt">{half(b)}</span>
        </div>
      </div>
      <div className="tug">
        <div className="f fa" style={{ width: `${paw}%` }} />
        <div className="f fb" style={{ width: `${pbw}%` }} />
        <div className="live" style={{ left: `${paw}%`, right: `${pbw}%` }} />
        <div className="tick" style={{ left: `${cp}%` }} />
        <div className="tick" style={{ right: `${cp}%` }} />
      </div>
      <div className="striplbl">
        <span>{half(a + b)} of {T} decided</span>
        <span>{lead} · {half(C - Math.max(a, b))} to clinch</span>
      </div>
    </div>
  );
}

export function TrophySvg() {
  return (
    <svg className="jug" viewBox="0 0 56 100" aria-hidden="true">
      <g fill="currentColor">
        <circle cx="27" cy="4" r="3.2"/><rect x="25.4" y="6.5" width="3.2" height="3.5"/>
        <path d="M15 17.5c0-7.5 24-7.5 24 0v1.5H15z"/><path d="M15.5 20.5h23l1.5 5.5H14z"/>
        <path d="M20.5 26h13v6.5h-13z"/>
        <path d="M33.5 32.5c8.5 4.5 12.5 12.5 12.5 21.5 0 12-8 20.5-19 20.5S8 65.5 8 53.5c0-9 4-17 12.5-21.5z"/>
        <rect x="22.5" y="74" width="9" height="8.5"/><path d="M14 89c0-6.5 4.5-8.5 13-8.5s13 2 13 8.5z"/>
        <rect x="7" y="89" width="40" height="5"/><rect x="3" y="94" width="48" height="6"/>
      </g>
      <path d="M37 37.5c8 1.5 12 7.5 12 14s-5.5 10.5-10.5 10.5" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round"/>
      <path d="M15.5 18c-4.5-1-8-3.5-9.5-7.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/>
    </svg>
  );
}
