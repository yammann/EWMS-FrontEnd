import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PlaceIndex, PlacesFile, normalizePlaceText } from './places';

describe('Place search', () => {
  const file = resolve(process.cwd(), 'public/maps/syria-places.json');
  const data = JSON.parse(readFileSync(file, 'utf8')) as PlacesFile;
  const index = new PlaceIndex(data.places);

  it('ships a few thousand Syrian places, each with a governorate', () => {
    expect(data.places.length).toBeGreaterThan(5000);
    expect(data.places.every(p => /^SY\d\d$/.test(p[5]))).toBe(true);
  });

  it('normalizes hamza, ta marbuta, alef maqsura, diacritics and the definite article', () => {
    expect(normalizePlaceText('الْمَزَّة')).toBe('المزه');
    expect(normalizePlaceText('أَحْمَد')).toBe(normalizePlaceText('احمد'));
    expect(normalizePlaceText('اللاذقيّة')).toBe(normalizePlaceText('اللاذقيه'));
  });

  it('finds a neighbourhood with or without "ال"', () => {
    expect(index.search('المزة')[0].nameAr).toBe('المزة');
    expect(index.search('مزه')[0].nameAr).toBe('المزة');
    expect(index.search('المزة')[0].governorate).toBe('SY01');
  });

  it('ranks the city before villages that share the name', () => {
    const first = index.search('حلب')[0];
    expect(first.nameAr).toBe('حلب');
    expect(first.type).toBe('city');
  });

  it('finds by English name and returns nothing for gibberish or empty text', () => {
    expect(index.search('damascus')[0].nameAr).toBe('دمشق');
    expect(index.search('')).toEqual([]);
    expect(index.search('ظظظظظظ')).toEqual([]);
  });

  it('limits the number of results', () => {
    expect(index.search('ال', 5).length).toBeLessThanOrEqual(5);
  });
});
