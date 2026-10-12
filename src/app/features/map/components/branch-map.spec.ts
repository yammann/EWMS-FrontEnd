import { MapLayer, MapSite } from '@features/devices';
import { describeLayers, layerTotals, mergeLayers } from './branch-map';

const site = (id: number, count: number, extra: Partial<MapSite> = {}): MapSite => ({
  id, name: `موقع ${id}`, description: '', governorateCode: 'SY01', governorateName: 'دمشق',
  latitude: 33.5, longitude: 36.3, installationsCount: 0, deviceTypesCount: 0, entriesCount: 0, count, ...extra
});

describe('Branch map layers merge', () => {
  // طبقة تلقائية من بيانات النظام، وطبقة من بيانات النظام بفلتر، وطبقة يدوية
  const devices: MapLayer = { key: 'devices', kind: 'devices', title: 'تركيبات الأجهزة', color: '', unit: 'تركيب', sitesWithoutCoordinates: 0,
    sites: [site(1, 3), site(2, 1)] };
  const cameras: MapLayer = { key: 'layer-7', kind: 'devices', title: 'الكاميرات', color: '#DC2626', unit: 'تركيب', sitesWithoutCoordinates: 0,
    sites: [site(2, 1)] };
  const projects: MapLayer = { key: 'layer-5', kind: 'entries', title: 'المشاريع', color: '#16A34A', unit: 'سجل', sitesWithoutCoordinates: 0,
    sites: [site(2, 2), site(3, 1)] };

  it('shows a shared site once, with the colour and count of every layer it belongs to', () => {
    const merged = mergeLayers([devices, projects]);
    expect(merged.map(s => s.id)).toEqual([1, 2, 3]);
    const shared = merged.find(s => s.id === 2)!;
    expect(shared.layers.map(l => l.color)).toEqual(['var(--brand-600)', '#16A34A']);
    expect(shared.layers.map(l => [l.count, l.unit])).toEqual([[1, 'تركيب'], [2, 'سجل']]);
    expect(describeLayers(shared)).toBe('تركيبات الأجهزة (1) · المشاريع (2)');
  });

  it('treats several layers of the same source independently (no overwriting)', () => {
    const shared = mergeLayers([devices, cameras]).find(s => s.id === 2)!;
    expect(shared.layers.map(l => `${l.title}:${l.count}`)).toEqual(['تركيبات الأجهزة:1', 'الكاميرات:1']);
  });

  it('counts only the visible layers, and totals each layer across sites', () => {
    const merged = mergeLayers([projects]);
    expect(merged.map(s => s.id)).toEqual([2, 3]);
    expect(layerTotals(mergeLayers([devices, projects]))).toEqual([
      { key: 'devices', title: 'تركيبات الأجهزة', color: 'var(--brand-600)', count: 4 },
      { key: 'layer-5', title: 'المشاريع', color: '#16A34A', count: 3 }
    ]);
  });
});
