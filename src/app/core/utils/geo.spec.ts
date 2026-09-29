import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GovernorateCollection, GovernorateFeature, governorateOf, pointInFeature, projectSyria } from './geo';

describe('SVG projection', () => {
  const file = resolve(process.cwd(), 'public/maps/syria-governorates.geojson');
  const features = (JSON.parse(readFileSync(file, 'utf8')) as GovernorateCollection).features;
  const p = projectSyria(features);

  it('round-trips coordinates (click on map → exact lat/lng)', () => {
    const [x, y] = p.project(33.5138, 36.2765);
    const [lat, lng] = p.invert(x, y);
    expect(lat).toBeCloseTo(33.5138, 6);
    expect(lng).toBeCloseTo(36.2765, 6);
  });

  it('fits Syria in a 1000-wide drawing with one path and box per governorate', () => {
    expect(p.width).toBe(1000);
    expect(p.height).toBeGreaterThan(600);
    expect(p.governorates.length).toBe(14);
    for (const g of p.governorates) {
      expect(g.path.startsWith('M')).toBe(true);
      expect(g.box.w).toBeGreaterThan(0);
    }
  });
});

const square = (code: string, minLng: number, minLat: number, size: number): GovernorateFeature => ({
  type: 'Feature',
  properties: { code, nameAr: code, nameEn: code, centerLat: minLat + size / 2, centerLng: minLng + size / 2 },
  geometry: { type: 'Polygon', coordinates: [[[minLng, minLat], [minLng + size, minLat], [minLng + size, minLat + size], [minLng, minLat + size], [minLng, minLat]]] }
});

describe('Point in governorate', () => {
  it('detects inside / outside a polygon', () => {
    const f = square('A', 36, 33, 1);
    expect(pointInFeature(33.5, 36.5, f)).toBe(true);
    expect(pointInFeature(34.5, 36.5, f)).toBe(false);
  });

  it('respects holes', () => {
    const f = square('A', 36, 33, 2);
    (f.geometry.coordinates as [number, number][][]).push([[36.5, 33.5], [37, 33.5], [37, 34], [36.5, 34], [36.5, 33.5]]);
    expect(pointInFeature(33.7, 36.7, f)).toBe(false);
    expect(pointInFeature(33.2, 36.2, f)).toBe(true);
  });

  it('returns null for missing coordinates', () => {
    expect(governorateOf(null, 36, [square('A', 36, 33, 1)])).toBeNull();
  });

  it('places real cities in the right governorate using the bundled boundaries file', () => {
    const file = resolve(process.cwd(), 'public/maps/syria-governorates.geojson');
    const features = (JSON.parse(readFileSync(file, 'utf8')) as GovernorateCollection).features;
    expect(features.length).toBe(14);
    expect(governorateOf(33.5138, 36.2765, features)?.properties.nameAr).toBe('دمشق');   // دمشق
    expect(governorateOf(36.2021, 37.1343, features)?.properties.nameAr).toBe('حلب');    // حلب
    expect(governorateOf(34.7324, 36.7137, features)?.properties.nameAr).toBe('حمص');    // حمص
    expect(governorateOf(35.5317, 35.7913, features)?.properties.nameAr).toBe('اللاذقية'); // اللاذقية
  });
});
