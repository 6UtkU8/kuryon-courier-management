import { CommonModule } from '@angular/common';
import { OverlayModule, ConnectedPosition } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';

export type OverlaySelectOption = {
  label: string;
  value: string;
};

@Component({
  selector: 'app-overlay-select',
  standalone: true,
  imports: [CommonModule, OverlayModule],
  templateUrl: './overlay-select.component.html',
  styleUrls: ['./overlay-select.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverlaySelectComponent implements OnChanges {
  @Input() options: OverlaySelectOption[] = [];
  @Input() value: string | null = null;
  @Input() disabled = false;
  @Input() ariaLabel = 'Secim';
  @Input() panelMaxHeight = 260;

  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('triggerBtn', { static: true }) triggerButtonRef!: ElementRef<HTMLButtonElement>;
  @ViewChild('optionsList') optionsListRef?: ElementRef<HTMLUListElement>;

  isOpen = false;
  focusedIndex = -1;
  overlayWidth = 0;

  readonly overlayPositions: ConnectedPosition[] = [
    {
      originX: 'start',
      originY: 'bottom',
      overlayX: 'start',
      overlayY: 'top',
      offsetY: 6
    },
    {
      originX: 'start',
      originY: 'top',
      overlayX: 'start',
      overlayY: 'bottom',
      offsetY: -6
    }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && this.isOpen) {
      this.focusedIndex = this.getSelectedIndex();
    }
  }

  get selectedLabel(): string {
    const selected = this.options.find((option) => option.value === this.value);
    return selected?.label ?? 'Seciniz';
  }

  isSelected(index: number): boolean {
    return this.options[index]?.value === this.value;
  }

  toggle(): void {
    if (this.disabled) {
      return;
    }
    if (this.isOpen) {
      this.close();
      return;
    }
    this.open();
  }

  open(): void {
    if (this.disabled || this.isOpen) {
      return;
    }
    this.overlayWidth = this.triggerButtonRef.nativeElement.getBoundingClientRect().width;
    this.focusedIndex = this.getSelectedIndex();
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
    this.focusedIndex = -1;
  }

  onOverlayAttach(): void {
    setTimeout(() => {
      if (!this.isOpen || !this.optionsListRef) {
        return;
      }
      const target = this.optionsListRef.nativeElement.querySelector<HTMLButtonElement>(
        '.overlay-select-option-btn.is-focused, .overlay-select-option-btn.is-selected'
      );
      target?.focus();
      target?.scrollIntoView({ block: 'nearest' });
    });
  }

  selectOption(option: OverlaySelectOption): void {
    this.valueChange.emit(option.value);
    this.close();
    this.triggerButtonRef.nativeElement.focus();
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.open();
      this.focusedIndex = this.getNextIndex(this.focusedIndex, 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.open();
      this.focusedIndex = this.getNextIndex(this.focusedIndex, -1);
      return;
    }
    if (event.key === 'Escape') {
      this.close();
    }
  }

  onOptionKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusedIndex = this.getNextIndex(index, 1);
      this.focusFocusedButton();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusedIndex = this.getNextIndex(index, -1);
      this.focusFocusedButton();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = this.options[index];
      if (option) {
        this.selectOption(option);
      }
      return;
    }
    if (event.key === 'Escape' || event.key === 'Tab') {
      this.close();
      this.triggerButtonRef.nativeElement.focus();
    }
  }

  trackByValue(_: number, option: OverlaySelectOption): string {
    return option.value;
  }

  private getSelectedIndex(): number {
    const selectedIndex = this.options.findIndex((option) => option.value === this.value);
    return selectedIndex >= 0 ? selectedIndex : 0;
  }

  private getNextIndex(from: number, step: 1 | -1): number {
    if (!this.options.length) {
      return -1;
    }
    const safeFrom = from < 0 ? 0 : from;
    return (safeFrom + step + this.options.length) % this.options.length;
  }

  private focusFocusedButton(): void {
    if (!this.optionsListRef || this.focusedIndex < 0) {
      return;
    }
    const next = this.optionsListRef.nativeElement.querySelector<HTMLButtonElement>(
      `[data-option-index="${this.focusedIndex}"]`
    );
    next?.focus();
    next?.scrollIntoView({ block: 'nearest' });
  }
}
