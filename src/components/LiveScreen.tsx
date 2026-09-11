import { useMemo, useState, type ReactNode } from 'react';
import CupStrip, { TrophySvg } from './CupStrip';
import { buildFeed, clock, type FeedItem } from '../lib/feed';
import { half, CFG } from '../lib/scoring';
import { IconBinoculars } from './icons';
import type { MomentsState } from '../lib/moments';
import type { EventData } from '../hooks/useEventData';
import { liveCard } from '../lib/cards';
import { TheRaces, TheField, Squiggle } from './CupSections';

/** `**bold**` runs in feed text become <b>. */
function rich(text: string): ReactNode[] {
  return text.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
}

const FEED_PEEK = 5;

export default function LiveScreen({ data, moments = null, onMoment, onRule, strip = true }: {
  data: EventData;
  moments?: MomentsState | null;
  onMoment?: (key: string) => void;
  onRule?: (article: number) => void;
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
        hl: `${half(moments.tie.b)}–${half(moments.tie.a)} after ${moments.tie.a + moments.tie.b} points`,
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

  // which moment or share card a feed line opens, if any
  const openFor = (e: FeedItem): string | null => {
    if (!onMoment) return null;
    const key = e.key;
    if (moments?.won && (key === 'mw' || key.startsWith('c:'))) return 'won';
    if (key === 'mt') return 'duel';
    if (key.startsWith('mr:')) return key.slice(3);
    if (key.startsWith('f:')) return `match:${key.slice(2)}`;
    if (key.startsWith('st:')) return `spike:streak:${key.slice(3)}`;
    if (key.startsWith('h:') && e.tag === 'Eagle') {
      const [, mid, i] = key.split(':');
      return `spike:eagle:${mid}:${Number(i) + 1}`;
    }
    return null;
  };
  const isSpike = (e: FeedItem) => e.key.startsWith('st:') || (e.key.startsWith('h:') && e.tag === 'Eagle');

  // most recent day open by default; -1 closes them all
  const [openDay, setOpenDay] = useState(0);
  // the feed shows its latest five lines until asked for the rest
  const [all, setAll] = useState(false);
  const total = days.reduce((n, g) => n + g.items.length, 0);
  const peek = !all && total > FEED_PEEK;
  const shown = peek ? [{ ...days[0], items: days[0].items.slice(0, FEED_PEEK) }] : days;
  const liveDay = liveCard(data)?.s.day ?? null;

  const won = moments?.won ?? null;
  return (
    <>
      {strip && won && (
        <div className={`woncard ${won.winner}`}>
          <span className="wjug"><TrophySvg /></span>
          <span className="wk">The {new Date().getFullYear()} Freeman Cup</span>
          <span className="wt">{CFG.teams[won.winner].name} take {CFG.trophy}</span>
          <span className="wscore">
            <b className={won.winner}>{half(won.pts[won.winner])}</b><i>to</i><b className={won.winner === 'a' ? 'b' : 'a'}>{half(won.pts[won.winner === 'a' ? 'b' : 'a'])}</b>
          </span>
          {won.viaShootout && won.shootout && moments && (
            <button className="wsh" onClick={onMoment ? () => onMoment('shootout') : undefined}>
              Won on the practice green · {moments.captains[won.winner]} {won.winner === 'a' ? won.shootout.ta : won.shootout.tb}, {moments.captains[won.winner === 'a' ? 'b' : 'a']} {won.winner === 'a' ? won.shootout.tb : won.shootout.ta} ›
            </button>
          )}
          {onMoment && <button className="wgo" onClick={() => onMoment('won')}>Open the finale ›</button>}
        </div>
      )}
      {strip && !won && (
        <CupStrip
          decided={null}
          onOpenFinale={undefined}
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
        <div className="quiet">
          {/* a wireframe of the feed to come, one shade up from the ground */}
          <div className="ghostfeed" aria-hidden="true">
            {[0, 1].map(d => (
              <div key={d} className="gday">
                <div className="ghd"><i style={{ width: 48 }} /><i style={{ width: 34 }} /></div>
                {[80, 62, 90, 54].slice(0, d ? 2 : 4).map((w, i) => (
                  <div key={i} className="grow">
                    <i className="gt" />
                    <span><i style={{ width: `${w}%` }} />{w > 70 && <i style={{ width: `${w - 45}%` }} />}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="empty">
            <IconBinoculars />
            <b>Quiet out there</b>
            Every hole won, every match that turns, and every card handed in
            lands here the moment it happens.
          </div>
        </div>
      ) : shown.map((g, i) => {
        const [dow, ...rest] = g.day.split(' ');
        const open = peek || i === openDay;
        // the day's summary card: the recap once it's in the book, the state
        // of the Cup while it's on the course
        const sumKey = moments?.days.find(x => x.day === g.day)?.key
          ?? (liveDay === g.day ? 'live' : null);
        return (
          <div key={g.day} className="dayfade" style={{ animationDelay: `${i * 110}ms` }}>
            <div className="dayhd" aria-expanded={open}>
              <button className="l" onClick={() => setOpenDay(open ? -1 : i)}>
                <span className="n">{dow}</span>
                <span className="d">{rest.join(' ')}</span>
              </button>
              <span className="r">
                {sumKey && onMoment && <button className="rchip sum" onClick={() => onMoment(sumKey)}>Summary</button>}
                {!peek && (
                  <button className="tog" onClick={() => setOpenDay(open ? -1 : i)} aria-label={open ? 'Collapse' : 'Expand'}>
                    {open ? '' : `${g.items.length} updates`}
                    <span className="chev">▾</span>
                  </button>
                )}
              </span>
            </div>
            {open && g.items.map((e, ix) => {
              const mk = openFor(e);
              return (
                <FeedRow
                  key={e.key}
                  e={e}
                  delay={i * 110 + Math.min(ix, 12) * 60}
                  spike={isSpike(e)}
                  onOpen={mk && onMoment ? () => onMoment(mk) : undefined}
                />
              );
            })}
          </div>
        );
      })}
      {days.length > 0 && total > FEED_PEEK && (
        <button className="showmore" onClick={() => { setAll(v => !v); if (all) setOpenDay(0); }}>
          {all ? 'Show less' : `Show all ${total} updates`}<span className="chev">{all ? '▴' : '▾'}</span>
        </button>
      )}

      <Squiggle />
      <TheRaces sessions={data.scoringSessions} matches={data.scoringMatches} onOpen={onMoment} onRule={onRule} />
      <Squiggle />
      <TheField onOpen={onMoment} />
      <div className="memoriam">In loving memory of David J. Freeman</div>
    </>
  );
}

function FeedRow({ e, delay = 0, spike = false, onOpen }: { e: FeedItem; delay?: number; spike?: boolean; onOpen?: () => void }) {
  const tag = e.tag && <span className={`tag${e.tagGold ? ' gold' : ''}`}>{e.tag}</span>;
  return (
    <div
      className={`ev ${e.side}${e.big ? ' big' : ''}${onOpen ? ' go' : ''}${spike && onOpen ? ' spk' : ''} rowfade`}
      style={{ animationDelay: `${delay}ms` }}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? ev => { if (ev.key === 'Enter' || ev.key === ' ') onOpen(); } : undefined}
    >
      <div className="t">{clock(e.at)}</div>
      <div className="bd">
        {tag && <div className="tagline">{tag}</div>}
        {e.hl ? (
          <>
            <div className="hl">{e.hl}</div>
            {e.text && rich(e.text)}
          </>
        ) : (
          <>
            {e.who && <span className={`who ${e.who.side}`}>{e.who.name}</span>}
            {rich(e.text)}
          </>
        )}
        {e.sub && <span className="sub2">{e.sub}</span>}
        {spike && onOpen && <span className="gochip">Open the card ›</span>}
        {e.score && (
          <div className="score">
            <span className="b">{half(e.score.b)}</span>
            <span className="d">–</span>
            <span className="a">{half(e.score.a)}</span>
            <span className="d" style={{ fontFamily: 'var(--body)', fontSize: 13, fontWeight: 400 }}>The Lassie</span>
          </div>
        )}
      </div>
    </div>
  );
}

