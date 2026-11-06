import { describe, expect, it } from 'vitest';
import feed from './fixtures/featured-feed.json';
import hn from './fixtures/hn-front-page.json';
import manifold from './fixtures/manifold-trending.json';
import humans from './fixtures/wikidata-humans.json';
import { parseFeed, parseGuardianHeadlines, parseHnTitles, parseManifoldQuestions, parseSparqlItems } from './parse';

describe('echo replies (saved 6 Nov 2026)', () => {
  it('reads Wikipedia’s feed: In the news stories with their articles, and the most read with their history', () => {
    const f = parseFeed(feed);
    expect(f.news).toHaveLength(5);
    expect(f.news[2].map(a => a.title)).toEqual(['2026 Binance hack', 'Digital currency', 'Cryptocurrency', 'Binance']);
    expect(f.news[2][0]).toMatchObject({ description: 'Cryptocurrency theft', qid: expect.stringMatching(/^Q\d+$/) });
    expect(f.mostRead).toHaveLength(40);
    const elections = f.mostRead.find(a => a.title === '2026 United States elections');
    expect(elections).toMatchObject({ views: 356470, rank: 8 });
    expect(elections?.history).toEqual([94454, 201102, 455194, 1153444, 356470]);
  });
  it('leaves out what isn’t an article, and copes with a reply missing parts', () => {
    const f = parseFeed({
      news: [{ links: [{ title: 'Main_Page', type: 'disambiguation' }, { title: 'Real_topic' }] }],
      mostread: { articles: [{ title: 'Talk:Thing', namespace: { id: 1 }, views: 5 }] },
    });
    expect(f.news).toEqual([[{ title: 'Real topic', description: '', qid: '' }]]);
    expect(f.mostRead).toEqual([]);
    expect(parseFeed(null)).toEqual({ news: [], mostRead: [] });
  });
  it('reads which items Wikidata says are people', () => {
    const people = parseSparqlItems(humans);
    expect(people.has('Q25752879')).toBe(true); // Abdul El-Sayed, the most read article
    expect(people.has('Q1636999')).toBe(false); // the Constitutional Tribunal of Poland
  });
  it('reads Hacker News titles, Manifold questions and Guardian headlines', () => {
    expect(parseHnTitles(hn)).toHaveLength(30);
    expect(parseManifoldQuestions(manifold)).toContain('Will Iran’s regime fall in 2026?'.replace('’', "'"));
    expect(parseGuardianHeadlines({ response: { results: [{ webTitle: 'A headline' }, {}] } })).toEqual(['A headline']);
  });
});
