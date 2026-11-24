import type { SiteDraft } from '../domain/adapt-site';
import type { ImportIssue } from '../domain/import-issue';
import type { EncodedPayload } from '../domain/payload';
import type { ArchitectureId, DetectionResult } from '../domain/types';

export type PopupState =
  | { kind: 'idle' }
  | { kind: 'loading'; reason: 'collectingSite' | 'requestingPermission' }
  | { kind: 'permission'; origin: string }
  | { kind: 'unsupported'; detection: DetectionResult }
  | { kind: 'error'; issue: ImportIssue }
  | { kind: 'ready'; draft: SiteDraft; errors: Record<string, ImportIssue>; revealed: Set<string>; sourceOrigin?: string; addingPage?: boolean; pageActionError?: ImportIssue; dirty?: boolean }
  | { kind: 'qr'; draft: SiteDraft; payload: EncodedPayload; sourceOrigin?: string; error?: ImportIssue; openingFullscreen?: boolean; dirty?: boolean };

export interface PopupActions {
  onRead(): void;
  onRefresh(): void;
  onRequestPermission(): void;
  onRetry(): void;
  onArchitectureChange(architecture: ArchitectureId): void;
  onFieldChange(field: string, value: string | number | boolean | null): void;
  onTagToggle(tag: string): void;
  onToggleCredential(field: string): void;
  onPageChange(index: number, field: 'name' | 'path', value: string): void;
  onPageRemove(index: number): void;
  onPageAddCurrent(): void;
  onPageAddManual(): void;
  onGenerate(): void;
  onFullscreen(): void;
  onBack(): void;
}

export interface PopupView {
  render(state: PopupState, actions: PopupActions): void;
  drawQr(payload: EncodedPayload): Promise<void>;
  focusPage(index: number): void;
  confirmRefresh(): Promise<boolean>;
  dispose(): void;
}
