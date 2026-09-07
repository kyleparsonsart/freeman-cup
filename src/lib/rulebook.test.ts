import { describe, it, expect } from 'vitest';
import { searchRules, highlight, expandTerms, RULEBOOK } from './rulebook';

const ids = (q: string) => searchRules(q).map(h => h.clause.id);

describe('rulebook search', () => {
  it('returns nothing for an empty query', () => {
    expect(searchRules('')).toEqual([]);
    expect(searchRules('   ')).toEqual([]);
  });
  it('finds the gimme clause from plain words', () => {
    expect(ids('gimme')[0]).toBe('4.1');
    expect(ids('gimmies')[0]).toBe('4.1');
  });
  it('maps OB to the drop rule', () => {
    expect(ids('OB')[0]).toBe('6.1');
    expect(ids('out of bounds')[0]).toBe('6.1');
  });
  it('puts the stroke clause first for "strokes"', () => {
    expect(ids('strokes')[0]).toBe('3.1');
  });
  it('finds the pick-up rule', () => {
    expect(ids('pick up')[0]).toBe('4.2');
    expect(ids('white flag')[0]).toBe('4.2');
  });
  it('finds the shootout for tie words', () => {
    expect(ids('tie')).toContain('9.1');
    expect(ids('playoff')[0]).toBe('9.1');
  });
  it('requires every typed word to land', () => {
    expect(ids('mulligan saturday')).toEqual([]);
    expect(ids('mulligan tee')[0]).toBe('6.2');
  });
  it('expands synonyms without dropping the typed word', () => {
    expect(expandTerms('lost ball')).toEqual(expect.arrayContaining(['lost', 'ball', 'drop']));
  });
  it('highlights matched terms case-insensitively', () => {
    const segs = highlight('Strokes fall on the stroke index.', ['stroke']);
    expect(segs.filter(s => s.m).map(s => s.t)).toEqual(['Stroke', 'stroke']);
    expect(segs.map(s => s.t).join('')).toBe('Strokes fall on the stroke index.');
  });
  it('every clause id is unique and prefixed by its article', () => {
    const all = RULEBOOK.flatMap(a => a.clauses.map(c => [a.num, c.id] as const));
    expect(new Set(all.map(([, id]) => id)).size).toBe(all.length);
    all.forEach(([n, id]) => expect(id.startsWith(`${n}.`)).toBe(true));
  });
});
