import { Route, Routes } from '@angular/router';
import { permissionGuard } from '@core/guards/permission.guard';
import { AppPermission, MANAGE_STUDY_LOOKUPS, STUDY_DOCUMENTS_VIEW, STUDY_SIGN } from '@core/constants/access';
import { StudyDocumentKind } from './data-access/studies.models';
import { DOCUMENT_META } from './utils/document-meta';

/** صفحة مستند: صفحة واحدة للأنواع الأربعة، نوعها في data.kind وصلاحية عرضه في data.permission */
const documentRoute = (kind: StudyDocumentKind): Route => ({
  path: `${DOCUMENT_META[kind].segment}/:id`, canActivate: [permissionGuard],
  data: { kind, permission: DOCUMENT_META[kind].view, back: '/studies/documents' },
  loadComponent: () => import('./pages/study-document-page/study-document-page').then(m => m.StudyDocumentPage)
});

/** النماذج الورقية للدراسة — خارج الإطار العام (بلا سايدبار) */
export const STUDY_PRINT_PAGE_ROUTES: Routes = [
  {
    path: 'studies/print/project-gantt/:id', canActivate: [permissionGuard], data: { permission: AppPermission.ViewStudyProjects, back: '/studies/projects', noPreload: true },
    loadComponent: () => import('./pages/study-gantt-print-page/study-gantt-print-page').then(m => m.StudyGanttPrintPage)
  },
  {
    path: 'studies/print/:segment/:id', canActivate: [permissionGuard], data: { permission: AppPermission.PrintStudyDocuments, back: '/studies/documents', noPreload: true },
    loadComponent: () => import('./pages/study-print-page/study-print-page').then(m => m.StudyPrintPage)
  }
];

/**
 * فرع الدراسات المركزية: مستندات الدراسة (طلب ← تكليف ← رد ← أمر بدء) ثم المشروع بمراحله ومهامه ومخططاته.
 * حدّ كل صلاحية (فرعي، قسم المستند، ترتيب التواقيع) يطبّقه الباكاند.
 */
export const STUDIES_ROUTES: Routes = [
  {
    path: 'studies',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'documents' },
      {
        path: 'documents', canActivate: [permissionGuard], data: { anyPermission: STUDY_DOCUMENTS_VIEW },
        loadComponent: () => import('./pages/study-documents-page/study-documents-page').then(m => m.StudyDocumentsPage)
      },
      documentRoute('requests'),
      documentRoute('assignments'),
      documentRoute('responses'),
      documentRoute('startOrders'),
      {
        path: 'projects', canActivate: [permissionGuard], data: { permission: AppPermission.ViewStudyProjects },
        loadComponent: () => import('./pages/study-projects-page/study-projects-page').then(m => m.StudyProjectsPage)
      },
      {
        path: 'projects/:id', canActivate: [permissionGuard], data: { permission: AppPermission.ViewStudyProjects, back: '/studies/projects' },
        loadComponent: () => import('./pages/study-project-page/study-project-page').then(m => m.StudyProjectPage)
      },
      {
        path: 'drawings/:id', canActivate: [permissionGuard], data: { permission: AppPermission.ViewStudyDrawings, back: '/studies/projects' },
        loadComponent: () => import('./pages/study-drawing-page/study-drawing-page').then(m => m.StudyDrawingPage)
      },
      {
        path: 'design-approvals/:id', canActivate: [permissionGuard], data: { permission: AppPermission.ViewStudyDrawings, back: '/studies/projects' },
        loadComponent: () => import('./pages/study-design-approval-page/study-design-approval-page').then(m => m.StudyDesignApprovalPage)
      },
      {
        path: 'my-tasks', canActivate: [permissionGuard], data: { permission: AppPermission.UpdateStudyTaskProgress },
        loadComponent: () => import('./pages/study-my-tasks-page/study-my-tasks-page').then(m => m.StudyMyTasksPage)
      },
      {
        path: 'approvals', canActivate: [permissionGuard], data: { anyPermission: STUDY_SIGN },
        loadComponent: () => import('./pages/study-approvals-page/study-approvals-page').then(m => m.StudyApprovalsPage)
      },
      {
        path: 'settings', canActivate: [permissionGuard], data: { anyPermission: MANAGE_STUDY_LOOKUPS },
        loadComponent: () => import('./pages/study-settings-page/study-settings-page').then(m => m.StudySettingsPage)
      }
    ]
  }
];
