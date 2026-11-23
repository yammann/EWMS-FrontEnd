import { AppPermission } from '@core/constants/access';
import { AppNotification } from '@core/models/notification.models';
import { notificationRoute } from './notification.service';

const note = (relatedEntityType: string, relatedEntityId: number | null, type = 'StudyNextStepReady') =>
  ({ id: 1, type, relatedEntityType, relatedEntityId } as unknown as AppNotification);

describe('notificationRoute for studies', () => {
  it('opens the study document the notification points to', () => {
    expect(notificationRoute(note('StudyRequest', 20), false)).toBe('/studies/requests/20');
    expect(notificationRoute(note('StudyAssignment', 16), false)).toBe('/studies/assignments/16');
    expect(notificationRoute(note('StudyResponse', 13), false)).toBe('/studies/responses/13');
    expect(notificationRoute(note('StudyStartOrder', 9), false)).toBe('/studies/start-orders/9');
    expect(notificationRoute(note('StudyDesignApproval', 7), false)).toBe('/studies/design-approvals/7');
    expect(notificationRoute(note('StudyProject', 7), false)).toBe('/studies/projects/7');
  });

  it('opens my study tasks for a task notification, and falls back to the profile without an id', () => {
    expect(notificationRoute(note('StudyTask', 5, 'StudyTaskAssigned'), false)).toBe('/studies/my-tasks');
    expect(notificationRoute(note('StudyRequest', null), false)).toBe('/profile');
  });

  it('opens a reactivated project, task list or signature queue according to the recipient', () => {
    const reactivated = note('StudyProject', 7, 'StudyProjectReactivated');
    expect(notificationRoute(reactivated, false, p => p === AppPermission.ViewStudyProjects)).toBe('/studies/projects/7');
    expect(notificationRoute(reactivated, false, p => p === AppPermission.UpdateStudyTaskProgress)).toBe('/studies/my-tasks');
    expect(notificationRoute(reactivated, false, () => false)).toBe('/notifications');
    expect(notificationRoute(note('StudyProjectApproval', 7, 'StudyProjectReactivated'), false)).toBe('/studies/approvals');
  });
});
