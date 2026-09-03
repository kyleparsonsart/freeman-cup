import { useMemo, useState, type ReactNode } from 'react';
import CupStrip from './CupStrip';
import { buildFeed, clock, type FeedItem } from '../lib/feed';
import { half, CFG } from '../lib/scoring';
import type { MomentsState } from '../lib/moments';
import type { EventData } from '../hooks/useEventData';

/** `**bold**` runs in feed text become <b>. */
function rich(text: string): ReactNode[] {
  return text.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
}

export default function LiveScreen({ data, moments = null, onMoment, strip = true }: {
  data: EventData;
  moments?: MomentsState | null;
  onMoment?: (key: string) => void;
  strip?: boolean;
}) {
  const days = useMemo(() => {
    const built = buildFeed({
      sessions: data.scoringSessions,
      matches: data.scoringMatches,
      matchHoles: data.matchHoles,
      switches: data.switches,
      playerById: data.playerById,
      clinchPoints: Number(data.event.clinch_points) || 5.5,
    }).map(g => ({ ...g, items: [...g.items] }));
    if (!moments || !built.length) return built;

    // The moments' permanent feed cards ride on top of their day.
    const at = (g: typeof built[0]) => (g.items[0]?.at ?? Date.now()) + 60000;
    moments.days.forEach(dm => {
      const g = built.find(x => x.day === dm.day);
      if (!g) return;
      g.items.unshift({
        key: `mr:${dm.key}`, day: g.day, at: at(g), side: '', big: true,
        tag: 'Day recap', hl: `${dm.dow}, in the book`, text: 'Tap for the recap.',
      });
    });
    const top = built[0];
    if (moments.duelPending && moments.tie) {
      top.items.unshift({
        key: 'mt', day: top.day, at: at(top), side: 'cup', big: true,
        tag: 'All square',
        hl: `${half(moments.tie.a)}–${half(moments.tie.b)} after ${moments.tie.a + moments.tie.b} points`,
        text: `${moments.captains.a} and ${moments.captains.b} to the practice green. Tap for the shootout.`,
      });
    }
    if (moments.won?.viaShootout) {
      top.items.unshift({
        key: 'mw', day: top.day, at: at(top), side: 'cup', big: true,
        tag: 'The Lassie',
        hl: `${CFG.teams[moments.won.winner].name} win ${CFG.trophy}`,
        text: 'Won on the practice green. Tap for the finale.',
      });
    }
    if (moments.won && !moments.won.viaShootout) {
      // the clinch card buildFeed already wrote becomes the door
      built.forEach(g => {
        g.items = g.items.map(e => e.key.startsWith('c:') ? { ...e, text: 'Tap for the finale.' } : e);
      });
    }
    return built;
  }, [data, moments]);

  // which moment a feed card opens, if any
  const openFor = (key: string): string | null => {
    if (!moments || !onMoment) return null;
    if (moments.won && (key === 'mw' || key.startsWith('c:'))) return 'won';
    if (key === 'mt') return 'duel';
    if (key.startsWith('mr:')) return key.slice(3);
    return null;
  };

  // most recent day open by default; -1 closes them all
  const [openDay, setOpenDay] = useState(0);

  const won = moments?.won ?? null;
  return (
    <>
      {strip && (
        <CupStrip
          decided={won ? { label: `${CFG.teams[won.winner].name} win ${CFG.trophy}` } : null}
          onOpenFinale={onMoment ? () => onMoment('won') : undefined}
        />
      )}
      {strip && moments?.duelPending && onMoment && (
        <button className="duelbar" onClick={() => onMoment('duel')}>
          <span className="pulse" />
          <span className="t"><b>Captains Shootout.</b> {CFG.trophy} is on the practice green.</span>
          <span className="go">Open ›</span>
        </button>
      )}
      {!days.length ? (
        <div className="empty">
          <b>Quiet out there</b>
          Every hole won, every match that turns, and every scorer switch lands here.
        </div>
      ) : days.map((g, i) => {
        const [dow, ...rest] = g.day.split(' ');
        const open = i === openDay;
        return (
          <div key={g.day} className="dayfade" style={{ animationDelay: `${i * 110}ms` }}>
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
            {open && g.items.map((e, ix) => {
              const mk = openFor(e.key);
              return (
                <FeedRow
                  key={e.key}
                  e={e}
                  delay={i * 110 + Math.min(ix, 12) * 60}
                  onOpen={mk && onMoment ? () => onMoment(mk) : undefined}
                />
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function FeedRow({ e, delay = 0, onOpen }: { e: FeedItem; delay?: number; onOpen?: () => void }) {
  const tag = e.tag && <span className={`tag${e.tagGold ? ' gold' : ''}`}>{e.tag}</span>;
  return (
    <div
      className={`ev ${e.side}${e.big ? ' big' : ''}${onOpen ? ' go' : ''} rowfade`}
      style={{ animationDelay: `${delay}ms` }}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? ev => { if (ev.key === 'Enter' || ev.key === ' ') onOpen(); } : undefined}
    >
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
