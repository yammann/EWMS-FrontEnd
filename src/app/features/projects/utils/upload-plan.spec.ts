import { SpeedMeter, backoffMs, bigFileSize, chunksLeft, etaSeconds, formatEta, isRetryable, nextChunk, sameFile, titleFromFileName } from './upload-plan';

describe('Chunked upload planning', () => {
  const MB = 1024 * 1024;

  it('plans the chunk right after what the server has, and never past the file', () => {
    expect(nextChunk(0, 40 * MB, 16 * MB)).toEqual({ offset: 0, length: 16 * MB });
    expect(nextChunk(32 * MB, 40 * MB, 16 * MB)).toEqual({ offset: 32 * MB, length: 8 * MB });
    expect(nextChunk(40 * MB, 40 * MB, 16 * MB)).toBeNull();
    expect(nextChunk(0, 10, 16 * MB)).toEqual({ offset: 0, length: 10 });   // ملف أصغر من جزء: جزء واحد
  });

  it('refuses nonsense input', () => {
    expect(nextChunk(-1, 10, 5)).toBeNull();
    expect(nextChunk(0, 0, 5)).toBeNull();
    expect(nextChunk(0, 10, 0)).toBeNull();
  });

  it('covers a 10 GB file with whole chunks only', () => {
    const size = 10 * 1024 * MB, chunk = 16 * MB;
    expect(chunksLeft(0, size, chunk)).toBe(640);
    expect(chunksLeft(size - 1, size, chunk)).toBe(1);
    expect(chunksLeft(size, size, chunk)).toBe(0);
    let received = 0, count = 0;
    while (true) {
      const next = nextChunk(received, size, chunk);
      if (!next) break;
      received += next.length; count++;
    }
    expect(received).toBe(size);
    expect(count).toBe(640);
  });

  it('retries network failures and server errors, not client errors', () => {
    for (const status of [0, 408, 429, 500, 502, 503]) expect(isRetryable(status)).toBe(true);
    for (const status of [400, 401, 403, 404, 413]) expect(isRetryable(status)).toBe(false);
    expect(isRetryable(undefined)).toBe(false);
  });

  it('waits longer after each failed attempt up to 15 seconds', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 15000, 15000, 15000]);
  });

  it('resumes only the same file (name and size)', () => {
    const session = { fileName: 'Plan.DWG', size: 123 };
    expect(sameFile({ name: 'plan.dwg', size: 123 }, session)).toBe(true);
    expect(sameFile({ name: 'plan.dwg', size: 124 }, session)).toBe(false);
    expect(sameFile({ name: 'other.dwg', size: 123 }, session)).toBe(false);
  });

  it('suggests a title from the file name', () => {
    expect(titleFromFileName('مخطط_إنشائي_v2.dwg')).toBe('مخطط إنشائي v2');
    expect(titleFromFileName('archive')).toBe('archive');
    expect(titleFromFileName('.hidden')).toBe('.hidden');
  });

  it('measures speed over a short window and the remaining time', () => {
    const meter = new SpeedMeter(5000);
    expect(meter.bytesPerSecond()).toBe(0);
    meter.add(0, 0);
    meter.add(1000, 10 * MB);
    meter.add(2000, 20 * MB);
    expect(meter.bytesPerSecond()).toBe(10 * MB);
    expect(etaSeconds(100 * MB, 10 * MB)).toBe(10);
    expect(etaSeconds(100 * MB, 0)).toBeNull();
    meter.reset();
    expect(meter.bytesPerSecond()).toBe(0);
  });

  it('forgets samples older than the window', () => {
    const meter = new SpeedMeter(2000);
    meter.add(0, 0);
    meter.add(1000, 1000 * MB);   // دفقة قديمة سريعة
    meter.add(10_000, 1000 * MB + 1 * MB);
    meter.add(11_000, 1000 * MB + 2 * MB);
    expect(meter.bytesPerSecond()).toBeLessThan(2 * MB);
  });

  it('formats remaining time and big sizes', () => {
    expect(formatEta(null)).toBe('—');
    expect(formatEta(45)).toBe('45 ث');
    expect(formatEta(200)).toBe('3 د 20 ث');
    expect(formatEta(3600)).toBe('1 س');
    expect(formatEta(3720)).toBe('1 س 2 د');
    expect(bigFileSize(500)).toBe('1 KB');
    expect(bigFileSize(5 * MB)).toBe('5.0 MB');
    expect(bigFileSize(1.5 * 1024 * MB)).toBe('1.50 GB');
    expect(bigFileSize(12 * 1024 * MB)).toBe('12.0 GB');
  });
});
