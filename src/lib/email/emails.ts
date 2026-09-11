/**
 * The four emails that go out during the week, each the sign-in email's
 * shape: kicker, headline, one card, a sentence, a few rows, the jug.
 * Rendered on the commissioner's phone from the same data as the cards and
 * relayed to Resend by /api/send-mail (see lib/email/send.ts).
 */
import type { EventData } from '../../hooks/useEventData';
import type { DbRound } from '../types';
import { CFG, P, half, strokeMap, type Match, type Session } from '../scoring';
import type { Side } from '../cards';
import { strokeHoles } from '../letters';
import { dayCard, finaleCard, matchStory, names } from '../cards';
import { mvp, roundRaces, relLabel } from '../standings';
import { shell, kicker, headline, card, cardLabel, sentence, rows, button, fine, matchBlock, esc, side, C, F, APP, SITE } from './shell';

export interface Mail { to: string; subject: string; html: string }

const fn = (k: string) => (P[k]?.n || k).split(' ')[0];
const keyOf = (name: string) => name.split(' ')[0].toLowerCase();
const real = (d: EventData) => d.players.filter(p => p.email && !p.email.endsWith('@example.com'));
const longDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const teamName = (s: Side) => CFG.teams[s].name;
const colored = (keys: string[], s: Side, size = 24) =>
  keys.map(k => `<span style="color:${side(s)};">${esc(fn(k))}</span><span style="font-family:${F.num};font-size:${Math.round(size * .55)}px;color:${C.dim};"> ${P[k]?.h ?? ''}</span>`)
    .join(`<span style="color:${C.dim};"> &amp; </span>`);

/* ------------------------------------------------ 1 · pairings, per player */

export function pairingsMail(d: EventData, round: DbRound): Mail[] {
  const s = d.scoringSessions.find(x => x.id === round.id);
  const ms = d.scoringMatches.filter(m => m.s === round.id);
  if (!s || !ms.length) return [];
  return real(d).flatMap(p => {
    const me = keyOf(p.name);
    const m = ms.find(x => x.a.includes(me) || x.b.includes(me));
    return m ? [{ to: p.email, ...pairings(round, s, m, me) }] : [];
  });
}

function pairings(round: DbRound, s: Session, m: Match, me: string): Omit<Mail, 'to'> {
  const mine: Side = m.a.includes(me) ? 'a' : 'b';
  const them: Side = mine === 'a' ? 'b' : 'a';
  const partner = m[mine].find(k => k !== me) || null;
  const tee = (s.tees[m.g] || '').replace(/\s*(AM|PM)/i, x => x.trim().toLowerCase());
  const sm = strokeMap(m);
  const mineShots = sm[me] || 0;
  const dots = strokeHoles(m, me, s.holes);
  const scorer = s.scorer[m.g] ? fn(s.scorer[m.g]) : null;
  const date = longDate(round.play_date);
  const dow = date.split(',')[0];
  const fmt = s.fmt === 'Four-ball' ? 'four-ball, better ball on each side'
    : s.fmt === 'Aggregate' ? 'aggregate, both net scores added'
    : s.fmt === 'Singles' ? 'singles' : 'foursomes, alternate shot';
  const low = Object.entries(sm).every(([, n]) => n === 0);
  const shots = low ? 'No strokes either way.'
    : mineShots === 0 ? `You play off scratch; ${Object.entries(sm).filter(([, n]) => n > 0).map(([k, n]) => `${fn(k)} gets ${n}`).join(', ')}.`
    : `You get ${mineShots} stroke${mineShots === 1 ? '' : 's'}, on ${dots.join(', ').replace(/, (\d+)$/, ' and $1')}.`;
  const subject = `Round ${round.seq}: ${fn(me)}${partner ? ` & ${fn(partner)}` : ''} v ${m[them].map(fn).join(' & ')}, off at ${tee}`;
  const body = [
    kicker(`Round ${round.seq} &middot; ${esc(dow)} &middot; ${esc(s.course)}`),
    headline(`${esc(fn(me))}, you&#8217;re off at ${esc(tee)}.`),
    card(`${cardLabel('Your match')}
      <div style="font-family:${F.display};font-size:24px;line-height:32px;">${colored(m[mine], mine)}</div>
      <div style="font-family:${F.display};font-style:italic;font-size:13px;line-height:20px;color:${C.dim};">against</div>
      <div style="font-family:${F.display};font-size:24px;line-height:32px;">${colored(m[them], them)}</div>`),
    sentence(`${s.holes} holes of ${esc(fmt)}. ${esc(shots)}`),
    rows([
      ['First tee', `${esc(tee)} &middot; ${esc(date)}`],
      ...(s.tee ? [['Tees', esc(s.tee)] as [string, string]] : []),
      ['Strokes', low ? 'Straight up' : Object.entries(sm).filter(([, n]) => n > 0).map(([k, n]) => `${k === me ? 'You' : esc(fn(k))} ${n}`).join(' &middot; ')],
      scorer ? ['Scorer', scorer === fn(me) ? 'You. Keep the card.' : esc(scorer)] : ['Colors', `${teamName(them)} in ${them === 'a' ? 'red' : 'blue'}`],
    ]),
    button('Open the app'),
    fine('Your sealed letter is waiting there too. Email links always open in the browser; if the Cup is on your home screen, open it from there.'),
  ].join('');
  return { subject, html: shell({ title: subject, pre: `${dow} at ${s.course}. ${partner ? `You and ${fn(partner)}` : 'You'} against ${m[them].map(fn).join(' and ')}, off at ${tee}.`, body }) };
}

/* ------------------------------------------------- 2 · the day recap, to all */

export function recapMail(d: EventData, day: string): Mail[] {
  const c = dayCard(d, day);
  if (!c) return [];
  const lead: Side | null = c.cum.a > c.cum.b ? 'a' : c.cum.b > c.cum.a ? 'b' : null;
  const score = lead === 'a' ? `${half(c.cum.a)} to ${half(c.cum.b)}` : `${half(c.cum.b)} to ${half(c.cum.a)}`;
  const title = lead ? `${teamName(lead)} lead, ${score}.` : `All square, ${score}.`;
  const potr = roundRaces(d.scoringSessions, d.scoringMatches).filter(r => r.day === day && r.winner);
  const items = c.groups.flatMap(g => g.rows.map(({ m, r }) => {
    const w = r.w === 'h' ? null : (r.w as Side | null);
    const t: Side = w || 'b', l: Side = t === 'a' ? 'b' : 'a';
    return {
      line: `<span style="color:${side(t)};">${esc(names(m[t]))}</span> <span style="color:${C.dim};">${w ? 'beat' : 'halved with'}</span> ${esc(names(m[l]))}`,
      result: esc(r.done ? r.label : 'Live'), color: w ? side(w) : C.moss,
      story: r.played ? esc(matchStory(m, g.s, r)) : '',
    };
  }));
  const daysIn = ['After day one', 'After two days', 'After three days'][c.index] || `After ${c.dow}`;
  const subject = `${c.dow} recap: ${title.replace(/\.$/, '')}`;
  const body = [
    kicker(`${esc(c.dow)} &middot; ${esc(c.courses)}`),
    headline(esc(title)),
    card(`${cardLabel(daysIn)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td align="center" width="38%"><div style="font-family:${F.num};font-size:44px;line-height:48px;font-weight:600;color:${C.blue};">${half(c.cum.b)}</div><div style="font-family:${F.num};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.moss};">${teamName('b')}</div></td>
        <td align="center" width="24%" style="font-family:${F.num};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.dim};white-space:nowrap;">${half(c.clinch)}<br>to win</td>
        <td align="center" width="38%"><div style="font-family:${F.num};font-size:44px;line-height:48px;font-weight:600;color:${C.red};">${half(c.cum.a)}</div><div style="font-family:${F.num};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.moss};">${teamName('a')}</div></td>
      </tr></table>`),
    sentence(c.pts.a === c.pts.b ? `Today split ${half(c.pts.a)} each.` : `${teamName(c.pts.a > c.pts.b ? 'a' : 'b')} took the day ${half(Math.max(c.pts.a, c.pts.b))} to ${half(Math.min(c.pts.a, c.pts.b))}.`),
    kicker('The matches', C.dim, '30px 10px 0'),
    matchBlock(items, '14px 10px 0'),
    potr.length ? kicker('Player of the round', C.dim, '30px 10px 0') + rows(potr.map(r => [esc(r.course), `<span style="color:${side(r.winner!.side)};">${esc(r.winner!.name)}</span> &middot; ${r.winner!.pts} pts &middot; ${relLabel(r.winner!.rel)} net`] as [string, string]), '14px 10px 0') : '',
    c.next ? rows([['Tomorrow', `${esc(c.next.course)} &middot; first tee ${esc((c.next.tees[0] || '').replace(/\s*(AM|PM)/i, x => x.trim().toLowerCase()))}`]], '0 10px 0') : '',
    button('Open the recap', APP),
    fine(`The full cards and every moment are on <a href="${SITE}" style="color:${C.moss};">thefreemancup.com</a>.`),
  ].join('');
  return real(d).map(p => ({ to: p.email, subject, html: shell({ title: subject, pre: `${c.dow}: ${title} ${items.length} matches, ${potr.length ? 'Player of the round, ' : ''}and tomorrow's first tee.`, body }) }));
}

/* --------------------------------------------------------- 3 · the finale */

export function finaleMail(d: EventData): Mail[] {
  const when: Record<string, number> = {};
  d.matchHoles.forEach(h => { when[`${h.match_id}:${h.hole}`] = new Date(h.updated_at).getTime(); });
  const c = finaleCard(d, when, d.event.shootout ?? null);
  if (!c) return [];
  const w = c.winner, l: Side = w === 'a' ? 'b' : 'a';
  const top = mvp(d.scoringSessions, d.scoringMatches);
  const title = `${teamName(w)} take ${CFG.trophy}.`;
  const cl = c.clinch;
  const clinchLine = c.viaShootout
    ? `Level after 10 points, it went to the practice green, and the ${teamName(w)} captain putted for the jug.`
    : cl ? `${esc(names(cl.m[w]))} clinched it, ${esc(cl.r.label)} over ${esc(names(cl.m[l]))} at ${esc(cl.s.course)}.` : '';
  const subject = `${teamName(w)} win the ${d.event.year} Freeman Cup, ${half(c.pts[w])} to ${half(c.pts[l])}`;
  const potr = roundRaces(d.scoringSessions, d.scoringMatches).filter(r => r.winner);
  const body = [
    kicker(`The ${d.event.year} Freeman Cup &middot; ${esc(d.event.venue)}`),
    headline(esc(title)),
    card(`${cardLabel('Final')}
      <div style="font-family:${F.num};font-size:56px;line-height:58px;font-weight:600;"><span style="color:${side(w)};">${half(c.pts[w])}</span><span style="color:${C.dim};font-size:28px;"> to </span><span style="color:${side(l)};">${half(c.pts[l])}</span></div>
      <div style="font-family:${F.display};font-size:20px;line-height:26px;color:${side(w)};padding-top:6px;">${teamName(w)}</div>`),
    sentence(clinchLine),
    top ? [
      kicker('The King&#8217;s Race', C.dim, '30px 10px 0'),
      card(`${cardLabel('MVP of the Cup', C.brass)}
        <div style="font-family:${F.display};font-size:28px;line-height:34px;color:${side(top.side)};">${esc(top.name)}</div>
        <div style="font-family:${F.body};font-size:13.5px;line-height:20px;color:${C.moss};padding-top:4px;">${top.pts} hole points &middot; ${top.solo} won alone &middot; ${relLabel(top.rel)} net</div>`, 300, '14px 10px 0'),
    ].join('') : '',
    potr.length ? rows(potr.map(r => [r.rd.replace('Round ', 'R'), `<span style="color:${side(r.winner!.side)};">${esc(r.winner!.name)}</span> &middot; ${r.winner!.pts} pts &middot; ${esc(r.course)}`] as [string, string])) : '',
    button('Open the finale', APP),
    fine(`${CFG.trophy} goes home with the ${teamName(w)} until next October.<br>Every card, every match, every moment: <a href="${SITE}" style="color:${C.moss};">thefreemancup.com</a>.`),
  ].join('');
  return real(d).map(p => ({ to: p.email, subject, html: shell({ title: subject, pre: `${title} ${half(c.pts[w])} to ${half(c.pts[l])}. ${top ? `${top.name} is the MVP.` : ''}`, body, foot: 'See you in 2027.' }) }));
}

/* ------------------------------------------------- 4 · one week out, to all */

export function weekOutMail(d: EventData): Mail[] {
  const first = d.rounds.slice().sort((a, b) => a.seq - b.seq)[0];
  const days = Math.max(0, Math.round((new Date(first.play_date + 'T12:00:00').getTime() - Date.now()) / 86400000));
  const byDay = [...new Set(d.scoringSessions.map(s => s.day))].map(day => {
    const ss = d.scoringSessions.filter(s => s.day === day);
    return [day.split(' ')[0], ss.map(s => `${esc(s.course)} &middot; ${esc(s.fmt)} &middot; ${esc((s.tees[0] || '').replace(/\s*(AM|PM)/i, x => x.trim().toLowerCase()))}`).join('<br>')] as [string, string];
  });
  const subject = `${days} days to Sand Valley`;
  const body = [
    kicker('One week out'),
    headline(`Sand Valley, next ${esc(first ? longDate(first.play_date).split(',')[0] : 'week')}.`),
    card(`${cardLabel('Countdown')}
      <div style="font-family:${F.num};font-size:56px;line-height:58px;font-weight:600;color:${C.brass};">${days}</div>
      <div style="font-family:${F.num};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.moss};">days</div>`),
    sentence(`Three rounds, four courses, one jug. Pairings land in the app the night before each round, and your strokes come with them.`),
    rows(byDay),
    button('Open the app'),
    fine(`Not on your home screen yet? Open the link in Safari, tap Share, then Add to Home Screen, and sign in with the code. Email links always open in the browser; once it is on your home screen, open it from there.<br>Handicaps are frozen ${first ? esc(longDate(new Date(new Date(first.play_date + 'T12:00:00').getTime() - 6 * 86400000).toISOString().slice(0, 10))) : 'the Friday before'}.`),
  ].join('');
  return real(d).map(p => ({ to: p.email, subject, html: shell({ title: subject, pre: `${days} days. Three rounds, four courses, one jug. Here is the week.`, body }) }));
}

