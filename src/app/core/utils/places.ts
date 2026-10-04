/**
 * البحث بأسماء الأماكن السورية بدون إنترنت: ملف public/maps/syria-places.json (مدن وبلدات وقرى وأحياء من OpenStreetMap،
 * رخصة ODbL — يلزم ذكر المصدر) يُحمَّل عند أول بحث فقط. الأسماء تُطبَّع (همزات، تاء مربوطة، ألف مقصورة، تشكيل، «ال»)
 * فتجد «مزة» أو «المزّة» أو «الْمَزَّة» نفس المكان.
 */
export const PLACES_URL = '/maps/syria-places.json';
export const PLACES_ATTRIBUTION = 'بيانات الأماكن © مساهمو OpenStreetMap (ODbL)';

export type PlaceType = 'city' | 'town' | 'suburb' | 'quarter' | 'village' | 'hamlet';

/** صف في الملف: [الاسم العربي، الاسم الإنجليزي، النوع، خط العرض، خط الطول، رمز المحافظة] */
export type PlaceRow = [string, string, PlaceType, number, number, string];

export interface PlacesFile { v: number; source: string; places: PlaceRow[]; }

export interface Place {
  nameAr: string;
  nameEn: string;
  type: PlaceType;
  latitude: number;
  longitude: number;
  governorate: string;
}

export const PLACE_TYPE_LABEL: Record<PlaceType, string> = {
  city: 'مدينة', town: 'بلدة', suburb: 'ضاحية', quarter: 'حي', village: 'قرية', hamlet: 'مزرعة'
};

const TYPE_RANK: Record<PlaceType, number> = { city: 0, town: 1, suburb: 2, quarter: 3, village: 4, hamlet: 5 };

/** تطبيع نص للمطابقة (عربي/لاتيني) */
export function normalizePlaceText(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')      // التشكيل والتطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/['’`\-_.()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** كلمات النص بلا «ال» التعريف في أولها (إن بقي بعدها حرفان على الأقل) */
function words(normalized: string): string[] {
  return normalized.split(' ').filter(Boolean).map(w => (w.length > 3 && w.startsWith('ال') ? w.slice(2) : w));
}

export class PlaceIndex {
  private readonly keys: string[][];      // لكل مكان: [الاسم العربي المطبّع، الإنجليزي المطبّع] (كلمات مفصولة بمسافة، بلا ال)

  constructor(private readonly rows: PlaceRow[]) {
    this.keys = rows.map(r => [words(normalizePlaceText(r[0])).join(' '), words(normalizePlaceText(r[1])).join(' ')]);
  }

  get size() { return this.rows.length; }

  /** أفضل النتائج: مطابقة تامة ← تبدأ بالنص ← كلمة تبدأ به ← تحتويه، ثم الأهم نوعاً (مدينة قبل قرية) */
  search(query: string, limit = 8): Place[] {
    const tokens = words(normalizePlaceText(query));
    if (!tokens.length) return [];
    const whole = tokens.join(' ');

    const scored: { index: number; score: number }[] = [];
    for (let i = 0; i < this.rows.length; i++) {
      let best = Infinity;
      for (const key of this.keys[i]) {
        if (!key) continue;
        if (!tokens.every(t => key.includes(t))) continue;
        const score = key === whole ? 0
          : key.startsWith(whole) ? 1
          : key.split(' ').some(w => w.startsWith(tokens[0])) ? 2
          : 3;
        if (score < best) best = score;
      }
      if (best !== Infinity) scored.push({ index: i, score: best });
    }

    scored.sort((a, b) =>
      (a.score - b.score)
      || (TYPE_RANK[this.rows[a.index][2]] - TYPE_RANK[this.rows[b.index][2]])
      || ((this.rows[a.index][0] || this.rows[a.index][1]).length - (this.rows[b.index][0] || this.rows[b.index][1]).length));

    return scored.slice(0, limit).map(s => toPlace(this.rows[s.index]));
  }
}

function toPlace(r: PlaceRow): Place {
  return { nameAr: r[0], nameEn: r[1], type: r[2], latitude: r[3], longitude: r[4], governorate: r[5] };
}
