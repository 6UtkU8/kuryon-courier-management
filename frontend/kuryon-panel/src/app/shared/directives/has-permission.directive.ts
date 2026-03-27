import {
  Directive,
  Input,
  OnDestroy,
  TemplateRef,
  ViewContainerRef
} from '@angular/core';
import { Subscription } from 'rxjs';
import { DirectorPermissionKey } from '../../core/models/director-permission.model';
import { DirectorPermissionService } from '../../core/services/director-permission.service';

@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnDestroy {
  private permissions: DirectorPermissionKey[] = [];
  private mode: 'any' | 'every' = 'any';
  private isRendered = false;
  private readonly subscription: Subscription;

  @Input()
  set appHasPermission(value: DirectorPermissionKey | DirectorPermissionKey[]) {
    this.permissions = Array.isArray(value) ? value : [value];
    this.render();
  }

  @Input()
  set appHasPermissionMode(value: 'any' | 'every') {
    this.mode = value;
    this.render();
  }

  constructor(
    private readonly templateRef: TemplateRef<unknown>,
    private readonly viewContainer: ViewContainerRef,
    private readonly directorPermissions: DirectorPermissionService
  ) {
    this.subscription = this.directorPermissions.currentDirector$.subscribe(() => this.render());
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private render(): void {
    const canShow =
      this.permissions.length === 0
        ? true
        : this.mode === 'every'
          ? this.permissions.every((permission) => this.directorPermissions.can(permission))
          : this.permissions.some((permission) => this.directorPermissions.can(permission));

    if (canShow && !this.isRendered) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.isRendered = true;
      return;
    }

    if (!canShow && this.isRendered) {
      this.viewContainer.clear();
      this.isRendered = false;
    }
  }
}
