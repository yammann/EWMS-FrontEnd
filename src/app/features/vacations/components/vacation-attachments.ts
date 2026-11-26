import { Component, inject, input, signal } from '@angular/core';
import { VacationService } from '../data-access/vacation.service';
import { VacationAttachment } from '../data-access/vacation.models';
import { fileSize } from '@core/utils/file-size';
import { FilePreview } from '@shared/ui/file-preview';
import { Icon } from '@shared/ui/icon';

/**
 * مرفقات طلب إجازة: قائمة، ومعاينة داخل نافذة (صورة أو PDF — الصيغتان الوحيدتان المقبولتان)، وتنزيل.
 * المعاينة والتنزيل في `app-file-preview`.
 */
@Component({
  selector: 'app-vacation-attachments', imports: [Icon, FilePreview],
  templateUrl: './vacation-attachments.html',
  styleUrl: './vacation-attachments.scss'
})
export class VacationAttachments {
  private service = inject(VacationService);
  attachments = input<VacationAttachment[]>([]);

  current = signal<VacationAttachment | null>(null);
  size = fileSize;
  blob = (id: number) => this.service.attachmentBlob(id);
}
