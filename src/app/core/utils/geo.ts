import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';

/**
 * حدود المحافظات السورية (المصدر: OCHA / HDX — Syrian Arab Republic Subnational Administrative
 * Boundaries، رخصة CC BY-IGO)، مبسّطة ومضمّنة في public/maps حتى تعمل الخريطة بدون إنترنت.
 */
export const GOVERNORATES_URL = '/maps/syria-governorates.geojson';
export const GOVERNORATES_ATTRIBUTION = 'حدود المحافظات: OCHA / HDX (CC BY-IGO)';

export interface GovernorateProps {
  code: string;      // SY01..SY14
  nameAr: string;
  nameEn: string;
  centerLat: number;
  centerLng: number;
}

type Ring = [number, number][];                 // [lng, lat]
export interface GovernorateFeature {
  type: 'Feature';
  properties: GovernorateProps;
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
}
export interface GovernorateCollection { type: 'FeatureCollection'; features: GovernorateFeature[]; }

@Injectable({ providedIn: 'root' })
export class SyriaGeoService {
  private http = inject(HttpClient);
  private governorates$?: Observable<GovernorateCollection>;

  /** يُحمَّل مرة واحدة لكل جلسة */
  governorates(): Observable<GovernorateCollection> {
    this.governorates$ ??= this.http.get<GovernorateCollection>(GOVERNORATES_URL).pipe(shareReplay(1));
    return this.governorates$;
  }
}

// ════════════════════ الإسقاط إلى SVG (بدون مكتبات خرائط) ════════════════════

export interface Box { x: number; y: number; w: number; h: number; }

export interface ProjectedGovernorate {
  code: string;
  nameAr: string;
  path: string;                 // SVG path (بإحداثيات الإسقاط)
  box: Box;                     // الإطار المحيط
  label: [number, number];      // موضع الاسم (مركز المحافظة)
  feature: GovernorateFeature;
}

export interface SyriaProjection {
  width: number;
  height: number;
  governorates: ProjectedGovernorate[];
  project(lat: number, lng: number): [number, number];
  invert(x: number, y: number): [number, number];   // → [lat, lng]
}

/**
 * إسقاط مستطيلي مصحّح بخط العرض (مناسب لبلد بحجم سوريا): x = Δlng·cos(φ0)، y = −Δlat،
 * بعرض ثابت 1000 وحدة. عكسه بسيط، ما يسمح بتحويل النقر على الخريطة إلى إحداثيات.
 */
export function projectSyria(features: GovernorateFeature[], width = 1000): SyriaProjection {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  const eachPoint = (f: GovernorateFeature, fn: (lng: number, lat: number) => void) => {
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const polygon of polygons) for (const ring of polygon) for (const [lng, lat] of ring) fn(lng, lat);
  };
  for (const f of features) eachPoint(f, (lng, lat) => {
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  });

  const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const scale = width / ((maxLng - minLng) * kx);
  const height = (maxLat - minLat) * scale;
  const project = (lat: number, lng: number): [number, number] => [(lng - minLng) * kx * scale, (maxLat - lat) * scale];
  const invert = (x: number, y: number): [number, number] => [maxLat - y / scale, minLng + x / (kx * scale)];

  const governorates = features.map(f => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const path = polygons.map(polygon => polygon.map(ring => ring.map(([lng, lat], i) => {
      const [x, y] = project(lat, lng);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join('') + 'Z').join('')).join('');
    return {
      code: f.properties.code,
      nameAr: f.properties.nameAr,
      path,
      box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
      label: project(f.properties.centerLat, f.properties.centerLng),
      feature: f
    };
  });

  return { width, height, governorates, project, invert };
}

/** Ray casting: هل النقطة داخل الحلقة؟ (GeoJSON: [lng, lat]) */
function inRing(lat: number, lng: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** داخل المضلع = داخل الحلقة الخارجية وليس داخل أي فتحة */
function inPolygon(lat: number, lng: number, rings: Ring[]): boolean {
  if (!rings.length || !inRing(lat, lng, rings[0])) return false;
  return !rings.slice(1).some(hole => inRing(lat, lng, hole));
}

export function pointInFeature(lat: number, lng: number, feature: GovernorateFeature): boolean {
  const g = feature.geometry;
  return g.type === 'Polygon'
    ? inPolygon(lat, lng, g.coordinates)
    : g.coordinates.some(polygon => inPolygon(lat, lng, polygon));
}

/** المحافظة التي تقع فيها النقطة (null إن كانت خارج كل المحافظات) */
export function governorateOf(lat: number | null | undefined, lng: number | null | undefined,
                              features: GovernorateFeature[]): GovernorateFeature | null {
  if (lat == null || lng == null) return null;
  return features.find(f => pointInFeature(lat, lng, f)) ?? null;
}
