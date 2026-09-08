/**
 * Turn a share card that is on screen into a 1080 x 1920 PNG and hand it
 * to the phone's share sheet (or save it). No library: the card's DOM is
 * cloned with its computed styles inlined, every url() it uses (fonts,
 * the badge masks) is swapped for a data URI, and the clone is drawn
 * through an SVG foreignObject onto a canvas at 3x.
 *
 * Every step can fail on some browser or other, so callers treat a null
 * result as "take a screenshot instead", which the card is designed for.
 */


const cache = new Map<string, Promise<string>>();

/** Fetch anything (font, svg) as a data URI, once. */
function dataUri(url: string): Promise<string> {
  const abs = new URL(url, location.href).href;
  let p = cache.get(abs);
  if (!p) {
    p = fetch(abs, { mode: 'cors' })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
      .then(b => new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(fr.error);
        fr.readAsDataURL(b);
      }));
    cache.set(abs, p);
  }
  return p;
}

const URL_RE = /url\((['"]?)([^'")]+)\1\)/g;

/** Rewrite every url() in a CSS string to a data URI. */
async function inlineUrls(css: string): Promise<string> {
  const jobs: Promise<void>[] = [];
  const map = new Map<string, string>();
  css.replace(URL_RE, (_m, _q, u: string) => {
    if (!u.startsWith('data:')) jobs.push(dataUri(u).then(d => { map.set(u, d); }, () => {}));
    return '';
  });
  await Promise.all(jobs);
  return css.replace(URL_RE, (m, _q, u: string) => (map.has(u) ? `url("${map.get(u)}")` : m));
}

/** All @font-face rules the page loaded, with their files embedded. */
let fontCss: Promise<string> | null = null;
function fonts(): Promise<string> {
  if (fontCss) return fontCss;
  fontCss = (async () => {
    const parts: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList | null = null;
      try { rules = sheet.cssRules; } catch { rules = null; }
      if (rules) {
        for (const r of Array.from(rules)) if (r instanceof CSSFontFaceRule) parts.push(r.cssText);
        continue;
      }
      // cross-origin (Google Fonts): fetch the stylesheet text itself
      if (sheet.href) {
        try {
          const txt = await (await fetch(sheet.href)).text();
          txt.replace(/@font-face\s*\{[^}]*\}/g, m => { parts.push(m); return ''; });
        } catch { /* offline: system fallbacks draw instead */ }
      }
    }
    return inlineUrls(parts.join('\n'));
  })();
  return fontCss;
}

const SKIP = new Set(['length', 'parentRule', 'cssText', 'cssFloat']);

/** Deep clone with computed styles written inline on every element. */
async function freeze(src: HTMLElement): Promise<HTMLElement> {
  const dst = src.cloneNode(true) as HTMLElement;
  const a = [src, ...Array.from(src.querySelectorAll<HTMLElement>('*'))];
  const b = [dst, ...Array.from(dst.querySelectorAll<HTMLElement>('*'))];
  const jobs: Promise<void>[] = [];
  a.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const t = b[i];
    let css = '';
    for (let k = 0; k < cs.length; k++) {
      const prop = cs[k];
      if (SKIP.has(prop)) continue;
      css += `${prop}:${cs.getPropertyValue(prop)};`;
    }
    // pseudo elements carry the lattice: bake them in as real children
    (['::before', '::after'] as const).forEach(ps => {
      const p = getComputedStyle(el, ps);
      if (!p.content || p.content === 'none' || p.display === 'none') return;
      const span = document.createElement('span');
      let pcss = '';
      for (let k = 0; k < p.length; k++) {
        const prop = p[k];
        if (SKIP.has(prop) || prop === 'content') continue;
        pcss += `${prop}:${p.getPropertyValue(prop)};`;
      }
      jobs.push(inlineUrls(pcss).then(v => { span.setAttribute('style', v); }));
      if (ps === '::before') t.insertBefore(span, t.firstChild); else t.appendChild(span);
    });
    jobs.push(inlineUrls(css).then(v => { t.setAttribute('style', v); }));
  });
  await Promise.all(jobs);
  dst.querySelectorAll('[data-nocap]').forEach(n => n.remove());
  return dst;
}

/** Render the element to a PNG blob 1080 wide (about 1080 x 1920), or null if the browser won't. */
export async function renderPoster(el: HTMLElement): Promise<Blob | null> {
  try {
    // the card is captured at the size it is on screen and scaled to 1080 wide
    const W = el.clientWidth, H = el.clientHeight;
    const SC = 1080 / W;
    const [node, fcss] = await Promise.all([freeze(el), fonts()]);
    node.style.margin = '0'; node.style.transform = 'none';
    const xhtml = new XMLSerializer().serializeToString(node);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * SC)}" height="${Math.round(H * SC)}" viewBox="0 0 ${W} ${H}">` +
      `<foreignObject width="${W}" height="${H}"><div xmlns="http://www.w3.org/1999/xhtml">` +
      `<style>${fcss}</style>${xhtml}</div></foreignObject></svg>`;
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('svg')); img.src = url; });
    // Safari needs a beat after onload before the fonts inside are drawn
    await new Promise(r => setTimeout(r, 120));
    const c = document.createElement('canvas');
    c.width = Math.round(W * SC); c.height = Math.round(H * SC);
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    // a blank frame means the browser refused the foreignObject
    const px = ctx.getImageData(c.width / 2, 40, 1, 1).data;
    const bg = ctx.getImageData(4, c.height - 4, 1, 1).data;
    if (px[3] === 0 && bg[3] === 0) return null;
    return await new Promise<Blob | null>(res => c.toBlob(res, 'image/png'));
  } catch {
    return null;
  }
}

export type ShareOutcome = 'shared' | 'saved' | 'unsupported' | 'failed';

/** Share the card as an image; falls back to a download where the share sheet can't take files. */
export async function sharePoster(el: HTMLElement, name: string): Promise<ShareOutcome> {
  const blob = await renderPoster(el);
  if (!blob) return 'unsupported';
  const file = new File([blob], `${name}.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try { await nav.share({ files: [file] }); return 'shared'; }
    catch (e) { return (e as Error)?.name === 'AbortError' ? 'shared' : 'failed'; }
  }
  return savePoster(blob, name) ? 'saved' : 'unsupported';
}

function savePoster(blob: Blob, name: string): boolean {
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  } catch { return false; }
}

/** True when this browser can put an image on the share sheet at all. */
export function canShareFiles(): boolean {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (!nav.share) return false;
  if (!nav.canShare) return true;
  try { return nav.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }); } catch { return false; }
}
