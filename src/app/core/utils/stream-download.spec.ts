import { MAX_IN_MEMORY_BYTES, streamDownload } from './stream-download';

/** رد fetch بجسم من أجزاء، بحجم معلن اختيارياً */
function reply(chunks: string[], init: ResponseInit = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) { chunks.forEach(c => controller.enqueue(encoder.encode(c))); controller.close(); }
  });
  return new Response(body, { status: 200, ...init });
}

describe('streamDownload', () => {
  const win = window as unknown as { showSaveFilePicker?: unknown };
  afterEach(() => { vi.restoreAllMocks(); delete win.showSaveFilePicker; });

  it('streams straight to the chosen file and reports progress, sending the bearer token', async () => {
    const written: string[] = [];
    const closed = vi.fn();
    const decoder = new TextDecoder();
    win.showSaveFilePicker = vi.fn(async () => ({
      createWritable: async () => new WritableStream<Uint8Array>({ write(chunk) { written.push(decoder.decode(chunk)); }, close: closed })
    }));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(['ab', 'cd'], { headers: { 'Content-Length': '4' } }));
    const progress: Array<[number, number | null]> = [];

    const result = await streamDownload('/api/StudyAttachments/Get/9?download=true', {
      fileName: 'plan.dwg', token: 'T0K', onProgress: (r, t) => progress.push([r, t])
    });

    expect(result).toBe('saved');
    expect(written.join('')).toBe('abcd');
    expect(closed).toHaveBeenCalled();
    expect(progress.at(-1)).toEqual([4, 4]);
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer T0K' });
  });

  it('returns cancelled without fetching when the save dialog is dismissed', async () => {
    win.showSaveFilePicker = vi.fn(async () => { throw new DOMException('closed', 'AbortError'); });
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    expect(await streamDownload('/x', { fileName: 'a.pdf', token: null })).toBe('cancelled');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the server Arabic message on a failed response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'المرفق غير موجود' }), { status: 404 }));
    await expect(streamDownload('/x', { fileName: 'a.pdf', token: null })).rejects.toThrow('المرفق غير موجود');
  });

  it('falls back to status text when the error body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 403 }));
    await expect(streamDownload('/x', { fileName: 'a.pdf', token: null })).rejects.toThrow('ليس لديك صلاحية');
  });

  it('refuses a huge file when the browser cannot write to disk directly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(['x'], { headers: { 'Content-Length': String(MAX_IN_MEMORY_BYTES + 1) } }));
    await expect(streamDownload('/x', { fileName: 'big.zip', token: null })).rejects.toThrow('Chrome أو Edge');
  });
});
