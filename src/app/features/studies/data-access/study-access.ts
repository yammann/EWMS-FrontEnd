import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { AppPermission, AppPermissionName, MANAGE_STUDY_LOOKUPS, STUDY_SIGN } from '@core/constants/access';

/**
 * ما يفتحه دور المستخدم في فرع الدراسات (لإظهار الصفحات والأزرار العامة).
 * حدّ كل صلاحية (فرعي / قسمي / ترتيب التوقيع) يطبّقه الخادم، ويعيد أعلام Can… لكل سجل — هي ما يقرّر أزرار السجل.
 */
@Injectable({ providedIn: 'root' })
export class StudyAccess {
  private auth = inject(AuthService);

  readonly can = computed(() => {
    const has = (p: AppPermissionName) => this.auth.hasPermission(p);
    this.auth.currentUser(); // يعاد الحساب عند تبديل المستخدم
    return {
      viewLookups: has(AppPermission.ViewStudyLookups),
      createLookup: has(AppPermission.CreateStudyLookup),
      editLookup: has(AppPermission.EditStudyLookup),
      deleteLookup: has(AppPermission.DeleteStudyLookup),
      manageLookups: this.auth.hasAnyPermission(MANAGE_STUDY_LOOKUPS),

      viewRequests: has(AppPermission.ViewStudyRequests),
      createRequest: has(AppPermission.CreateStudyRequest),
      viewAssignments: has(AppPermission.ViewStudyAssignments),
      createAssignment: has(AppPermission.CreateStudyAssignment),
      viewResponses: has(AppPermission.ViewStudyResponses),
      createResponse: has(AppPermission.CreateStudyResponse),
      viewStartOrders: has(AppPermission.ViewStudyStartOrders),
      createStartOrder: has(AppPermission.CreateStudyStartOrder),
      cancelDocuments: has(AppPermission.CancelStudyDocuments),
      sign: this.auth.hasAnyPermission(STUDY_SIGN),

      viewProjects: has(AppPermission.ViewStudyProjects),
      createProject: has(AppPermission.CreateStudyProject),
      addProjectDepartment: has(AppPermission.AddStudyProjectDepartment),
      removeProjectDepartment: has(AppPermission.RemoveStudyProjectDepartment),
      createStage: has(AppPermission.CreateStudyStage),
      editStage: has(AppPermission.EditStudyStage),
      deleteStage: has(AppPermission.DeleteStudyStage),
      closeStage: has(AppPermission.CloseStudyStage),
      createTask: has(AppPermission.CreateStudyTask),
      editTask: has(AppPermission.EditStudyTask),
      deleteTask: has(AppPermission.DeleteStudyTask),
      updateTaskProgress: has(AppPermission.UpdateStudyTaskProgress),

      viewDrawings: has(AppPermission.ViewStudyDrawings),
      createDrawing: has(AppPermission.CreateStudyDrawing),
      deleteDrawing: has(AppPermission.DeleteStudyDrawing),
      createVersion: has(AppPermission.CreateArchitecturalVersion),
      editVersion: has(AppPermission.EditArchitecturalVersion),
      deleteVersion: has(AppPermission.DeleteArchitecturalVersion),
      createDesignApproval: has(AppPermission.CreateDesignApproval),
      deleteDesignApproval: has(AppPermission.DeleteDesignApproval),

      viewActivityLog: has(AppPermission.ViewStudyActivityLog)
    };
  });
}
