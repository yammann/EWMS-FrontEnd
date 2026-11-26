import { finalStageConfirm, formatHours, isFinalStage, nowLocalInput, stageLabel, toLocalInput } from './maintenance.models';
import { twoDecimals } from './spare-part.models';

describe('maintenance model helpers', () => {
  it('names each stage and treats only «delivered» and «not repairable» as final', () => {
    expect([1, 2, 3, 4, 5].map(stageLabel)).toEqual(['جديد', 'قيد العمل', 'جاهز للتسليم', 'مُسلَّم', 'غير قابل للصيانة']);
    expect(stageLabel(9)).toBe('—');
    expect(stageLabel(null)).toBe('—');
    expect([1, 2, 3, 4, 5, null, undefined].map(isFinalStage)).toEqual([false, false, false, true, true, false, false]);
  });

  it('warns that a final status locks the request, naming the request and the status', () => {
    const text = finalStageConfirm('MR-26-014', 'مُسلَّم');
    expect(text).toContain('MR-26-014');
    expect(text).toContain('«مُسلَّم»');
    expect(text).toContain('سيُقفله نهائياً');
  });

  it('cuts saved dates to datetime-local minutes and gives the current local minute', () => {
    expect(toLocalInput('2026-11-25T08:30:59.123')).toBe('2026-11-25T08:30');
    expect(toLocalInput(null)).toBe('');
    expect(toLocalInput(undefined)).toBe('');

    vi.useFakeTimers();
    try {
      const at = new Date(2026, 10, 25, 9, 7, 45);   // وقت محلي
      vi.setSystemTime(at);
      expect(nowLocalInput()).toBe('2026-11-25T09:07');
    } finally { vi.useRealTimers(); }
  });

  it('formats durations in minutes, hours, or days and hours', () => {
    expect(formatHours(null)).toBe('—');
    expect(formatHours(0)).toBe('1 دقيقة');              // لا «0 دقيقة»
    expect(formatHours(0.25)).toBe('15 دقيقة');
    expect(formatHours(3.46)).toBe('3.5 ساعة');
    expect(formatHours(24)).toBe('1 يوم');
    expect(formatHours(53)).toBe('2 يوم و5 ساعة');
  });

  it('accepts quantities with at most two decimals, despite floating point', () => {
    expect(twoDecimals(0.1)).toBe(true);
    expect(twoDecimals(1.15)).toBe(true);
    expect(twoDecimals(2.345)).toBe(false);
    expect(twoDecimals(10)).toBe(true);
  });
});
