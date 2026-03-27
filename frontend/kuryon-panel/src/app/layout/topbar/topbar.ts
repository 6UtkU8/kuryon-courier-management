import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Director } from '../../core/models/director.model';
import { DirectorPermissionService } from '../../core/services/director-permission.service';
import {
  OverlaySelectComponent,
  OverlaySelectOption
} from '../../shared/overlay-select/overlay-select.component';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/user-session.model';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, OverlaySelectComponent],
  templateUrl: './topbar.html',
  styleUrls: ['./topbar.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopbarComponent implements OnInit, OnDestroy {
  @Output() toggleSidebar = new EventEmitter<void>();
  directors: Director[] = [];
  activeDirectors: Director[] = [];
  currentDirectorId = '';
  isMobileAccessEnabled = false;
  selectedDirectorLabel = 'Aktif direktör yok';
  directorSelectOptions: OverlaySelectOption[] = [];
  userName = '';
  userRole: UserRole | null = null;
  private subscription = new Subscription();

  constructor(
    private readonly directorPermissions: DirectorPermissionService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.directorPermissions.directors$.subscribe((directors) => {
        this.directors = directors;
        this.activeDirectors = directors.filter((director) => director.employmentStatus === 'Aktif');
        this.directorSelectOptions = this.activeDirectors.map((director) => ({
          label: director.fullName,
          value: director.id
        }));
        this.ensureValidCurrentDirector();
        this.refreshSelectedDirectorLabel();
      })
    );
    this.subscription.add(
      this.directorPermissions.currentDirector$.subscribe((director) => {
        this.currentDirectorId = director?.id ?? '';
        this.isMobileAccessEnabled = this.directorPermissions.can('mobile_access');
        this.ensureValidCurrentDirector();
        this.refreshSelectedDirectorLabel();
      })
    );

    this.subscription.add(
      this.authService.session$.subscribe((session) => {
        this.userName = this.authService.getUserName() ?? '';
        this.userRole = this.authService.getRole();
        if (!session) {
          this.userName = '';
          this.userRole = null;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  onDirectorChange(id: string): void {
    this.directorPermissions.setCurrentDirector(id);
  }

  async onLogout(): Promise<void> {
    await this.authService.logout();
    void this.router.navigateByUrl('/login-select');
  }

  trackByDirectorId(_: number, director: Director): string {
    return director.id;
  }

  getDirectorOptionLabel(director: Director): string {
    return director.fullName;
  }

  private refreshSelectedDirectorLabel(): void {
    const selected = this.activeDirectors.find((director) => director.id === this.currentDirectorId);
    this.selectedDirectorLabel = selected ? selected.fullName : 'Aktif direktör yok';
  }

  private ensureValidCurrentDirector(): void {
    if (!this.activeDirectors.length) {
      this.currentDirectorId = '';
      return;
    }
    const existsInActive = this.activeDirectors.some(
      (director) => director.id === this.currentDirectorId
    );
    if (!existsInActive) {
      this.onDirectorChange(this.activeDirectors[0].id);
    }
  }
}