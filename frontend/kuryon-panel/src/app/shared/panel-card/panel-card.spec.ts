import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PanelCardComponent } from './panel-card';

describe('PanelCardComponent', () => {
  let component: PanelCardComponent;
  let fixture: ComponentFixture<PanelCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PanelCardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PanelCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});