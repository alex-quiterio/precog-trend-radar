// Other names a shipped topic goes by (its Portuguese ones), which the Reading stream matches too.
import { describe, expect, it } from 'vitest';
import { otherNames } from '@core/config';
import { topicRegex } from '@sources/registry';
import { readingScore } from '@sources/reading/parse';

describe('otherNames', () => {
  it('gives the Portuguese names of a Portugal topic, whatever the case', () => {
    expect(otherNames('portugal', 'Permaculture')).toEqual(['permacultura']);
    expect(otherNames('portugal', 'wildfires')).toContain('incêndios');
  });
  it('is empty for a topic with none, another lens, or one you added', () => {
    expect(otherNames('housing', 'Rent control')).toEqual([]);
    expect(otherNames('energy', 'Permaculture')).toEqual([]);
    expect(otherNames('portugal', 'Cork oak')).toEqual([]);
  });
  it('matches whole Portuguese words, accents and all', () => {
    const res = otherNames('portugal', 'Wildfires').map(topicRegex);
    expect(readingScore({ title: 'Incêndios: área ardida cai para metade', text: '' }, res)).toBe(3);
    expect(readingScore({ title: 'Seca', text: 'o risco de incêndio rural sobe no interior' }, res)).toBe(1);
    expect(readingScore({ title: 'Incendiários detidos', text: '' }, res)).toBe(0);
  });
});
