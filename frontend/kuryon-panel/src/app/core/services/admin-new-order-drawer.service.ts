import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminNewOrderDrawerService {
  private readonly visibleSubject = new BehaviorSubject<boolean>(false);

  readonly visible$ = this.visibleSubject.asObservable();

  requestOpen(): void {
    this.visibleSubject.next(true);
  }

  requestClose(): void {
    this.visibleSubject.next(false);
  }
}
