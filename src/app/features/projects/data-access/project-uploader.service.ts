import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Subject, firstValueFrom, takeUntil } from 'rxjs';
import { environment } from '@env/environment';
import { ApiError } from '@core/http/api-error';
import { ToastService } from '@shared/ui/toast.service';
import { StartUploadInput, UPLOAD_DONE, UPLOAD_FAILED, UPLOAD_RECEIVING, UploadSession } from './projects.models';
import { ProjectsService } from './projects.service';
import { MAX_CHUNK_ATTEMPTS, SpeedMeter, backoffMs, etaSeconds, isRetryable, nextChunk, sameFile } from '../utils/upload-plan';

export type JobPhase = 'queued' | 'starting' | 'sending' | 'paused' | 'processing' | 'done' | 'failed';

/** رفع ملف واحد: حالته وتقدّمه إشارات تقرؤها الواجهة (الخدمة عامة فلا يتوقف الرفع بتغيير الصفحة) */
export class UploadJob {
  readonly phase = signal<JobPhase>('starting');
  readonly sent = signal(0);
  readonly error = signal('');
  readonly speed = signal(0);
  readonly versionId = signal<number | null>(null);
  session: UploadSession | null = null;
  readonly meter = new SpeedMeter();
  /** إيقاف مؤقت أو إلغاء مطلوب: الحلقة تتوقف عند أول فرصة */
  stopRequested = false;
  cancelled = false;
  readonly abort$ = new Subject<void>();

  constructor(readonly id: number, readonly file: File, readonly input: StartUploadInput) {}

  readonly progress = computed(() => (this.input.size > 0 ? Math.min(1, this.sent() / this.input.size) : 0));
  readonly eta = computed(() => etaSeconds(this.input.size - this.sent(), this.speed()));
  /** يمكن الاستئناف: الجلسة ما زالت تستقبل أجزاء (إيقاف مؤقت أو انقطاع) */
  readonly canResume = computed(() => this.phase() === 'paused');
  readonly isActive = computed(() => this.phase() === 'starting' || this.phase() === 'sending');
  readonly isFinished = computed(() => this.phase() === 'done' || this.phase() === 'failed');
}

/** عمليات رفع مفتوحة لكل مستخدم في الخادم (ProjectUploadRules.MaxOpenPerUser): الزائد ينتظر في الطابور هنا */
const MAX_OPEN = 3;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * رفع وثائق المشاريع بأجزاء قابلة للاستئناف (ملفات حتى عشرات الجيجابايتات): بدء الجلسة، ثم أجزاء متتالية كل منها طلب مستقل
 * (≤ حجم الجزء الذي يحدده الخادم)، ثم «اكتمل» فيفحص الخادم الملف ويحفظه في الخلفية ونستعلم عن النتيجة.
 * انقطاع الشبكة يُعاد فيه الجزء بعد مزامنة ما استلمه الخادم فعلاً، فلا يتكرر شيء ولا يفوت شيء.
 */
@Injectable({ providedIn: 'root' })
export class ProjectUploader {
  private api = inject(ProjectsService);
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private seq = 0;

  readonly jobs = signal<UploadJob[]>([]);
  /** عدّاد يرتفع عند نجاح أي رفع: الصفحات تعيد قراءة وثائقها */
  readonly completed = signal(0);
  readonly lastCompletedProjectId = signal<number | null>(null);
  /** رفع يرسل أجزاءً الآن: يُحذَّر المستخدم قبل إغلاق التبويب */
  readonly active = computed(() => this.jobs().some(j => j.isActive()));

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', event => { if (this.active()) event.preventDefault(); });
    }
  }

  forProject(projectId: number | null) {
    return this.jobs().filter(j => projectId == null || j.input.projectId === projectId);
  }

  /** رفع جديد: يبدأ فوراً */
  add(file: File, input: StartUploadInput): UploadJob {
    const job = new UploadJob(++this.seq, file, { ...input, fileName: file.name, size: file.size });
    job.phase.set('queued');
    this.jobs.update(list => [...list, job]);
    this.pump();
    return job;
  }

  /** استئناف جلسة محفوظة في الخادم (بعد تحديث الصفحة): يُشترط اختيار الملف نفسه (الاسم والحجم) */
  resumeSession(file: File, session: UploadSession): UploadJob | string {
    if (!sameFile(file, session)) return `اختر الملف نفسه: «${session.fileName}» (${session.size} بايت)`;
    if (session.status !== UPLOAD_RECEIVING) return 'هذا الرفع لم يعد يستقبل أجزاء';
    const job = new UploadJob(++this.seq, file, {
      projectId: session.projectId, documentId: session.documentId, title: session.title, kind: session.kind,
      fileName: session.fileName, size: session.size, source: '', note: ''
    });
    job.session = session;
    this.jobs.update(list => [...list, job]);
    void this.run(job);
    return job;
  }

  pause(job: UploadJob) {
    if (!job.isActive()) return;
    job.stopRequested = true;
    job.abort$.next();
    job.phase.set('paused');
    job.speed.set(0);
  }

  resume(job: UploadJob) {
    if (!job.canResume()) return;
    job.error.set('');
    void this.run(job);
  }

  /** إلغاء: يمسح الجلسة من الخادم (إلا أثناء الفحص) ويزيلها من القائمة */
  async cancel(job: UploadJob) {
    job.stopRequested = true;
    job.cancelled = true;
    job.abort$.next();
    this.dismiss(job);
    if (job.session && job.phase() !== 'processing' && !job.isFinished()) {
      try { await firstValueFrom(this.api.cancelUpload(job.session.id)); } catch { /* تُمسح المهجورة تلقائياً بعد 48 ساعة */ }
    }
  }

  dismiss(job: UploadJob) {
    this.jobs.update(list => list.filter(j => j !== job));
    this.pump();
  }

  /** يبدأ ما في الطابور بقدر ما يتسع الخادم (3 جلسات مفتوحة، ومنها الموقوفة مؤقتاً) */
  private pump() {
    const holding: JobPhase[] = ['starting', 'sending', 'paused', 'processing'];
    let free = MAX_OPEN - this.jobs().filter(j => holding.includes(j.phase())).length;
    for (const job of this.jobs()) {
      if (free <= 0) break;
      if (job.phase() === 'queued') { free--; void this.run(job); }
    }
  }

  // ───────────────────────── التنفيذ ─────────────────────────

  private async run(job: UploadJob) {
    job.stopRequested = false;
    try {
      if (!job.session) {
        job.phase.set('starting');
        job.session = await firstValueFrom(this.api.startUpload(job.input));
      }
      job.sent.set(job.session.received);
      job.meter.reset();
      job.meter.add(Date.now(), job.sent());
      await this.sendAll(job);
      if (job.stopRequested) return;
      await this.finish(job);
    } catch (e) {
      if (job.stopRequested) return;
      this.fail(job, e);
    }
  }

  private async sendAll(job: UploadJob) {
    let stalls = 0;
    while (!job.stopRequested) {
      const session = job.session!;
      const plan = nextChunk(job.sent(), session.size, session.chunkSize);
      if (!plan) return;
      job.phase.set('sending');
      const before = job.sent();
      try {
        const updated = await this.putChunk(job, plan);
        job.session = updated;
        job.sent.set(updated.received);
        job.meter.add(Date.now(), updated.received);
        job.speed.set(job.meter.bytesPerSecond());
        stalls = 0;
      } catch (e) {
        if (job.stopRequested) return;
        const status = (e as ApiError).status;
        // 400 = خارج الترتيب أو لم يعد يقبل أجزاء: نزامن مع الخادم ونعيد التخطيط
        if (!isRetryable(status) && status !== 400) throw e;
        if (++stalls >= MAX_CHUNK_ATTEMPTS) throw e;
        if (isRetryable(status)) await sleep(backoffMs(stalls));
        if (job.stopRequested) return;
        const synced = await this.syncWithServer(job);
        if (synced.status !== UPLOAD_RECEIVING) throw e;
        if (synced.received !== before) stalls = 0;
      }
    }
  }

  /** ما استلمه الخادم فعلاً (بعد انقطاع) */
  private async syncWithServer(job: UploadJob): Promise<UploadSession> {
    const s = await firstValueFrom(this.api.upload(job.session!.id));
    job.session = s;
    job.sent.set(s.received);
    job.meter.reset();
    job.meter.add(Date.now(), s.received);
    return s;
  }

  private putChunk(job: UploadJob, plan: { offset: number; length: number }): Promise<UploadSession> {
    const blob = job.file.slice(plan.offset, plan.offset + plan.length);
    return new Promise<UploadSession>((resolve, reject) => {
      this.http.put<UploadSession>(`${environment.apiUrl}/ProjectUploads/${job.session!.id}/Chunk`, blob, {
        params: { offset: String(plan.offset) },
        headers: { 'Content-Type': 'application/octet-stream' },
        reportProgress: true, observe: 'events'
      }).pipe(takeUntil(job.abort$)).subscribe({
        next: event => {
          if (event.type === HttpEventType.UploadProgress) {
            job.sent.set(Math.min(job.input.size, plan.offset + (event.loaded ?? 0)));
            job.meter.add(Date.now(), job.sent());
            job.speed.set(job.meter.bytesPerSecond());
          } else if (event.type === HttpEventType.Response && event.body) resolve(event.body);
        },
        error: reject,
        // أُلغي الطلب (إيقاف مؤقت): لا ردّ، فلا يبقى الوعد معلّقاً
        complete: () => reject({ status: -1, message: 'أُوقف الإرسال' } satisfies ApiError)
      });
    });
  }

  private async finish(job: UploadJob) {
    const sessionId = job.session!.id;
    job.session = await firstValueFrom(this.api.completeUpload(sessionId));
    job.phase.set('processing');
    job.speed.set(0);

    let failures = 0;
    for (;;) {
      await sleep(2000);
      if (job.cancelled) return;
      try {
        const s: UploadSession = await firstValueFrom(this.api.upload(sessionId));
        job.session = s;
        if (s.status === UPLOAD_DONE) { this.done(job, s); return; }
        if (s.status === UPLOAD_FAILED) { job.error.set(s.error || 'تعذّر حفظ الملف'); job.phase.set('failed'); this.pump(); return; }
        failures = 0;
      } catch (e) {
        // انقطاع أثناء الاستعلام لا يعني فشل الحفظ: نعيد المحاولة، ونتوقف بعد أخطاء متتالية كثيرة
        if (!isRetryable((e as ApiError).status) || ++failures >= 30) throw e;
      }
    }
  }

  private done(job: UploadJob, s: UploadSession) {
    job.versionId.set(s.versionId);
    job.sent.set(job.input.size);
    job.phase.set('done');
    this.lastCompletedProjectId.set(job.input.projectId);
    this.completed.update(n => n + 1);
    this.toast.success(`اكتمل رفع «${job.input.title || job.input.fileName}»`);
    this.pump();
  }

  private fail(job: UploadJob, e: unknown) {
    const error = e as Partial<ApiError>;
    const message = error.message ?? 'تعذّر رفع الملف';
    job.speed.set(0);
    // انقطاع شبكة أو انتهاء جلسة الدخول: الجلسة محفوظة في الخادم، فيُترك الاستئناف متاحاً
    if (job.session && (isRetryable(error.status) || error.status === 401)) {
      job.error.set(error.status === 401 ? 'انتهت جلسة الدخول — سجّل الدخول من جديد ثم استأنف الرفع' : `${message} — اضغط استئناف حين تعود الشبكة`);
      job.phase.set('paused');
      return;
    }
    job.error.set(message);
    job.phase.set('failed');
    this.pump();
  }
}
