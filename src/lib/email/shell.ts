/**
 * The email shell, lifted from the sign-in code email (the one that is
 * live): ink body, brass badge, a kicker, a Young Serif headline, one
 * focal card, a sentence, the rule, the jug, the footer. Every other
 * email is that shape with different contents.
 */
export const APP = 'https://freeman-cup.vercel.app';
export const SITE = 'https://thefreemancup.com';
const BADGE = `${APP}/email/email-badge.png?v=3`;
const JUG = `${APP}/email/email-jug-mid.png`;
/** the badge lattice on the body only, a transparent PNG at 9% so it reads on ink and on Gmail's
 * inverted pale alike. The masthead is solid ink-2, one shade up, behind its gradient lock (decided Sep 10). */
export let TILE = `${APP}/email/email-tile.png`;
export const setTile = (u: string) => { TILE = u; };

export const C = { ink: '#0F1E19', ink2: '#172B24', line: '#26443A', bone: '#F0EBDC', moss: '#8CA79B', dim: '#5D7268', brass: '#D8A93F', red: '#C8402F', blue: '#4C86C4' };
export const F = {
  display: "'Young Serif',Georgia,'Times New Roman',serif",
  body: "'Work Sans',Helvetica,Arial,sans-serif",
  num: "'Barlow Condensed','Arial Narrow',Arial,sans-serif",
};

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const side = (s: 'a' | 'b') => (s === 'a' ? C.red : C.blue);

/** the small caps line, as on the sign-in email */
export const kicker = (t: string, color = C.moss, pad = '34px 10px 0') =>
  `<tr><td align="center" style="padding:${pad};font-family:${F.num};font-size:13px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:${color};">${t}</td></tr>`;

export const headline = (t: string) =>
  `<tr><td align="center" style="padding:6px 10px 0;font-family:${F.display};font-size:26px;line-height:33px;font-weight:400;color:${C.bone};">${t}</td></tr>`;

/** the sentence under the card */
export const sentence = (t: string, pad = '20px 24px 0') =>
  `<tr><td align="center" style="padding:${pad};font-family:${F.body};font-size:15px;line-height:24px;color:${C.moss};">${t}</td></tr>`;

/** the one focal card: ink-2, 300 wide, centered */
export const card = (inner: string, width = 300, pad = '26px 10px 0') => `<tr>
  <td align="center" style="padding:${pad};">
    <table role="presentation" width="${width}" cellpadding="0" cellspacing="0" style="max-width:${width}px;width:100%;">
      <tr><td align="center"><div style="background-color:${C.ink2};border:1px solid ${C.line};border-radius:14px;padding:22px 16px;">${inner}</div></td></tr>
    </table>
  </td>
</tr>`;

export const cardLabel = (t: string, color = C.dim) =>
  `<div style="font-family:${F.num};font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${color};padding-bottom:6px;">${t}</div>`;

/** label / value rows, like the invite's fact rows */
export const rows = (items: [string, string][], pad = '26px 10px 0') => `<tr><td style="padding:${pad};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${items.map(([k, v], i) => `<tr>
      <td style="border-top:${i === 0 ? `1px solid ${C.line}` : '0'};border-bottom:1px solid ${C.line};padding:11px 2px;font-family:${F.num};font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${C.moss};white-space:nowrap;">${k}</td>
      <td align="right" style="border-top:${i === 0 ? `1px solid ${C.line}` : '0'};border-bottom:1px solid ${C.line};padding:11px 2px;font-family:${F.body};font-size:15px;line-height:22px;color:${C.bone};">${v}</td>
    </tr>`).join('')}
  </table>
</td></tr>`;

export const button = (label: string, href = APP, pad = '28px 10px 4px') =>
  `<tr><td align="center" style="padding:${pad};"><a href="${href}" target="_blank" style="display:inline-block;background-color:${C.brass};border-radius:10px;padding:13px 32px;font-family:${F.num};font-size:16px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${C.ink};text-decoration:none;">${label}</a></td></tr>`;

export const fine = (t: string, pad = '10px 24px 0') =>
  `<tr><td align="center" style="padding:${pad};font-family:${F.body};font-size:13px;line-height:20px;color:${C.dim};">${t}</td></tr>`;

/** a block of match lines: names, result, and the story underneath */
export const matchBlock = (items: { line: string; result: string; color: string; story?: string }[], pad = '22px 10px 0') => `<tr><td style="padding:${pad};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${items.map((it, i) => `<tr>
      <td style="padding:${i === 0 ? 0 : 14}px 2px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-family:${F.body};font-size:15px;line-height:22px;color:${C.bone};">${it.line}</td>
          <td align="right" style="font-family:${F.num};font-size:17px;font-weight:600;letter-spacing:1px;color:${it.color};white-space:nowrap;padding-left:12px;">${it.result}</td>
        </tr></table>
        ${it.story ? `<div style="font-family:${F.body};font-size:13.5px;line-height:20px;color:${C.moss};padding-top:4px;">${it.story}</div>` : ''}
      </td>
    </tr>`).join('')}
  </table>
</td></tr>`;

export function shell(o: { title: string; pre: string; body: string; foot?: string }): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(o.title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Young+Serif&family=Barlow+Condensed:wght@600&family=Work+Sans:wght@400;600&display=swap');
  body { margin:0; padding:0; }
  table { border-collapse:collapse; }
  img { border:0; line-height:100%; }
</style>
</head>
<body style="margin:0;padding:0;background-color:${C.ink};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(o.pre)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.ink};">
    <tr>
      <td align="center" style="padding:34px 20px 26px;background-color:${C.ink2};background-image:linear-gradient(${C.ink2},${C.ink2});">
        <img src="${BADGE}" width="60" height="61" alt="The Freeman Cup" style="display:block;">
      </td>
    </tr>
    <tr>
      <td align="center" background="${TILE}" style="padding:0 20px;background-color:${C.ink};background-image:url(${TILE});background-repeat:repeat;background-position:center top;background-size:140px 140px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
          ${o.body}
          <tr><td style="padding:34px 10px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid ${C.line};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
          <tr><td align="center" style="padding:16px 10px 0;"><img src="${JUG}" width="13" height="26" alt="" style="display:block;"></td></tr>
          <tr><td align="center" style="padding:8px 24px 36px;font-family:${F.body};font-size:12px;line-height:19px;color:${C.dim};">${o.foot ? o.foot + '<br>' : ''}The Freeman Cup &middot; Sand Valley, Wisconsin</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
