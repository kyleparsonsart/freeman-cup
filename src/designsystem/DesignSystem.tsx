import { useEffect, useMemo, useState } from 'react';
import './ds.css';
import { TrophySvg } from '../components/CupStrip';
import { getTheme, setTheme, type Theme } from '../lib/theme';
import { useSampleContext } from './sample';
import * as D from './Demos';

/* =====================================================================
   Tokens are read from the stylesheet at runtime, so this page cannot
   disagree with what the app ships. Flip the theme and everything below
   (values, swatches, contrast) recomputes from body.light.
   ===================================================================== */

const COLOR_GROUPS: { title: string; blurb: string; tokens: { t: string; n: string; d: string }[] }[] = [
  {
    title: 'Green', blurb: 'The scorecard. Three steps of the same green carry every surface. The page, the header and the tab bar are all plain ink; nothing sits on a field.',
    tokens: [
      { t: 'ink',   n: 'Ink',     d: 'The page. Cards, the hole card, the phone frame.' },
      { t: 'ink-2', n: 'Ink 2',   d: 'Raised a step: inputs, big feed rows, settings fields, picker cells.' },
      { t: 'ink-3', n: 'Ink 3',   d: 'Raised twice: the derive line, the scorer picker, selected notation cells.' },
      { t: 'board', n: 'Board',   d: 'The darkest step. The scorer bar under the hole card.' },
      { t: 'line',  n: 'Line',    d: 'Every hairline. 1px, solid; dashed where a section is optional.' },
      { t: 'rule',  n: 'Rule',    d: 'The grid the field used to draw. Unused since Sep 1; kept so old rules resolve.' },
    ],
  },
  {
    title: 'Bone and moss', blurb: 'Text. Bone is anything you read; moss is anything that supports it; moss dim is anything you only need once.',
    tokens: [
      { t: 'bone',     n: 'Bone',     d: 'Primary text, headings, points, the big integers.' },
      { t: 'moss',     n: 'Moss',     d: 'Secondary copy, subtitles, feed bodies, the unselected picker.' },
      { t: 'moss-dim', n: 'Moss dim', d: 'Hints, kickers, timestamps, disabled and “not posted”.' },
    ],
  },
  {
    title: 'Teams', blurb: 'Red and blue are data, never decoration. A name, a side, a point. They colour text and the win rows and nothing else.',
    tokens: [
      { t: 'red',  n: 'Red · Vikes', d: 'Side A. Names, VIK chips, the left half of the tug bar, a Vikes win row.' },
      { t: 'blue', n: 'Blue · Celts', d: 'Side B. Names, CEL chips, the right half of the tug bar, a Celts win row.' },
    ],
  },
  {
    title: 'Brass', blurb: 'The one accent. It means live, selected, or the commissioner. The jug is brass, the clinch ticks are brass, and the primary button is brass with ink on it.',
    tokens: [
      { t: 'brass', n: 'Brass', d: 'Live pulse, selected tab rule, Switch, links, birdie tags, the primary button fill, The Lassie.' },
    ],
  },
];

const CONTRAST_PAIRS: { fg: string; bg: string; label: string; why: string; sample: string }[] = [
  { fg: 'bone', bg: 'ink', label: 'bone on ink', why: 'body text, headings', sample: 'Griffin S. 3 up' },
  { fg: 'bone', bg: 'ink-2', label: 'bone on ink 2', why: 'text on raised surfaces', sample: 'Griffin S. 3 up' },
  { fg: 'moss', bg: 'ink', label: 'moss on ink', why: 'secondary copy, feed bodies', sample: 'won 7 with a birdie' },
  { fg: 'moss-dim', bg: 'ink', label: 'moss dim on ink', why: 'hints and timestamps; small, never load-bearing', sample: 'Par 5 · SI 1' },
  { fg: 'brass', bg: 'ink', label: 'brass on ink', why: 'Switch, links, group labels', sample: 'Switch' },
  { fg: 'brass', bg: 'board', label: 'brass on board', why: 'the jug and its label over the field', sample: 'The Lassie' },
  { fg: 'red', bg: 'ink', label: 'red on ink', why: 'Vikes names as text', sample: 'Griffin S.' },
  { fg: 'blue', bg: 'ink', label: 'blue on ink', why: 'Celts names as text', sample: 'Kyle P.' },
  { fg: 'ink', bg: 'brass', label: 'ink on brass', why: 'the primary button label, Final chip', sample: 'Email me a code' },
  { fg: 'ink', bg: 'bone', label: 'ink on bone', why: 'the lead-change row', sample: 'Vikes lead' },
  { fg: '#FFFFFF', bg: 'red', label: 'white on red', why: 'a Vikes win row, the VIK override when set', sample: 'Match final' },
  { fg: '#FFFFFF', bg: 'blue', label: 'white on blue', why: 'a Celts win row, the CEL override when set', sample: 'Match final' },
];

type RGBA = [number, number, number, number];

function parseColor(v: string): RGBA | null {
  const s = v.trim();
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) {
    const [r, g, b] = m[1].split('').map(c => parseInt(c + c, 16));
    return [r, g, b, 1];
  }
  m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(',').map(x => parseFloat(x));
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return null;
}

function blend(fg: RGBA, bg: RGBA): RGBA {
  const a = fg[3];
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
}

function luminance([r, g, b]: RGBA): number {
  const f = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(fg: RGBA, bg: RGBA): number {
  const f = luminance(blend(fg, bg)), b = luminance(bg);
  const [hi, lo] = f > b ? [f, b] : [b, f];
  return (hi + 0.05) / (lo + 0.05);
}

function level(r: number): { t: string; c: string } {
  if (r >= 7) return { t: 'AAA', c: 'aaa' };
  if (r >= 4.5) return { t: 'AA', c: '' };
  if (r >= 3) return { t: 'AA large · non-text', c: '' };
  return { t: 'Fails', c: 'fail' };
}

const TOKEN_NAMES = ['ink', 'ink-2', 'ink-3', 'board', 'line', 'rule', 'bone', 'moss', 'moss-dim', 'red', 'blue', 'brass', 'display', 'body', 'clock'];

function readTokens(): Record<string, string> {
  const cs = getComputedStyle(document.body);
  const out: Record<string, string> = {};
  TOKEN_NAMES.forEach(n => { out[n] = cs.getPropertyValue(`--${n}`).trim(); });
  return out;
}

const TYPE_ROLES: { role: string; where: string; size: string; spec: string; cls: string }[] = [
  { role: 'App title', where: 'Header', size: '21', spec: 'Fraunces 600 · −0.015em · opsz 32 · SOFT 30 · WONK 0', cls: '.hd h1' },
  { role: 'Section', where: 'Rosters, If we finish level', size: '19', spec: 'Fraunces 600 · −0.015em · WONK 0', cls: '.sh h2' },
  { role: 'Round title', where: 'Course name on a round card', size: '19', spec: 'Fraunces 600 · −0.015em', cls: '.rtop .t1' },
  { role: 'Day', where: 'Feed and schedule day headers', size: '17 / 18', spec: 'Fraunces 600 · −0.015em', cls: '.dayhd .n · .dayrow .n' },
  { role: 'Group label', where: 'Settings sections', size: '16', spec: 'Fraunces 600 · brass', cls: '.grp h3' },
  { role: 'Tab', where: 'Scoring · Live · Schedule', size: '16', spec: 'Fraunces 600', cls: '.tab' },
  { role: 'Player', where: 'Name on the hole card', size: '20', spec: 'Work Sans 600 · −0.01em · team colour', cls: '.brow .bn' },
  { role: 'Body', where: 'Everything you read', size: '17', spec: 'Work Sans 400 · 1.6', cls: 'body' },
  { role: 'Feed body', where: 'Feed rows', size: '15 / 13', spec: 'Work Sans · moss, sub-line moss dim', cls: '.ev .bd · .sub2' },
  { role: 'Subtitle', where: 'Under the app title, strip labels', size: '11.5', spec: 'Work Sans · .012em · moss', cls: '.hd .sub · .striplbl' },
  { role: 'Tag', where: 'Match final, Birdie, Dormie', size: '10.5', spec: 'Work Sans 600 · pill', cls: '.tag' },
  { role: 'Cup points', where: 'Strip', size: '45', spec: 'Barlow Condensed 600 · tabular', cls: '.sside .pt' },
  { role: 'Hole number', where: 'Hole navigator', size: '24', spec: 'Barlow Condensed 600', cls: '.hnav .hh1' },
  { role: 'Score mark', where: 'Picker cells, scorecard', size: '24', spec: 'Barlow Condensed 600 · notation rings on select', cls: '.mk' },
  { role: 'Match state', where: 'Schedule match rows, group tabs', size: '17', spec: 'Barlow Condensed 600', cls: '.mrow2 .s · .ft2' },
  { role: 'Timestamp', where: 'Feed', size: '14', spec: 'Barlow Condensed 600 · moss dim', cls: '.ev .t' },
];

const ruleSwatch: React.CSSProperties = {
  backgroundColor: 'var(--board)',
  backgroundImage: 'repeating-linear-gradient(0deg,transparent 0 11px,var(--rule) 11px 12px),repeating-linear-gradient(90deg,transparent 0 11px,var(--rule) 11px 12px)',
};

export default function DesignSystem() {
  useSampleContext();
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const [tokens, setTokens] = useState<Record<string, string>>({});

  useEffect(() => {
    document.body.classList.add('ds');
    document.title = 'The Freeman Cup · Design system';
    return () => { document.body.classList.remove('ds'); };
  }, []);

  useEffect(() => {
    setTheme(theme);
    // read after the class flip has painted
    const id = requestAnimationFrame(() => setTokens(readTokens()));
    return () => cancelAnimationFrame(id);
  }, [theme]);

  const contrast = useMemo(() => CONTRAST_PAIRS.map(p => {
    const fgv = p.fg.startsWith('#') ? p.fg : tokens[p.fg];
    const bgv = tokens[p.bg];
    const fg = parseColor(fgv || '');
    const bg = parseColor(bgv || '');
    const r = fg && bg ? ratio(fg, bg) : 0;
    return { ...p, r, lvl: level(r), fgv, bgv };
  }), [tokens]);

  const stack = (v?: string) => (v || '').replace(/,/g, ', ');
  const hex = (v?: string) => (v || '…').startsWith('#') ? (v || '').toUpperCase() : (v || '…');

  return (
    <>
      <header className="ds-hd">
        <TrophySvg />
        <h1>The Freeman Cup design system</h1>
        <span className="ds-chip">Live tokens</span>
        <span className="sp" />
        <div className="ds-theme" role="group" aria-label="Theme">
          <button aria-pressed={theme === 'dark'} onClick={() => setThemeState('dark')}>Dark</button>
          <button aria-pressed={theme === 'light'} onClick={() => setThemeState('light')}>Light</button>
        </div>
        <a href="/">Open the app →</a>
      </header>

      <div className="ds-wrap">
        <nav className="ds-nav" aria-label="Sections">
          <div className="g"><div className="k">Start</div><a href="#overview">Overview</a></div>
          <div className="g"><div className="k">Foundations</div><a href="#color">Color</a><a href="#type">Type</a><a href="#form">Form and layout</a></div>
          <div className="g"><div className="k">Patterns</div><a href="#components">Components</a><a href="#voice">Voice</a></div>
          <div className="g"><div className="k">Upkeep</div><a href="#true">How this stays true</a></div>
        </nav>

        <main className="ds-main">
          {/* ---------------- Overview ---------------- */}
          <section className="ds-sec" id="overview">
            <span className="ds-eyebrow">Getting started</span>
            <h2 className="ds-h1">A scorecard, in the dark</h2>
            <p className="ds-lead">
              Everything decided about how the Freeman Cup app looks, read from the stylesheet that ships it.
              Dark scorecard green, bone text, brass for the one thing that matters, red and blue only where a team is being named.
            </p>
            <div className="ds-grid" style={{ marginTop: 28 }}>
              <a className="ds-card" href="#color" style={{ textDecoration: 'none' }}><div className="n">Color</div><div className="d">12 tokens, one accent, contrast computed on this page</div></a>
              <a className="ds-card" href="#type" style={{ textDecoration: 'none' }}><div className="n">Type</div><div className="d">Fraunces, Work Sans, Barlow Condensed. Every integer is condensed</div></a>
              <a className="ds-card" href="#form" style={{ textDecoration: 'none' }}><div className="n">Form and layout</div><div className="d">Square corners, one hairline, flat ink, a 420px frame on desktop only</div></a>
              <a className="ds-card" href="#components" style={{ textDecoration: 'none' }}><div className="n">Components</div><div className="d">The strip, the hole card, feed rows, cards, the scorecard, settings</div></a>
              <a className="ds-card" href="#voice" style={{ textDecoration: 'none' }}><div className="n">Voice</div><div className="d">Sentence case, golf words, the app says what it decided and why</div></a>
            </div>
            <p className="ds-p" style={{ marginTop: 22 }}>
              The type foundation is Dado's, from Detail Binder. The rest is the prototype's, <code>freeman-cup-v66.html</code>,
              whose 680-line stylesheet is <code>src/index.css</code> verbatim. Two attempts to translate it into utilities drifted; copying it did not.
            </p>
          </section>

          {/* ---------------- Color ---------------- */}
          <section className="ds-sec" id="color">
            <span className="ds-eyebrow">Foundations · 01</span>
            <h2 className="ds-h1">Color</h2>
            <p className="ds-lead">
              Dark green, warm bone, one brass. The values below are read from <b>{theme === 'light' ? 'body.light' : ':root'}</b> right now, so switching the theme above changes every number on this page.
            </p>

            {COLOR_GROUPS.map(g => (
              <div key={g.title}>
                <h3 className="ds-h3">{g.title}</h3>
                <p className="ds-p">{g.blurb}</p>
                <div className="ds-grid">
                  {g.tokens.map(t => (
                    <div key={t.t} className="ds-card">
                      <div className="ds-sw" style={t.t === 'rule' ? ruleSwatch : { background: `var(--${t.t})` }} />
                      <div className="n">{t.n}</div>
                      <div className="d">{t.d}</div>
                      <span className="ds-code">--{t.t}</span>
                      <span className="ds-code">{hex(tokens[t.t])}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <h3 className="ds-h3">Contrast</h3>
            <p className="ds-p">
              Computed from the live values, not typed in. Change a hex in <code>index.css</code> and the pair moves here on the next load. White on the team colours is listed because the win rows and the override buttons use it.
            </p>
            <div className="ds-tw">
              <table className="ds-table">
                <thead><tr><th>Pair</th><th>Sample</th><th>Ratio</th><th>Level</th></tr></thead>
                <tbody>
                  {contrast.map(p => (
                    <tr key={p.label}>
                      <td>{p.label}<small>{p.why}</small></td>
                      <td><span className="ds-sample" style={{ color: p.fgv, background: p.bgv }}>{p.sample}</span></td>
                      <td><span className="ds-ratio">{p.r ? p.r.toFixed(2) : '–'}:1</span></td>
                      <td><span className={`ds-lvl ${p.lvl.c}`}>{p.lvl.t}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ds-p" style={{ marginTop: 14 }}>
              Moss dim is deliberately quiet. It carries hints and timestamps that are fine to miss, never a number that decides anything; anything that decides is bone or a team colour.
            </p>
          </section>

          {/* ---------------- Type ---------------- */}
          <section className="ds-sec" id="type">
            <span className="ds-eyebrow">Foundations · 02</span>
            <h2 className="ds-h1">Type</h2>
            <p className="ds-lead">
              Fraunces carries the titles, Work Sans carries the reading, Barlow Condensed carries anything that counts. Sentence case throughout, including tags and buttons. The one rule people break: if it is an integer, it is condensed.
            </p>

            <h3 className="ds-h3">Families</h3>
            <div className="ds-grid">
              <div className="ds-card">
                <div className="ds-fam" style={{ fontFamily: 'var(--display)', fontVariationSettings: "'opsz' 48,'SOFT' 30,'WONK' 1", fontWeight: 500 }}>Aa Bb 0123</div>
                <div className="n">Display</div>
                <div className="d">Titles, section heads, day names, tabs. Variable axes: opsz tracks size, SOFT 30, WONK 0 on functional text.</div>
                <span className="ds-code">--display</span>
                <div className="ds-stack">{stack(tokens.display)}</div>
              </div>
              <div className="ds-card">
                <div className="ds-fam" style={{ fontFamily: 'var(--body)' }}>Aa Bb 0123</div>
                <div className="n">Body</div>
                <div className="d">All reading text, names, buttons, labels. 17px on the page, 15 in the feed, 13 for supporting lines.</div>
                <span className="ds-code">--body</span>
                <div className="ds-stack">{stack(tokens.body)}</div>
              </div>
              <div className="ds-card">
                <div className="ds-fam" style={{ fontFamily: 'var(--clock)', fontWeight: 600 }}>Aa Bb 0123</div>
                <div className="n">Clock</div>
                <div className="d">Every integer: points, hole numbers, scores, match state, times. Tabular numerals so columns hold still.</div>
                <span className="ds-code">--clock</span><span className="ds-code">--num</span>
                <div className="ds-stack">{stack(tokens.clock)}</div>
              </div>
            </div>

            <h3 className="ds-h3">Roles</h3>
            <div className="ds-tw">
              <table className="ds-table">
                <thead><tr><th>Role</th><th>Where</th><th>Size</th><th>Spec</th><th>Class</th></tr></thead>
                <tbody>
                  {TYPE_ROLES.map(r => (
                    <tr key={r.role}><td>{r.role}</td><td>{r.where}</td><td><span className="ds-ratio">{r.size}</span></td><td>{r.spec}</td><td><span className="ds-code">{r.cls}</span></td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="ds-h3">Specimens</h3>
            <p className="ds-p">Live, using the app's own classes. Nothing here is styled by hand.</p>
            <div className="ds-spec"><div className="m"><b>App title</b><code>.hd h1</code></div><div className="hd" style={{ padding: 0 }}><h1>The Freeman Cup</h1></div></div>
            <div className="ds-spec"><div className="m"><b>Section</b><code>.sh h2</code></div><div className="sh" style={{ padding: 0 }}><h2>If we finish level</h2></div></div>
            <div className="ds-spec"><div className="m"><b>Cup points</b><code>.sside .pt</code></div><div className="sside a" style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}><span className="pt">3½</span><span className="nm">Vikes</span></div></div>
            <div className="ds-spec"><div className="m"><b>Hole number</b><code>.hnav .hh1</code></div><div className="hnav" style={{ border: 'none' }}><div className="hnc" style={{ alignItems: 'flex-start', padding: 0 }}><span className="hh1">Hole 7</span><span className="hh2">Par 5 · SI 1</span></div></div></div>
            <div className="ds-spec"><div className="m"><b>Player</b><code>.brow .bn</code></div><div className="brow" style={{ padding: 0 }}><span className="bn a">Griffin S.<span className="hcp"> (15)</span></span></div></div>
            <div className="ds-spec"><div className="m"><b>Body</b><code>body · 17px</code></div><div style={{ maxWidth: '54ch' }}>Each tee time elects a scorer on the first tee. That person enters every hole for everyone in the group, which is how a paper card already works.</div></div>
            <div className="ds-spec"><div className="m"><b>Feed body</b><code>.ev .bd</code></div><div className="ev" style={{ padding: 0, border: 'none' }}><div className="bd"><span className="tag gold">Birdie</span><span className="who b">Kyle P.</span> won 11 with a birdie.<span className="sub2">Griffin S. v Kyle P. · 3 up</span></div></div></div>
            <div className="ds-spec"><div className="m"><b>Subtitle</b><code>.hd .sub</code></div><div className="hd" style={{ padding: 0 }}><div className="sub" style={{ marginTop: 0 }}>5th Annual · Sand Valley · Oct 2026</div></div></div>
          </section>

          {/* ---------------- Form and layout ---------------- */}
          <section className="ds-sec" id="form">
            <span className="ds-eyebrow">Foundations · 03</span>
            <h2 className="ds-h1">Form and layout</h2>
            <p className="ds-lead">
              Square, ruled, and flat. Corners are 2px or none, except pills and avatars which are round. Depth comes from stepping the green, not from shadows.
            </p>
            <div className="ds-two">
              <div className="ds-tile"><div className="ds-shape" style={{ borderRadius: 2 }} /><div className="n">2px radius</div><div className="d">Inputs, the primary button, eyebrows. Barely there; enough to not look cut with scissors.</div><span className="ds-code">border-radius:2px</span></div>
              <div className="ds-tile"><div className="ds-shape" style={{ borderRadius: 0 }} /><div className="n">No radius</div><div className="d">Cards, feed rows, picker cells, the override strip, the scorecard grid. Everything that tiles.</div><span className="ds-code">.rcard · .ev · .tg</span></div>
              <div className="ds-tile"><div className="ds-shape" style={{ borderRadius: 28, width: 120 }} /><div className="n">Pill</div><div className="d">Tags and state pills. 20px radius, 10.5 to 12px text. The derive-line labels are the exception: plain text.</div><span className="ds-code">.tag · .spill</span></div>
              <div className="ds-tile"><div className="ds-shape" style={{ borderRadius: 34 }} /><div className="n">The frame</div><div className="d">34px on the phone frame and the settings sheet, on desktop only. On a phone the app fills the viewport.</div><span className="ds-code">.phone @media(min-width:520px)</span></div>
            </div>

            <h3 className="ds-h3">Lines</h3>
            <div className="ds-two">
              <div className="ds-tile"><div style={{ borderTop: '1px solid var(--line)', margin: '18px 0' }} /><div className="n">Hairline</div><div className="d">1px, solid, --line. Between rows, around cards, under the header. The only border weight, with one exception.</div></div>
              <div className="ds-tile"><div style={{ borderTop: '2px solid var(--line)', margin: '18px 0' }} /><div className="n">Hole navigator top</div><div className="d">2px. The one heavier rule, marking where the hole card starts.</div><span className="ds-code">.hnav</span></div>
              <div className="ds-tile"><div style={{ borderTop: '1px dashed var(--line)', margin: '18px 0' }} /><div className="n">Dashed</div><div className="d">Something optional or developer-only sits below: the dev sign-in row, sections on this page.</div><span className="ds-code">.adev</span></div>
              <div className="ds-tile"><div style={{ borderTop: '2px solid var(--brass)', margin: '18px 0', width: '33%' }} /><div className="n">Selected</div><div className="d">A 2px brass rule on the selected tab, and a 2px brass focus ring everywhere.</div><span className="ds-code">.tab[aria-selected] · :focus-visible</span></div>
            </div>

            <h3 className="ds-h3">The page</h3>
            <p className="ds-p">
              Plain ink, edge to edge: the page, the header and the tab bar are the same colour, and content runs full width so every tap target gets the whole phone. The prototype drew a ruled field behind the header and tabs; it came out on Sep 1 (<code>body.board-on</code> is no longer set).
            </p>

            <h3 className="ds-h3">Measurements</h3>
            <dl className="ds-kv">
              <dt>Gutter</dt><dd>18px on both edges; 14px inside cards and the hole card.</dd>
              <dt>Rows</dt><dd>11 to 14px vertical padding; feed rows 11, settings fields 13, match rows 12.</dd>
              <dt>Picker</dt><dd>Cells are 20% wide and 74px tall, five in view, snap-scrolled. The score mark box is a fixed 36px so notation rings never shift the row.</dd>
              <dt>Touch</dt><dd>Nothing tappable is under 38px tall. Hole navigator buttons are 64 × 60.</dd>
              <dt>Frame</dt><dd>Max 420px wide, 860 tall, only at 520px+ wide and 820px+ tall. Otherwise 100dvh, safe-area padding under the tabs.</dd>
            </dl>
          </section>

          {/* ---------------- Components ---------------- */}
          <section className="ds-sec" id="components">
            <span className="ds-eyebrow">Patterns · 01</span>
            <h2 className="ds-h1">Components</h2>
            <p className="ds-lead">
              Every one of these is a class in <b>index.css</b> and a small React component that renders it. There is no component library; the prototype's stylesheet is the library. Shown with sample data.
            </p>

            <D.Demo title="Header and tabs" classes={['.hd', '.hd h1', '.hd .sub', '.cog', '.tabs', '.tab', '.pulse']} stage="board"
              note={<>The header sits on the field. The gear is brass for the commissioner, moss for everyone else. The Live tab carries a pulse while a round is live.</>}>
              <D.Header /><D.Tabs />
            </D.Demo>

            <D.Demo title="Cup strip" classes={['.strip', '.sside', '.pt', '.jug', '.tug', '.tick', '.striplbl']}
              note={<>Points each side, the jug, the tug bar filling from each end, and the clinch ticks. Same on the Scoring and Live tabs.</>}>
              <D.Strip />
            </D.Demo>

            <D.Demo title="Group tabs" classes={['.ftabs', '.ftab', '.av', '.ft2', '.yo']} stage="board"
              note={<>When a round has more than one group, these switch the hole card. Avatars carry the team colour; the state is condensed and coloured by who leads.</>}>
              <D.GroupTabs />
            </D.Demo>

            <D.Demo title="Hole card" classes={['.hero', '.hnav', '.bovr', '.legend', '.brow', '.tgs', '.tg', '.mk', '.bder', '.hfoot']}
              note={<>The whole scoring surface, top to bottom: navigator, override strip, stroke legend, a row per player with the notation picker, the derive line, the footer, the scorer bar. Picked cells fill with the notation ring; the gold underline marks the net score a stroke turns it into.</>}>
              <div className="hero">
                <D.HoleNav />
                <D.Override />
                <D.Legend />
                <D.PlayerRow name="Griffin S." side="a" hcp={15} par={5} picked={5} stroke />
                <D.PlayerRow name="Matt J." side="a" hcp={15} par={5} picked={7} stroke />
                <D.PlayerRow name="Kyle P." side="b" hcp={15} par={5} picked={5} />
                <D.PlayerRow name="JT W." side="b" hcp={15} par={5} />
                <D.Derived kind="derived" />
                <D.HoleFoot />
                <D.ScorerBar />
              </div>
            </D.Demo>

            <D.Demo title="Override strip states" classes={['.bovr button.sel[data-w]']}
              note={<>Tapping a result by hand overrides the derived one. The set button takes the team colour; Halved takes moss.</>}>
              <D.Override sel="A" /><D.Override sel="H" /><D.Override sel="B" />
            </D.Demo>

            <D.Demo title="Derive lines" classes={['.bder', '.bder .tag', '.byebar']}
              note={<>The app always says what it did. Waiting, decided, set by hand, or a bye hole after the match closed.</>}>
              <D.Derived kind="waiting" /><D.Derived kind="derived" /><D.Derived kind="manual" /><D.Derived kind="bye" />
            </D.Demo>

            <D.Demo title="Scorer handoff" classes={['.scbar', '.swap', '.picker', '.picker button.sel', '.holine']}
              note={<>Switch opens the picker right above it; the log line remembers who took over from whom. Only the scorer or the commissioner sees Switch.</>}>
              <D.ScorerBar picking />
            </D.Demo>

            <D.Demo title="Feed" classes={['.dayhd', '.ev', '.ev.a', '.ev.b', '.ev.big', '.ev.win', '.ev.cup', '.ev.gold', '.who', '.tag', '.score']}
              note={<>Newest first. A team colour on the left edge says whose moment it was; a win row fills with it; a cup-level row inverts to bone. Days fold to a count.</>}>
              <D.FeedRows />
            </D.Demo>

            <D.Demo title="Round cards" classes={['.dayrow', '.rcard', '.spill', '.rscore', '.mrow2', '.rfoot']} stage="board"
              note={<>A day row, then a card per round with its state pill and score line. Match rows expand to the scorecard once there is something to show.</>}>
              <D.RoundCardDemo />
            </D.Demo>

            <D.Demo title="Scorecard" classes={['.inlinecard', '.hscroll', '.cg', '.cg .st', '.cg .cnt', '.cg .rr', '.cg .stt']}
              note={<>Par, stroke index, a row per player with the counting score bright and stroke holes dotted, then hole won and the running state. Scrolls sideways; Out, In and Tot stay in the grid.</>}>
              <D.ScorecardDemo />
            </D.Demo>

            <D.Demo title="Settings" classes={['.settings', '.sethd', '.grp', '.hint', '.fld', '.sw', '.rdrow', '.danger', '.dbtn']}
              note={<>The slide-over. Group headings in brass, fields as rows, selects right-aligned, one red button at the very bottom that asks twice.</>}>
              <D.SettingsDemo />
            </D.Demo>

            <D.Demo title="Buttons" classes={['.abtn', '.swap', '.cardlnk', '.lnk', '.aghost', '.done']} stage="pad"
              note={<>One filled button, brass with ink on it, for the single primary action on a screen. Everything else is text or a hairline chip. No icons inside buttons except the pencil on the scorer line.</>}>
              <D.Buttons />
            </D.Demo>

            <D.Demo title="Tags and pills" classes={['.tag', '.tag.gold', '.spill.live', '.spill.final', '.spill.up', '.chipstate', '.badge']} stage="pad"
              note={<>Small, sentence case, hairline. Gold when it is a birdie or the commissioner; the live pill carries the pulse.</>}>
              <D.Tags />
            </D.Demo>

            <D.Demo title="Inputs" classes={['.ainput', '.ainput.code', '.aerr']} stage="pad"
              note={<>Ink 2 on ink with a hairline. 16px text so iOS does not zoom. The code field is condensed and spaced; the error is red and says what to do.</>}>
              <D.Inputs />
            </D.Demo>

            <D.Demo title="Empty state" classes={['.empty', '.empty b']} stage="board">
              <D.Empty />
            </D.Demo>
          </section>

          {/* ---------------- Voice ---------------- */}
          <section className="ds-sec" id="voice">
            <span className="ds-eyebrow">Patterns · 02</span>
            <h2 className="ds-h1">Voice</h2>
            <p className="ds-lead">The app talks like a good scorer: says what happened, says what it decided, and does not shout.</p>
            <dl className="ds-kv">
              <dt>Sentence case</dt><dd>Everywhere, including tags, buttons and eyebrows. “Match final”, not “MATCH FINAL”. The exceptions are the team tags VIK and CEL, which are abbreviations.</dd>
              <dt>Golf words</dt><dd>4 &amp; 3, 1 up, all square, halved, dormie, bye hole. Never “won by 3”. A match won on the last hole reads “1 up”, never “1 &amp; 0”.</dd>
              <dt>Names</dt><dd>First name and initial: Griffin S. Sides joined with a slash: Griffin S. / Matt J. First names alone only in a crowded sub-line.</dd>
              <dt>Show the work</dt><dd>Every derived hole says why: “Griffin S. net 4 against Kyle P. net 5.” Every manual one says who: “Set by hand by Griffin S.”</dd>
              <dt>State what is missing</dt><dd>“Waiting on Kyle, JT.” beats a blank. “Nobody is scoring this group” beats an empty banner.</dd>
              <dt>Times</dt><dd>12:00 PM in tee times; a bare 3:42 in the feed where the day header carries the date.</dd>
              <dt>Numbers</dt><dd>Half points as ½. Condensed type for every integer, so 3½ of 10 lines up with 5½ to clinch.</dd>
              <dt>Colour is a fact</dt><dd>Red means Vikes, blue means Celts, brass means live, selected or the commissioner. Nothing is coloured to look nice.</dd>
              <dt>Middots, not dashes</dt><dd>Facts are separated with a middot: Par 5 · SI 1. Sentences end with full stops, even short ones.</dd>
            </dl>
          </section>

          {/* ---------------- How this stays true ---------------- */}
          <section className="ds-sec" id="true">
            <span className="ds-eyebrow">Upkeep</span>
            <h2 className="ds-h1">How this stays true</h2>
            <p className="ds-lead">A design system page that shows typed-in values becomes another copy of them, and copies drift. This one reads its values out of the running stylesheet.</p>
            <dl className="ds-kv">
              <dt>src/index.css</dt><dd>The source of truth. <code>:root</code> holds the dark tokens, <code>body.light</code> the light ones. Copied from the prototype verbatim; add to the bottom, never translate.</dd>
              <dt>This page</dt><dd>Reads every <code>--token</code> with <code>getComputedStyle</code> at load and on theme change, and computes contrast from what it read. Component samples are the app's own components and classes.</dd>
              <dt>Sample data</dt><dd><code>src/designsystem/sample.ts</code>. Enough of a cup to render the strip and a scorecard. Nothing here talks to Supabase.</dd>
            </dl>
            <h3 className="ds-h3">What is still copied by hand</h3>
            <p className="ds-p"><b>theme-color and the manifest.</b> <code>index.html</code> and <code>public/manifest.json</code> carry <code>#0A1410</code> as literal values because the browser reads them before any CSS runs. <code>src/lib/theme.ts</code> keeps the meta in step when the theme flips; the manifest cannot follow.</p>
            <p className="ds-p"><b>The icons.</b> Brass on ink is baked into <code>public/icons/*.png</code>. If the brass changes, regenerate them.</p>
            <p className="ds-p"><b>The type roles table above.</b> Sizes and axes are typed from the stylesheet, not read from it. The specimens are live, so a mismatch shows as the table disagreeing with the sample beside it.</p>
            <div className="ds-foot">The Freeman Cup 2026 · Sand Valley · type by Dado · built for eight people and one silver jug.</div>
          </section>
        </main>
      </div>
    </>
  );
}
