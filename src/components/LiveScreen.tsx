import { useMemo, useState, type ReactNode } from 'react';
import CupStrip from './CupStrip';
import { buildFeed, clock, type FeedItem } from '../lib/feed';
import { half } from '../lib/scoring';
import type { EventData } from '../hooks/useEventData';

/** `**bold**` runs in feed text become <b>. */
function rich(text: string): ReactNode[] {
  return text.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
}

export default function LiveScreen({ data }: { data: EventData }) {
  const days = useMemo(() => buildFeed({
    sessions: data.scoringSessions,
    matches: data.scoringMatches,
    matchHoles: data.matchHoles,
    switches: data.switches,
    playerById: data.playerById,
    clinchPoints: Number(data.event.clinch_points) || 5.5,
  }), [data]);

  // most recent day open by default; -1 closes them all
  const [openDay, setOpenDay] = useState(0);

  return (
    <>
      <CupStrip />
      {!days.length ? (
        <div className="empty">
          <b>Quiet out there</b>
          Every hole won, every match that turns, and every scorer switch lands here.
        </div>
      ) : days.map((g, i) => {
        const [dow, ...rest] = g.day.split(' ');
        const open = i === openDay;
        return (
          <div key={g.day}>
            <button
              className="dayhd"
              aria-expanded={open}
              onClick={() => setOpenDay(open ? -1 : i)}
            >
              <span className="l">
                <span className="n">{dow}</span>
                <span className="d">{rest.join(' ')}</span>
              </span>
              <span className="r">
                {open ? '' : `${g.items.length} updates`}
                <span className="chev">▾</span>
              </span>
            </button>
            {open && g.items.map(e => <FeedRow key={e.key} e={e} />)}
          </div>
        );
      })}
    </>
  );
}

function FeedRow({ e }: { e: FeedItem }) {
  const tag = e.tag && <span className={`tag${e.tagGold ? ' gold' : ''}`}>{e.tag}</span>;
  return (
    <div className={`ev ${e.side}${e.big ? ' big' : ''}`}>
      <div className="t">{clock(e.at)}</div>
      <div className="bd">
        {e.hl ? (
          <>
            <div className="hl">{tag}{e.hl}</div>
            {e.text && rich(e.text)}
          </>
        ) : (
          <>
            {tag}
            {e.who && <span className={`who ${e.who.side}`}>{e.who.name}</span>}
            {rich(e.text)}
          </>
        )}
        {e.sub && <span className="sub2">{e.sub}</span>}
        {e.score && (
          <div className="score">
            <span className="a">{half(e.score.a)}</span>
            <span className="d">–</span>
            <span className="b">{half(e.score.b)}</span>
            <span className="d" style={{ fontFamily: 'var(--body)', fontSize: 13, fontWeight: 400 }}>The Lassie</span>
          </div>
        )}
      </div>
    </div>
  );
}
