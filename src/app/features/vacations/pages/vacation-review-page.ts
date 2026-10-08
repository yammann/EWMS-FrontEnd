import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { VacationContextPanel } from '../components/vacation-context-panel';
import { VacationAttachments } from '../components/vacation-attachments';
import { daysAr } from '@core/utils/arabic-count';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { VacationService } from '../data-access/vacation.service';
import { Vacation } from '../data-access/vacation.models';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { trackRequest } from '@shared/ui/loader';

@Component({
  selector: 'app-vacation-review', standalone: true, imports: [PageHeader, EmptyState, Alert, CommonModule, ReactiveFormsModule, RouterLink, VacationContextPanel, VacationAttachments, Pager],
  styleUrl: '../../../shared/styles/organization.scss',
  templateUrl: './vacation-review-page.html'
})
export class VacationReviewPage {
  cards = new Pagination(() => this.items());
  pager = new Pagination(() => this.filteredTeam());
  private service = inject(VacationService);
  private auth = inject(AuthService);
  days = daysAr;
  canPrint = computed(() => this.auth.hasPermission(AppPermission.PrintVacation));
  items = signal<Vacation[]>([]);
  loading = signal(false); saving = signal(false);
  error = signal(''); success = signal('');
  selected = signal<Vacation | null>(null); approving = signal(true);
  form = inject(FormBuilder).nonNullable.group({ reason: ['', Validators.maxLength(500)] });
  tab = signal<'pending' | 'team'>('pending');
  team = signal<Vacation[]>([]); teamLoaded = false;
  teamLoading = signal(false); teamError = signal('');
  statusFilter = signal('');
  filteredTeam = computed(() => {
    const f = this.statusFilter();
    return f ? this.team().filter(v => v.status.startsWith(f)) : this.team();
  });
  constructor() { this.load(); }
  refresh() { this.load(); if (this.teamLoaded) this.loadTeam(); }
  showTeam() { this.tab.set('team'); if (!this.teamLoaded) this.loadTeam(); }
  loadTeam() {
    this.teamLoading.set(true); this.teamError.set('');
    this.service.all().subscribe({
      next: v => { this.team.set(v); this.teamLoaded = true; this.teamLoading.set(false); },
      error: e => { this.teamError.set(e.message); this.teamLoading.set(false); }
    });
  }
  load() {
    trackRequest(this.service.pending(), this.loading, this.error, v => { this.items.set(v); });
  }
  choose(v: Vacation, approve: boolean) { this.selected.set(v); this.approving.set(approve); this.form.reset(); this.error.set(''); this.success.set(''); }
  submit() {
    const v = this.selected();
    if (!v || this.saving() || this.form.invalid) return;
    trackRequest(this.service.approve(v.id, this.approving(), this.form.getRawValue().reason), this.saving, this.error, result => { this.selected.set(null); this.success.set(result.message); this.load(); if (this.teamLoaded) this.loadTeam(); });
  }
}
