import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { StreamDownloadResult, streamDownload } from '@core/utils/stream-download';
import { query } from '../utils/query';
import { StudyAttachment, StudyOwnerType } from './studies.models';

/**
 * مرفقات الدراسات (طلب، تكليف، رد، أمر بدء، مشروع، مخطط، نسخة معمارية).
 * الملفات تُخزَّن في مجلد الخادم بلا سقف للحجم، فالرفع بـ FormData فيه `file` فقط مع أحداث التقدّم
 * (المعرّفات في العنوان كي يفحص الخادم الصلاحية قبل استقبال أي بايت)، والتنزيل تدفقاً إلى القرص.
 * المعاينة (صور وPDF فقط) تجلب Blob عبر معترض رمز الدخول.
 */
@Injectable({ providedIn: 'root' })
export class StudyAttachmentsService {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  list(ownerType: StudyOwnerType, ownerId: number) {
    return this.api.get<StudyAttachment[]>('/StudyAttachments/ByOwner' + query({ ownerType, ownerId }));
  }

  /** ملف واحد لكل طلب — يُرجع أحداث HTTP لعرض شريط التقدّم؛ آخر حدث (Response) فيه المرفق المحفوظ */
  upload(ownerType: StudyOwnerType, ownerId: number, attachmentTypeId: number, file: File): Observable<HttpEvent<StudyAttachment>> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<StudyAttachment>(
      `${environment.apiUrl}/StudyAttachments/Upload` + query({ ownerType, ownerId, attachmentTypeId }), form,
      { reportProgress: true, observe: 'events' });
  }

  remove(id: number) { return this.api.delete<{ message: string }>(`/StudyAttachments/Delete/${id}`); }

  /** محتوى صورة أو PDF للمعاينة داخل نافذة */
  previewBlob(id: number) { return this.api.getBlob(`/StudyAttachments/Get/${id}`); }

  /** تنزيل ملف تدفقاً (يصلح لملف بحجم 1GB) */
  download(a: StudyAttachment, onProgress?: (received: number, total: number | null) => void, signal?: AbortSignal): Promise<StreamDownloadResult> {
    return streamDownload(`${environment.apiUrl}/StudyAttachments/Get/${a.id}?download=true`, {
      fileName: a.fileName, token: this.auth.getToken(), signal, onProgress
    });
  }
}
