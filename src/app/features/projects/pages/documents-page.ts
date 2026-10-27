import { Component } from '@angular/core';
import { PageHeader } from '@shared/ui/page-header';
import { ProjectDocumentsPanel } from '../components/project-documents-panel';

/** بحث في وثائق كل المشاريع التي أراها (بالعنوان أو اسم الملف أو المشروع أو النوع أو تاريخ الرفع)؛ الرفع من صفحة المشروع نفسه */
@Component({
  selector: 'app-project-documents-page', standalone: true,
  imports: [PageHeader, ProjectDocumentsPanel],
  styleUrl: '../../../shared/styles/page-base.scss',
  template: `
    <div class="page">
      <app-page-header eyebrow="المشاريع" heading="وثائق المشاريع"
                       subtitle="كل وثائق المشاريع التي تراها بإصداراتها وحالة اعتمادها — لرفع وثيقة افتح المشروع من قائمة المشاريع" />
      <app-project-documents-panel [projectId]="null" />
    </div>`
})
export class ProjectDocumentsPage {}
