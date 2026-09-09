/**
 * The rulebook: content plus search. One source for the app (and later
 * the public site). Articles carry a one-line gloss for the table of
 * contents; clauses lead with the short ruling and keep the long version
 * underneath. Search is plain-word, with a synonym map so "gimme" finds
 * the concession clause and "OB" finds the drop rule.
 */

export interface Clause {
  id: string;          // '4.2'
  title: string;
  short: string;       // the ruling, one or two sentences
  long?: string[];     // paragraphs
  see?: string[];      // cross references, e.g. 'Art. 7.1'
  keys?: string[];     // extra search words not in the text
}

export interface Article {
  num: number;
  title: string;
  gloss: string;
  clauses: Clause[];
}

export const RULEBOOK_META = {
  title: 'The rulebook',
  edition: 'Freeman Cup 2026',
  note: 'Signed by all eight on Wednesday night.',
};

/** Plain words people type, mapped to the words the book uses. */
export const SYNONYMS: Record<string, string[]> = {
  gimme: ['gimme', 'concede', 'good', 'leather'],
  gimmie: ['gimme', 'concede', 'good', 'leather'],
  gimmes: ['gimme', 'concede', 'good', 'leather'],
  gimmies: ['gimme', 'concede', 'good', 'leather'],
  ob: ['bounds', 'lost', 'drop'],
  'out of bounds': ['bounds', 'lost', 'drop'],
  lost: ['lost', 'bounds', 'drop', 'provisional'],
  mully: ['mulligan'],
  mulligans: ['mulligan'],
  'pick up': ['pick', 'white flag', 'plus four'],
  pickup: ['pick', 'white flag', 'plus four'],
  'picked up': ['pick', 'white flag', 'plus four'],
  quit: ['pick', 'white flag'],
  dots: ['stroke', 'dot'],
  dot: ['stroke', 'dot'],
  shots: ['stroke'],
  pops: ['stroke'],
  strokes: ['stroke'],
  handicap: ['handicap', 'index', 'ghin'],
  handicaps: ['handicap', 'index', 'ghin'],
  hcp: ['handicap', 'index', 'ghin'],
  tie: ['tie', 'shootout', 'level', 'halved'],
  tied: ['tie', 'shootout', 'level', 'halved'],
  playoff: ['shootout'],
  'sudden death': ['shootout'],
  halve: ['halved'],
  half: ['halved', 'half'],
  push: ['halved'],
  square: ['square', 'halved'],
  sand: ['sand', 'bunker', 'waste'],
  bunker: ['sand', 'bunker'],
  trap: ['sand', 'bunker'],
  score: ['score', 'scorer', 'gross', 'pencil'],
  scores: ['score', 'scorer', 'gross', 'pencil'],
  enter: ['enter', 'scorer', 'gross'],
  pencil: ['pencil', 'scorer'],
  argument: ['dispute', 'ruling', 'captains'],
  argue: ['dispute', 'ruling', 'captains'],
  fight: ['dispute', 'ruling', 'captains'],
  rules: ['ruling', 'usga'],
  tees: ['tee', 'yards'],
  yardage: ['tee', 'yards'],
  points: ['point', 'clinch'],
  win: ['point', 'clinch', 'up'],
  aggregate: ['aggregate', 'commons', 'added'],
  commons: ['aggregate', 'commons'],
  fourball: ['four-ball', 'better'],
  'four ball': ['four-ball', 'better'],
  'best ball': ['four-ball', 'better'],
  singles: ['singles', 'saturday'],
  jug: ['lassie', 'trophy'],
  trophy: ['lassie', 'trophy'],
  phone: ['phone', 'signal', 'sync'],
  offline: ['phone', 'signal', 'sync'],
  signal: ['phone', 'signal', 'sync'],
  fix: ['wrong', 'fix', 'edit'],
  mistake: ['wrong', 'fix', 'edit'],
  wrong: ['wrong', 'fix', 'edit'],
  edit: ['wrong', 'fix', 'edit'],
  pairings: ['pairing', 'partner'],
  partner: ['pairing', 'partner'],
  captain: ['captain', 'captains'],
};

export const RULEBOOK: Article[] = [
  {
    num: 1, title: 'The format', gloss: 'Four rounds, ten points, 5½ wins',
    clauses: [
      { id: '1.1', title: 'Ten points, first to 5½', keys: ['clinch', 'point', 'lassie', 'trophy'],
        short: 'Four rounds, ten points. Every match is one point, a halved match is half each. First side to 5½ takes the Lassie.',
        long: ['Thursday is four-ball at Mammoth Dunes. Friday morning is a 12-hole aggregate match at The Commons, Friday afternoon four-ball at Sand Valley. Saturday is singles at Sedge Valley, four matches. Two points a session for the first three, four on Saturday.',
          'Celts are blue. Vikes are red. The Cup does not end in a tie; see Art. 9.'] },
    ],
  },
  {
    num: 2, title: 'Match play', gloss: 'Holes, not strokes · halves · dormie',
    clauses: [
      { id: '2.1', title: 'Holes, not strokes',
        short: 'Win the hole, you’re 1 up. The match is over when one side is up by more than the holes left.',
        long: ['Each hole is its own contest. The only thing carried forward is the state of the match. "3 & 2" means the winner was 3 up with 2 to play.'] },
      { id: '2.2', title: 'Halved holes and halved matches', keys: ['square', 'tie', 'level'],
        short: 'Same net score on a hole and it’s halved; nothing changes. All square after the last hole and the match is halved, half a point each. No extra holes.' },
      { id: '2.3', title: 'Dormie',
        short: 'Dormie means the side that’s up can no longer lose. The side that’s down has to win every hole left just to halve the match.' },
    ],
  },
  {
    num: 3, title: 'Handicaps and strokes', gloss: 'GHIN, frozen · full difference off the low player',
    clauses: [
      { id: '3.1', title: 'Where your strokes come from', keys: ['dot', 'index', 'ghin'],
        short: 'Your GHIN index, frozen before the trip. In every match the low player plays off scratch and everyone else gets the full difference, on the hardest holes first.',
        long: ['Handicaps are each player’s GHIN index as of the Friday before the trip, rounded to the nearest whole number by the commissioner. They do not move Thursday through Saturday. No course conversions, no percentages.',
          'Strokes fall on the course’s stroke index, hardest hole first. A 15 in a match where the low man is a 6 gets a stroke on stroke index 1 through 9. Nobody gets two strokes on a hole this year.',
          'Your stroke holes show as a dot on the scorecard before the round starts.'], see: ['Art. 7.1'] },
      { id: '3.2', title: 'Four-ball', keys: ['better'],
        short: 'Strokes off the lowest of the four players in the match. Your net score is your own; the better net ball on each side plays the hole.' },
      { id: '3.3', title: 'Aggregate at The Commons', keys: ['added', 'both', 'total'],
        short: 'Both net scores on a side are added and the lower total wins the hole. Strokes off the low player in the match.',
        long: ['Since both balls count, a pick-up (Art. 4) costs the team, not just you.'], see: ['Art. 4.2'] },
      { id: '3.4', title: 'Singles',
        short: 'Off the lower of the two. Two 15s get nothing and can stop asking.' },
    ],
  },
  {
    num: 4, title: 'Finishing the hole', gloss: 'Gimmes inside the leather · pick up at +2 for par plus four',
    clauses: [
      { id: '4.1', title: 'Gimmes', keys: ['gimme', 'concede', 'good', 'leather', 'putt'],
        short: 'A putt inside the length of your putter grip is good if the other side gives it. Inside the leather, and the opponent gives it, you don’t take it.',
        long: ['When the match is on the line they can make you putt it, and you can make them. A conceded putt counts as one stroke.'] },
      { id: '4.2', title: 'Picking up', keys: ['pick', 'white flag', 'plus four', 'quit', 'blow up'],
        short: 'Once you’re already +2 on a hole you may pick up. It costs two more, so a pick-up is always par plus four.',
        long: ['A 6 on a par 4 and you can wave the white flag; your score is 8. You may not pick up before you’re +2. In four-ball your partner’s ball is still live. In aggregate your par-plus-four goes into the team total.',
          'The scorer enters a pick-up as the gross number, par plus four. The app does the rest.'], see: ['Art. 7.1'] },
      { id: '4.3', title: 'Conceding a hole or a match', keys: ['concede', 'shake'],
        short: 'A side can concede a hole at any time, and a match once it’s decided. Shake hands.' },
    ],
  },
  {
    num: 5, title: 'Tees', gloss: 'One set for everyone · 6,500 yard floor',
    clauses: [
      { id: '5.1', title: 'One set of tees', keys: ['tee', 'yards', 'yardage'],
        short: 'Everyone plays the same tees every round, chosen from the course’s recommended yardage for the group’s average handicap, never shorter than 6,500 yards.',
        long: ['The commissioner posts the tee for each course before the trip. Nobody plays up or back, including on par 3s.'] },
    ],
  },
  {
    num: 6, title: 'On the course', gloss: 'Lost or OB: drop and two · one mulligan · USGA otherwise',
    clauses: [
      { id: '6.1', title: 'Lost ball, out of bounds', keys: ['lost', 'bounds', 'drop', 'provisional', 'fescue'],
        short: 'Don’t go back. Drop in the fairway, no nearer the hole, level with where the ball was lost or crossed the line, and add two strokes.',
        long: ['This is the USGA local rule and it’s how we keep moving through the fescue. You may still hit a provisional and play it under stroke and distance if you’d rather.'] },
      { id: '6.2', title: 'The mulligan', keys: ['mulligan', 'first tee'],
        short: 'One per player per round, on the first tee only, off the tee only. Optional. It’s gone the moment anyone in the group hits the next shot.' },
      { id: '6.3', title: 'Sand', keys: ['sand', 'bunker', 'waste', 'ground'],
        short: 'Play it as it lies. Whether Sand Valley’s sand counts as a bunker or through the green is settled before Thursday and posted here.' },
      { id: '6.4', title: 'Everything else', keys: ['usga', 'ready', 'honors'],
        short: 'The USGA Rules of Golf as written. Ready golf is expected, including putting out of turn when the match doesn’t hang on it.' },
    ],
  },
  {
    num: 7, title: 'Keeping score', gloss: 'One scorer per group · gross in, result out',
    clauses: [
      { id: '7.1', title: 'Enter gross, the app does the rest', keys: ['scorer', 'gross', 'pencil', 'enter', 'net'],
        short: 'One scorer per group holds the pencil and enters what each player actually shot, gross, hole by hole. The app applies strokes and decides the hole. Never enter a net score.',
        long: ['Each tee group elects a scorer before the round. Pick-ups go in as par plus four (Art. 4).'], see: ['Art. 4.2'] },
      { id: '7.2', title: 'Handing off the pencil', keys: ['pencil', 'handoff', 'scorer'],
        short: 'The pencil can be handed to another player in the group at any time; the handoff is logged. Only the scorer can edit the group’s card.' },
      { id: '7.3', title: 'Fixing a wrong score', keys: ['wrong', 'fix', 'edit', 'submit', 'reopen'],
        short: 'The scorer fixes a wrong score as soon as it’s noticed. A card is final once the group submits it after the last hole; only the commissioner can reopen it.' },
      { id: '7.4', title: 'No signal', keys: ['phone', 'signal', 'sync', 'offline', 'battery'],
        short: 'The card lives on the phone. If the signal goes, keep scoring; it syncs when it comes back. If the phone dies, hand the pencil to someone else.' },
    ],
  },
  {
    num: 8, title: 'Pairings', gloss: 'Posted the night before · everyone partners everyone once',
    clauses: [
      { id: '8.1', title: 'Posted the night before', keys: ['pairing', 'partner', 'tee time', 'captain'],
        short: 'The commissioner posts pairings and tee times the night before each round. Across the three team rounds everyone plays with each of his teammates once.' },
    ],
  },
  {
    num: 9, title: 'Ties and the Captains Shootout', gloss: 'The Cup never ends 5 to 5',
    clauses: [
      { id: '9.1', title: 'The Captains Shootout', keys: ['tie', 'shootout', 'level', 'putt', 'practice green', 'playoff'],
        short: 'If the Cup is 5 to 5 after Saturday, the two captains go to the practice green and putt for it. Three stations, fewest total strokes takes the Lassie.',
        long: ['Played immediately after the last singles match, on the practice green by the 18th. Each captain putts three stations in order: The Long Rail, 30 feet across the biggest break; The Fringe, 15 feet from the fringe, putter only; and The Knee Knocker, 5 feet, dead silence. Every putt is holed out, no gimmes, maximum five strokes at any station.',
          'Level after three stations and they replay The Knee Knocker until one of them isn’t. The commissioner enters the result in the app and it goes in the book as the deciding moment of the Cup.'] },
    ],
  },
  {
    num: 10, title: 'Rulings and disputes', gloss: 'Group agrees, else two balls · captains rule · halved if they can’t',
    clauses: [
      { id: '10.1', title: 'On the course', keys: ['dispute', 'ruling', 'two balls', 'argue'],
        short: 'Sort it out in the group if you can. If you can’t, play two balls where it matters and the scorer notes both outcomes. The match state is provisional until the captains rule.' },
      { id: '10.2', title: 'The captains rule', keys: ['dispute', 'ruling', 'captains', 'halved'],
        short: 'The two captains settle every dispute together after the round, before the card is submitted. If they can’t agree, the hole is halved and the match is recomputed from there.',
        long: ['Nothing in this book is meant to be a loophole. If it reads like one, it isn’t.'] },
    ],
  },
  {
    num: 11, title: 'MVP and Player of the Round', gloss: 'Hole points: 3 alone · 2 together · 1 halved',
    clauses: [
      { id: '11.1', title: 'Hole points', keys: ['mvp', 'points', 'player of the round', 'marker', 'solo', 'board', 'races'],
        short: 'Every hole you play earns points: 3 if your ball won it alone, 2 if your side won it together, 1 to all four players for a halve, 0 for a loss or a pick-up.',
        long: [
          'Your ball won it alone when you held your side’s best net score and your partner did not match it. If both partners held the best net ball, the side won it together and each takes 2. At aggregate the sum wins, so every win there is a team win. At singles there is nobody to share with, so every hole won is 3.',
          'Bye holes count. Once a match is decided the scorer keeps entering scores and those holes earn points exactly as if the match were live, so a 5 & 4 winner banks the same 18 holes as a match that goes the distance.',
        ] },
      { id: '11.2', title: 'Who wins', keys: ['mvp', 'medalist', 'tie', 'net'],
        short: 'Player of the Round is the most hole points in that round. MVP of the Freeman Cup is the most across all four. Net against par breaks a tie, and stands on its own as the Medalist line.',
        long: ['Full cards only. Skip your byes and you fall off the board; the missing holes are shown, not hidden.'] },
    ],
  },
];

/* ---------- search ---------- */

export interface Hit { art: Article; clause: Clause; terms: string[]; score: number }

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[’']/g, '').replace(/[^a-z0-9½&\- ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** The words to look for: the query's own words plus any synonyms. */
export function expandTerms(q: string): string[] {
  const phrase = norm(q);
  if (!phrase) return [];
  const out = new Set<string>();
  if (SYNONYMS[phrase]) SYNONYMS[phrase].forEach(t => out.add(t));
  phrase.split(' ').filter(w => w.length > 1).forEach(w => {
    out.add(w);
    (SYNONYMS[w] || []).forEach(t => out.add(t));
    if (w.endsWith('s') && w.length > 3) out.add(w.slice(0, -1));
  });
  return [...out];
}

function clauseText(c: Clause): string {
  return norm([c.title, c.short, ...(c.long || []), ...(c.keys || [])].join(' '));
}

/** Clauses matching the query, best first. Empty query returns nothing. */
export function searchRules(q: string, book: Article[] = RULEBOOK): Hit[] {
  const terms = expandTerms(q);
  if (!terms.length) return [];
  const phrase = norm(q);
  const words = phrase.split(' ').filter(w => w.length > 1);
  const phraseSyn = SYNONYMS[phrase];
  const hits: Hit[] = [];
  for (const art of book) {
    for (const clause of art.clauses) {
      const text = clauseText(clause);
      const title = norm(clause.title + ' ' + art.title);
      let score = 0;
      const matched: string[] = [];
      for (const t of terms) {
        if (!text.includes(t)) continue;
        matched.push(t);
        score += words.includes(t) ? 3 : 1;         // the user's own word beats a synonym
        score += Math.min(3, text.split(t).length - 2) * 0.5;   // how much the clause is about it
        if (title.includes(t)) score += 2;
        if ((clause.keys || []).some(k => norm(k).includes(t))) score += 1;
      }
      if (!matched.length) continue;
      // every word the user typed should land somewhere, itself or through a synonym,
      // unless the whole phrase is a synonym entry ("out of bounds")
      const landed = (w: string) => text.includes(w) || (w.endsWith('s') && text.includes(w.slice(0, -1)))
        || (SYNONYMS[w] || []).some(t => text.includes(t));
      const ok = phraseSyn ? phraseSyn.some(t => text.includes(t)) : words.every(landed);
      if (ok) hits.push({ art, clause, terms: matched, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.art.num - b.art.num);
}

/** Split text into plain and marked segments for the matched terms. */
export function highlight(text: string, terms: string[]): { t: string; m: boolean }[] {
  const ts = terms.filter(t => t.length > 1).sort((a, b) => b.length - a.length);
  if (!ts.length) return [{ t: text, m: false }];
  const re = new RegExp(`(${ts.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
  const out: { t: string; m: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ t: text.slice(last, i), m: false });
    out.push({ t: m[0], m: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), m: false });
  return out;
}

/** The chips under the search field: what people actually ask on a tee. */
export const QUICK: { label: string; q: string }[] = [
  { label: 'Strokes', q: 'strokes' },
  { label: 'Gimmes', q: 'gimme' },
  { label: 'Pick up', q: 'pick up' },
  { label: 'Lost ball', q: 'lost ball' },
  { label: 'Mulligan', q: 'mulligan' },
  { label: 'Tie', q: 'tie' },
  { label: 'Who enters scores', q: 'scorer' },
  { label: 'MVP', q: 'mvp' },
];
