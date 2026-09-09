/**
 * The rulebook sheet. Opens from the book icon in the header on every
 * tab. Search first (plain words, synonyms), quick chips for what gets
 * asked on a tee box, then the articles. Articles read short-first so a
 * ruling on the course is one glance; the long version sits underneath.
 * Content and search live in lib/rulebook.ts and work offline.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { RULEBOOK, RULEBOOK_META, QUICK, searchRules, highlight, type Article, type Clause } from '../lib/rulebook';

interface Props { open: boolean; onClose: () => void; /** article to land on when opened from elsewhere in the app */ jump?: number | null }

export default function Rulebook({ open, onClose, jump = null }: Props) {
  const [q, setQ] = useState('');
  const [art, setArt] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // A fresh open lands on the contents with the field focused; we keep the
  // last query so coming back mid-argument picks up where you were.
  useEffect(() => {
    if (!open) return;
    if (jump !== null) { setArt(jump); setQ(''); bodyRef.current?.scrollTo(0, 0); return; }
    bodyRef.current?.scrollTo(0, 0);
    if (!q && art === null) setTimeout(() => inputRef.current?.focus(), 320);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const hits = useMemo(() => searchRules(q), [q]);
  const searching = q.trim().length > 0;
  const current = art === null ? null : RULEBOOK.find(a => a.num === art) || null;

  const go = (n: number, clauseId?: string) => {
    setArt(n);
    setQ('');
    requestAnimationFrame(() => {
      const el = clauseId ? bodyRef.current?.querySelector<HTMLElement>(`[data-clause="${clauseId}"]`) : null;
      if (el) el.scrollIntoView({ block: 'start' });
      else bodyRef.current?.scrollTo(0, 0);
    });
  };
  const back = () => { setArt(null); bodyRef.current?.scrollTo(0, 0); };
  const ask = (s: string) => { setArt(null); setQ(s); };

  return (
    <div className={`settings rulebook${open ? ' on' : ''}`} role="dialog" aria-modal="true" aria-label="The rulebook" aria-hidden={!open}>
      <div className="sethd">
        <h2>{RULEBOOK_META.title}</h2>
        <button className="done" onClick={onClose}>Done</button>
      </div>
      <div className="rbsearch">
        <label className="rbfield">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoCorrect="off"
            autoCapitalize="none"
            placeholder="Search the rules"
            value={q}
            onChange={e => { setQ(e.target.value); if (art !== null) setArt(null); }}
            aria-label="Search the rules"
          />
          {searching && <button className="rbclear" onClick={() => { setQ(''); inputRef.current?.focus(); }}>Clear</button>}
        </label>
        {!searching && art === null && (
          <div className="rbchips">
            {QUICK.map(c => <button key={c.q} className="chip" onClick={() => ask(c.q)}>{c.label}</button>)}
          </div>
        )}
      </div>

      <div className="setbody rbbody" ref={bodyRef}>
        {searching ? (
          <Results q={q} hits={hits} onOpen={go} />
        ) : current ? (
          <ArticleView art={current} onBack={back} onOpen={go} />
        ) : (
          <Contents onOpen={go} />
        )}
      </div>
    </div>
  );
}

function Contents({ onOpen }: { onOpen: (n: number) => void }) {
  return (
    <>
      <div className="rbmeta">{RULEBOOK_META.edition} · {RULEBOOK.length} articles · {RULEBOOK_META.note}</div>
      {RULEBOOK.map(a => (
        <button key={a.num} className="rbtoc" onClick={() => onOpen(a.num)}>
          <span className="n">{a.num}</span>
          <span className="t">{a.title}<span className="c">{a.gloss}</span></span>
          <span className="chev">›</span>
        </button>
      ))}
    </>
  );
}

function Results({ q, hits, onOpen }: { q: string; hits: ReturnType<typeof searchRules>; onOpen: (n: number, id: string) => void }) {
  if (!hits.length) {
    return (
      <div className="rbnone">
        <b>Nothing for “{q.trim()}”</b>
        Try a plainer word: gimme, OB, pick up, strokes, tie. If the book really doesn’t cover it, Art. 10 says who decides.
      </div>
    );
  }
  return (
    <>
      <div className="rbmeta">{hits.length} {hits.length === 1 ? 'result' : 'results'} for <b>{q.trim()}</b></div>
      {hits.map(h => (
        <button key={h.clause.id} className="rbhit" onClick={() => onOpen(h.art.num, h.clause.id)}>
          <span className="k">Art. {h.clause.id} · {h.art.title}</span>
          <span className="h"><Marked text={h.clause.title} terms={h.terms} /></span>
          <span className="s"><Marked text={h.clause.short} terms={h.terms} /></span>
          <span className="more">Read article ›</span>
        </button>
      ))}
    </>
  );
}

function ArticleView({ art, onBack, onOpen }: { art: Article; onBack: () => void; onOpen: (n: number, id: string) => void }) {
  const prev = RULEBOOK.find(a => a.num === art.num - 1);
  const next = RULEBOOK.find(a => a.num === art.num + 1);
  return (
    <>
      <div className="rbartbar">
        <button className="rbback" onClick={onBack}>‹ Contents</button>
        <span>Art. {art.num} of {RULEBOOK.length}</span>
      </div>
      <div className="rbart">
        <div className="k">Article {art.num}</div>
        <h3>{art.title}</h3>
      </div>
      {art.clauses.map(c => <ClauseView key={c.id} c={c} onOpen={onOpen} />)}
      <div className="rbnav">
        {prev ? <button onClick={() => onOpen(prev.num, prev.clauses[0].id)}>‹ {prev.title}</button> : <span />}
        {next ? <button onClick={() => onOpen(next.num, next.clauses[0].id)}>{next.title} ›</button> : <span />}
      </div>
    </>
  );
}

function ClauseView({ c, onOpen }: { c: Clause; onOpen: (n: number, id: string) => void }) {
  return (
    <div className="rbclause" data-clause={c.id}>
      <div className="k">Art. {c.id}</div>
      <h4>{c.title}</h4>
      <p className="short">{c.short}</p>
      {c.long?.map((p, i) => <p key={i} className="long">{p}</p>)}
      {c.see && (
        <div className="rbsee">
          {c.see.map(ref => {
            const id = ref.replace(/^Art\.\s*/, '');
            const n = Number(id.split('.')[0]);
            return <button key={ref} onClick={() => onOpen(n, id)}>{ref}</button>;
          })}
        </div>
      )}
    </div>
  );
}

function Marked({ text, terms }: { text: string; terms: string[] }) {
  return <>{highlight(text, terms).map((s, i) => s.m ? <mark key={i}>{s.t}</mark> : <span key={i}>{s.t}</span>)}</>;
}
