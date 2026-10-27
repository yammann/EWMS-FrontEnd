import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { ProjectUploader } from './project-uploader.service';
import { StartUploadInput, UploadSession } from './projects.models';

/** رفع الأجزاء: تسلسل الأجزاء، الإنهاء والاستعلام، إعادة المحاولة بعد انقطاع، والإيقاف المؤقت والاستئناف */
describe('Project chunked uploader', () => {
  let uploader: ProjectUploader;
  let http: HttpTestingController;

  const session = (over: Partial<UploadSession> = {}): UploadSession => ({
    id: 'abc', projectId: 5, documentId: null, title: 'مخطط', kind: 4, fileName: 'plan.pdf', size: 25, received: 0, chunkSize: 10,
    status: 1, statusName: 'جارٍ الرفع', error: '', versionId: null, createdAt: '', updatedAt: '', ...over
  });
  const input: StartUploadInput = { projectId: 5, documentId: null, title: 'مخطط', kind: 4, fileName: '', size: 0, source: '', note: '' };
  const file = () => new File([new Uint8Array(25)], 'plan.pdf', { type: 'application/pdf' });

  /** يترك الوعود المعلّقة تتقدّم (كل await داخل الخدمة يحتاج دورة ميكرو) */
  const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  const chunk = (offset: number): TestRequest =>
    http.expectOne(r => r.url.endsWith('/ProjectUploads/abc/Chunk') && r.params.get('offset') === String(offset));

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    uploader = TestBed.inject(ProjectUploader);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { vi.useRealTimers(); });

  it('starts a session, sends the file chunk by chunk, completes and waits for the server to finish', async () => {
    const job = uploader.add(file(), input);
    http.expectOne('/api/ProjectUploads/Start').flush(session());
    await settle();

    for (const [offset, length] of [[0, 10], [10, 10], [20, 5]]) {
      const req = chunk(offset);
      expect(req.request.method).toBe('PUT');
      expect((req.request.body as Blob).size).toBe(length);
      expect(req.request.headers.get('Content-Type')).toBe('application/octet-stream');
      req.flush(session({ received: offset + length }));
      await settle();
    }

    http.expectOne('/api/ProjectUploads/abc/Complete').flush(session({ received: 25, status: 2 }));
    await settle();
    expect(job.phase()).toBe('processing');

    await vi.advanceTimersByTimeAsync(2000);
    http.expectOne('/api/ProjectUploads/abc').flush(session({ received: 25, status: 3, versionId: 77 }));
    await settle();

    expect(job.phase()).toBe('done');
    expect(job.versionId()).toBe(77);
    expect(uploader.completed()).toBe(1);
    expect(uploader.lastCompletedProjectId()).toBe(5);
  });

  it('reports a failed finalization with the server message', async () => {
    const job = uploader.add(file(), input);
    http.expectOne('/api/ProjectUploads/Start').flush(session({ size: 5 }));
    await settle();
    chunk(0).flush(session({ size: 5, received: 5 }));
    await settle();
    http.expectOne('/api/ProjectUploads/abc/Complete').flush(session({ size: 5, received: 5, status: 2 }));
    await settle();
    await vi.advanceTimersByTimeAsync(2000);
    http.expectOne('/api/ProjectUploads/abc').flush(session({ size: 5, received: 5, status: 4, error: 'نوع الملف ممنوع' }));
    await settle();

    expect(job.phase()).toBe('failed');
    expect(job.error()).toBe('نوع الملف ممنوع');
  });

  it('after a network failure it syncs with the server and resends from what the server really has', async () => {
    const job = uploader.add(file(), input);
    http.expectOne('/api/ProjectUploads/Start').flush(session());
    await settle();
    chunk(0).flush(session({ received: 10 }));
    await settle();

    chunk(10).error(new ProgressEvent('error'), { status: 0 });   // انقطع الاتصال أثناء الجزء الثاني
    await settle();
    await vi.advanceTimersByTimeAsync(1000);                       // انتظار المحاولة الأولى
    http.expectOne('/api/ProjectUploads/abc').flush(session({ received: 10 }));
    await settle();

    expect(job.sent()).toBe(10);
    chunk(10).flush(session({ received: 20 }));                    // الجزء نفسه يُعاد من الموضع الصحيح
    await settle();
    expect(chunk(20).request.method).toBe('PUT');
    job.stopRequested = true;                                      // يكفي هذا للاختبار
  });

  it('gives up with a resumable pause when the network stays down', async () => {
    const job = uploader.add(file(), input);
    http.expectOne('/api/ProjectUploads/Start').flush(session({ size: 5 }));
    await settle();

    for (let attempt = 1; attempt <= 6; attempt++) {
      chunk(0).error(new ProgressEvent('error'), { status: 0 });
      await settle();
      if (attempt === 6) break;
      await vi.advanceTimersByTimeAsync(15_000);
      http.expectOne('/api/ProjectUploads/abc').flush(session({ size: 5, received: 0 }));
      await settle();
    }

    expect(job.phase()).toBe('paused');
    expect(job.canResume()).toBe(true);
    expect(job.error()).toContain('استئناف');
  });

  it('pauses by aborting the chunk in flight and resumes from the server position', async () => {
    const job = uploader.add(file(), input);
    http.expectOne('/api/ProjectUploads/Start').flush(session());
    await settle();
    chunk(0).flush(session({ received: 10 }));
    await settle();

    const inFlight = chunk(10);
    uploader.pause(job);
    await settle();
    expect(inFlight.cancelled).toBe(true);
    expect(job.phase()).toBe('paused');

    uploader.resume(job);
    await settle();
    expect(chunk(10).request.method).toBe('PUT');    // يستأنف من الجزء الذي لم يصل
    uploader.pause(job);
  });

  it('resumes a saved session only with the same file', () => {
    const wrong = new File([new Uint8Array(30)], 'plan.pdf');
    expect(uploader.resumeSession(wrong, session())).toEqual(expect.any(String));
    expect(uploader.resumeSession(file(), session({ status: 4 }))).toEqual(expect.any(String));

    const ok = uploader.resumeSession(file(), session({ received: 10 }));
    expect(typeof ok).toBe('object');
    http.expectOne(r => r.url.endsWith('/ProjectUploads/abc/Chunk') && r.params.get('offset') === '10');
    if (typeof ok === 'object') uploader.pause(ok);
  });

  it('queues uploads beyond the three open sessions the server allows and starts them as slots free up', async () => {
    const jobs = [1, 2, 3, 4].map(() => uploader.add(file(), input));
    expect(jobs.map(j => j.phase())).toEqual(['starting', 'starting', 'starting', 'queued']);
    const starts = http.match('/api/ProjectUploads/Start');
    expect(starts).toHaveLength(3);

    void uploader.cancel(jobs[0]);                       // يخلو مكان: يبدأ الرابع
    await settle();
    expect(jobs[3].phase()).toBe('starting');
    http.match(r => r.method === 'DELETE' || r.url.endsWith('/Start')).forEach(r => r.flush(session()));
    await settle();
    jobs.forEach(j => { j.stopRequested = true; j.abort$.next(); });
  });

  it('warns before closing the tab only while chunks are being sent', async () => {
    expect(uploader.active()).toBe(false);
    const job = uploader.add(file(), input);
    expect(uploader.active()).toBe(true);
    http.expectOne('/api/ProjectUploads/Start').flush(session());
    await settle();
    uploader.pause(job);
    expect(uploader.active()).toBe(false);
  });

  it('cancelling removes the job and deletes the server session', async () => {
    const job = uploader.add(file(), input);
    http.expectOne('/api/ProjectUploads/Start').flush(session());
    await settle();
    void uploader.cancel(job);
    await settle();
    http.expectOne(r => r.method === 'DELETE' && r.url.endsWith('/ProjectUploads/abc')).flush(null);
    expect(uploader.jobs()).toHaveLength(0);
  });
});
