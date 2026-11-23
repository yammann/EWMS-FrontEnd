import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, Subject } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ConfirmService } from '@shared/ui/confirm.service';
import { ToastService } from '@shared/ui/toast.service';
import { StudyAccess } from '../../data-access/study-access';
import { StudyDocumentsService } from '../../data-access/study-documents.service';
import { StudyProjectsService } from '../../data-access/study-projects.service';
import { StudyProject } from '../../data-access/studies.models';
import { StudyProjectPage } from './study-project-page';

const cancelled: StudyProject = {
  id: 7, code: 'ST-007', name: 'مشروع تجريبي', startOrderId: 1, startOrderNumber: 'PIO-1',
  branchId: 1, branchName: 'الدراسات', managerUserId: 2, managerName: 'مدير',
  plannedStartDate: '2026-01-01', plannedEndDate: '2026-12-01', actualStartDate: null, actualEndDate: null,
  status: 4, statusName: 'ملغى', progress: 0, createdByName: '', createdAt: '2026-01-01', updatedAt: null, rowVersion: '',
  canEdit: false, canDelete: true, canCancel: false, canReactivate: true, canViewFull: true, viewLevel: 1, viewLevelName: '',
  canRequestCompletion: false, chain: null, departments: [], stages: [], approvals: []
};

async function openProject() {
  const reactivation = new Subject<StudyProject>();
  const deletion = new Subject<{ message: string }>();
  const service = {
    get: vi.fn(() => of(cancelled)), projectTasks: () => of({ tasks: [], total: 0, truncated: false }),
    reactivate: vi.fn(() => reactivation), remove: vi.fn(() => deletion)
  };
  TestBed.configureTestingModule({ providers: [
    provideRouter([{ path: 'studies/projects/:id', component: StudyProjectPage }]),
    { provide: StudyProjectsService, useValue: service }, { provide: StudyAccess, useValue: { can: () => ({}) } },
    { provide: StudyDocumentsService, useValue: { responseNumberOf: () => of(null) } },
    { provide: AuthService, useValue: { hasPermission: () => false } }
  ] });
  const harness = await RouterTestingHarness.create();
  const page = await harness.navigateByUrl('/studies/projects/7', StudyProjectPage);
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const toasts = TestBed.inject(ToastService).toasts;
  const confirm = TestBed.inject(ConfirmService);
  const actionButton = (selector: string) => harness.routeNativeElement!.querySelector(selector)!.closest('button')!;
  return { harness, page, service, confirm, toasts, reactivation, deletion, navigate, actionButton };
}

describe('StudyProjectPage action feedback', () => {
  it.each(['reactivate', 'delete'] as const)('keeps %s idle when its confirmation is dismissed', async action => {
    const { page, service, confirm, toasts } = await openProject();
    const decision = action === 'reactivate' ? page.reactivateProject(cancelled) : page.remove();
    expect(confirm.current()?.action).toBe(action);
    expect(page.busy()).toBe(false);
    confirm.answer(false);
    await decision;
    expect(service.reactivate).not.toHaveBeenCalled();
    expect(service.remove).not.toHaveBeenCalled();
    expect(toasts()).toEqual([]);
  });

  it.each(['reactivate', 'delete'] as const)('clears only the pending %s state on server error and allows retry', async action => {
    const { page, confirm, toasts, harness, actionButton, reactivation, deletion } = await openProject();
    const decision = action === 'reactivate' ? page.reactivateProject(cancelled) : page.remove();
    confirm.answer(true);
    await decision;
    harness.detectChanges();
    const deleteButton = actionButton('app-delete-action-content');
    const reactivateButton = actionButton('app-action-icon[kind="reactivate"]');
    expect(deleteButton.getAttribute('aria-busy')).toBe(String(action === 'delete'));
    expect(reactivateButton.getAttribute('aria-busy')).toBe(String(action === 'reactivate'));
    expect(toasts()).toEqual([]);
    (action === 'delete' ? deletion : reactivation).error(new Error('تعذّر التنفيذ'));
    harness.detectChanges();
    expect(page.busy()).toBe(false);
    expect(reactivateButton.disabled || deleteButton.disabled).toBe(false);
    expect(page.actionError()).toBe('تعذّر التنفيذ');
    expect(toasts()).toEqual([]);
  });

  it('shows reactivation success and the updated status after the server response', async () => {
    const { page, service, confirm, toasts, reactivation } = await openProject();
    const active: StudyProject = { ...cancelled, status: 1, statusName: 'جارٍ', canReactivate: false };
    service.get.mockReturnValue(of(active));
    const decision = page.reactivateProject(cancelled);
    confirm.answer(true);
    await decision;
    expect(service.reactivate).toHaveBeenCalledWith(cancelled.id);
    reactivation.next(active);
    reactivation.complete();
    expect(page.project()?.canReactivate).toBe(false);
    expect(page.busy()).toBe(false);
    expect(toasts()).toMatchObject([{ type: 'success', action: 'reactivate' }]);
  });

  it('navigates and shows deletion success only after the server confirms it', async () => {
    const { page, service, confirm, deletion, toasts, navigate } = await openProject();
    const decision = page.remove();
    confirm.answer(true);
    await decision;
    expect(service.remove).toHaveBeenCalledWith(cancelled.id);
    expect(navigate).not.toHaveBeenCalled();
    expect(toasts()).toEqual([]);
    deletion.next({ message: 'حُذف المشروع' });
    deletion.complete();
    expect(page.busy()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/studies/projects']);
    expect(toasts()).toMatchObject([{ type: 'success', action: 'delete' }]);
  });
});
