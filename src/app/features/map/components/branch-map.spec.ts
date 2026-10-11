import { MapLayer, MapSite } from '@features/devices';
import { describeLayers, mergeLayers } from './branch-map';

const site = (id: number, extra: Partial<MapSite> = {}): MapSite => ({
  id, name: `موقع ${id}`, description: '', governorateCode: 'SY01', governorateName: 'دمشق',
  latitude: 33.5, longitude: 36.3, installationsCount: 0, deviceTypesCount: 0, entriesCount: 0, ...extra
});

describe('Branch map layers merge', () => {
  const devices: MapLayer = { key: 'devices', kind: 'devices', title: 'تركيبات الأجهزة', color: '', sitesWithoutCoordinates: 0,
    sites: [site(1, { installationsCount: 3, deviceTypesCount: 2 }), site(2, { installationsCount: 1, deviceTypesCount: 1 })] };
  const projects: MapLayer = { key: 'layer-5', kind: 'entries', title: 'المشاريع', color: '#16A34A', sitesWithoutCoordinates: 0,
    sites: [site(2, { entriesCount: 2 }), site(3, { entriesCount: 1 })] };

  it('shows a shared site once, with the colours of every layer it belongs to', () => {
    const merged = mergeLayers([devices, projects]);
    expect(merged.map(s => s.id)).toEqual([1, 2, 3]);
    const shared = merged.find(s => s.id === 2)!;
    expect(shared.layers.map(l => l.color)).toEqual(['var(--brand-600)', '#16A34A']);
    expect(shared).toMatchObject({ installationsCount: 1, deviceTypesCount: 1, entriesCount: 2 });
    expect(describeLayers(shared)).toBe('1 تركيب · المشاريع (2)');
  });

  it('counts only the visible layers', () => {
    const merged = mergeLayers([projects]);
    expect(merged.map(s => s.id)).toEqual([2, 3]);
    expect(merged.every(s => s.installationsCount === 0)).toBe(true);
  });
});
