import { calc, getsStroke, ses, P, CFG, type Match } from '../lib/scoring';
import { bestName } from '../lib/feed';

/**
 * The full scorecard grid for one match, read-only. Ported from cardGrid()
 * in the prototype: header, par, stroke index, a row per player (or side
 * at foursomes), hole won, and the running match state. Out/In/Tot
 * columns; a 12-hole round gets Out only.
 */
export default function Scorecard({ match: m }: { match: Match }) {
  const s = ses(m.s);
  const N = s.holes;
  const r = calc(m);
  const H = [...Array(N).keys()];
  const keys = s.fmt === 'Foursomes' ? ['a', 'b'] : [...m.a, ...m.b];
  const nm = (k: string) => s.fmt === 'Foursomes' ? CFG.teams[k].name : (P[k]?.n.split(' ')[0] || k);
  const half1 = H.slice(0, Math.min(9, N));
  const half2 = H.slice(9);
  const cols = `86px repeat(${half1.length},44px) 46px${half2.length ? ` repeat(${half2.length},44px) 46px` : ''} 52px`;

  const tot = (k: string, f: number, t: number): number | '' => {
    let x = 0;
    for (let i = f; i < t; i++) {
      const g = m.hs[i] ? m.hs[i].sc[k] : null;
      if (typeof g === 'number') x += g;
    }
    return x || '';
  };
  const sumPar = (f: number, t: number) => s.par.slice(f, t).reduce((a, b) => a + b, 0);

  const box = (k: string, i: number) => {
    const h = m.hs[i];
    const g = h ? h.sc[k] : undefined;
    const st = getsStroke(m, k, i);
    const bn = bestName(m, s, i, 'a'), bn2 = bestName(m, s, i, 'b');
    const counting = (bn && bn.k === k) || (bn2 && bn2.k === k);
    const dead = r.done && i >= r.byeStart;
    const cls = `${st ? 'st ' : ''}${counting && !dead ? 'cnt' : 'dim'}${dead ? ' closed' : ''}`;
    return <div key={i} className={cls}>{g === undefined || g === null ? '–' : g}</div>;
  };

  const rr = (i: number) => {
    const h = m.hs[i];
    const dead = r.done && i >= r.byeStart;
    if (!h || !h.r) return <div key={i} className="rr closed">–</div>;
    const c = h.r === 'A' ? 'a' : h.r === 'B' ? 'b' : 'h';
    return <div key={i} className={`rr ${c}${dead ? ' closed' : ''}`}>{h.r === 'H' ? '½' : CFG.teams[c].short}</div>;
  };

  const ss = (i: number) => {
    const h = m.hs[i];
    if (!h || !h.r || (r.done && i >= r.byeStart)) return <div key={i} className="stt closed">–</div>;
    let a = 0, b = 0;
    for (let k = 0; k <= i; k++) {
      const c = m.hs[k].r;
      if (c === 'A') a++; else if (c === 'B') b++;
    }
    const d = a - b;
    return <div key={i} className={`stt ${d > 0 ? 'a' : d < 0 ? 'b' : ''}`}>{d === 0 ? 'AS' : Math.abs(d)}</div>;
  };

  /** lead cell, nine cells, Out, (nine cells, In), Tot */
  const row = (lead: React.ReactNode, cell: (i: number) => React.ReactNode, cls = '') => (
    <>
      {lead}
      {half1.map(cell)}
      <div className={`tot ${cls}`} />
      {half2.length > 0 && <>{half2.map(cell)}<div className={`tot ${cls}`} /></>}
      <div className={`grand ${cls}`} />
    </>
  );

  return (
    <div className="hscroll">
      <div className="cg" style={{ gridTemplateColumns: cols }}>
        {/* header */}
        <div className="hdr lb">Hole</div>
        {half1.map(i => <div key={i} className="hdr">{i + 1}</div>)}
        <div className="hdr nine">Out</div>
        {half2.length > 0 && <>{half2.map(i => <div key={i} className="hdr">{i + 1}</div>)}<div className="hdr nine">In</div></>}
        <div className="hdr nine">Tot</div>

        {/* par */}
        <div className="lb meta">Par</div>
        {half1.map(i => <div key={i} className="meta">{s.par[i]}</div>)}
        <div className="meta tot">{sumPar(0, half1.length)}</div>
        {half2.length > 0 && <>{half2.map(i => <div key={i} className="meta">{s.par[i]}</div>)}<div className="meta tot">{sumPar(9, N)}</div></>}
        <div className="meta grand">{sumPar(0, N)}</div>

        {/* stroke index */}
        {s.si && (
          <>
            <div className="lb meta">Stroke index</div>
            {half1.map(i => <div key={i} className="meta dim">{s.si![i]}</div>)}
            <div className="meta tot" />
            {half2.length > 0 && <>{half2.map(i => <div key={i} className="meta dim">{s.si![i]}</div>)}<div className="meta tot" /></>}
            <div className="meta grand" />
          </>
        )}

        {/* players */}
        {keys.map(k => (
          <div key={k} style={{ display: 'contents' }}>
            <div className={`lb ${s.fmt === 'Foursomes' ? k : P[k]?.t || 'a'}`}>
              {nm(k)}
              {s.fmt !== 'Foursomes' && <> <span className="dim" style={{ fontFamily: 'var(--num)' }}>{P[k]?.h}</span></>}
            </div>
            {half1.map(i => box(k, i))}
            <div className="tot">{tot(k, 0, half1.length)}</div>
            {half2.length > 0 && <>{half2.map(i => box(k, i))}<div className="tot">{tot(k, 9, N)}</div></>}
            <div className="grand">{tot(k, 0, N)}</div>
          </div>
        ))}

        {row(<div className="lb meta">Hole won</div>, rr)}
        {row(<div className="lb meta">Match</div>, ss)}
      </div>
    </div>
  );
}
