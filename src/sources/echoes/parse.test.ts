import { describe, expect, it } from 'vitest';
import feed from './fixtures/featured-feed.json';
import hn from './fixtures/hn-front-page.json';
import manifold from './fixtures/manifold-trending.json';
import humans from './fixtures/wikidata-humans.json';
import guardianFront from './fixtures/guardian-front.json';
import wikiPages from './fixtures/wiki-pages.json';
import {
  guardianTags,
  parseFeed,
  parseGuardianFront,
  parseHnTitles,
  parseManifoldQuestions,
  parseSparqlItems,
  parseWikiPages,
} from './parse';

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
  it('reads Hacker News titles and Manifold questions', () => {
    expect(parseHnTitles(hn)).toHaveLength(30);
    expect(parseManifoldQuestions(manifold)).toContain('Will Iran’s regime fall in 2026?'.replace('’', "'"));
  });
});

// The Guardian front fixture follows the documented reply shape (editorsPicks, mostViewed, keyword tags); it
// isn't a saved reply, since the API needs a key. The Wikipedia replies are real.
describe('the Guardian front and its tags', () => {
  const front = parseGuardianFront(guardianFront);
  it('reads its editors’ picks and most viewed, with keyword tags', () => {
    expect(front.picks).toHaveLength(8);
    expect(front.viewed).toHaveLength(8);
    expect(front.picks[0].tags.map(t => t.title)).toEqual(['Binance', 'Cryptocurrencies', 'Business']);
    expect(parseGuardianFront(null)).toEqual({ picks: [], viewed: [] });
  });
  it('keeps the tags it comes back to, without sections, sport or film', () => {
    const tags = guardianTags(front);
    expect(tags.map(t => t.title)).toEqual(
      expect.arrayContaining(['Binance', 'US midterm elections 2026', 'Ukraine', 'Israel-Gaza war', 'Donald Trump']),
    );
    expect(tags.find(t => t.title === 'Binance')).toEqual({ title: 'Binance', picks: 1, viewed: 1 });
    const titles = tags.map(t => t.title);
    ['Business', 'US news', 'Film', 'Bollywood', 'Cristiano Ronaldo', 'Poland', 'Bonfire night'].forEach(t =>
      expect(titles).not.toContain(t),
    ); // a section, sport or film, or seen only once
  });
  it('matches tags to Wikipedia articles, following redirects', () => {
    const pages = parseWikiPages(wikiPages);
    expect(pages.get('Israel-Gaza war')?.title).toBe('Gaza war');
    expect(pages.get('Cryptocurrencies')?.title).toBe('Cryptocurrency');
    expect(pages.get('2026 United States midterm elections')?.title).toBe('2026 United States elections');
    expect(pages.get('Ukraine')).toMatchObject({ description: 'Country in Eastern Europe', qid: 'Q212' });
    expect(pages.has('Cop31')).toBe(false); // no article by that name
  });
});
