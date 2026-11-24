export const issueCodes = [
  'architectureUnsupported', 'addressUnsupported', 'nameRequired', 'nameTooLong',
  'addressInvalid', 'cookieInvalid', 'passkeyInvalid', 'apiKeyRequired', 'uidInvalid',
  'credentialInvalid', 'pigTokenInvalid', 'pigVisitorMissing', 'userAgentInvalid',
  'pagesCount', 'pageNameRequired', 'pageNameTooLong', 'pageNameDuplicate',
  'entryUnsafe', 'entryUnsupported', 'mtRouteUnsupported', 'mtFiltersUnsupported',
  'mtIdsInvalid', 'tagsLimit', 'decodedPayloadTooLarge', 'qrCapacity',
  'contextReadFailed', 'pageReadFailed', 'pageChanged', 'parseFailed',
  'permissionDenied', 'permissionRequestFailed', 'addPageFailed', 'wrongSite',
  'qrDrawFailed', 'fullscreenOpenFailed', 'fullscreenExpired', 'fullscreenDisplayFailed',
  'credentialMissing', 'credentialAmbiguous', 'mtApiKeyManual', 'pigTokenMissing',
  'cookieReadFallback', 'cookieReadMissing', 'cookieVisibleOnly', 'cookieUnavailable',
] as const;

export type IssueCode = (typeof issueCodes)[number];

export interface ImportIssue {
  code: IssueCode;
  index?: number;
  keys?: readonly string[];
  field?: string;
}

const knownCodes: ReadonlySet<string> = new Set(issueCodes);

export function isImportIssue(value: unknown): value is ImportIssue {
  if (!value || typeof value !== 'object') return false;
  const { code, index, keys, field } = value as Record<string, unknown>;
  return typeof code === 'string' && knownCodes.has(code)
    && (index === undefined || typeof index === 'number' && Number.isSafeInteger(index) && index >= 0)
    && (keys === undefined || Array.isArray(keys) && keys.every(key => typeof key === 'string'))
    && (field === undefined || typeof field === 'string');
}

export class ImportPayloadError extends Error {
  constructor(readonly issue: ImportIssue) {
    super(issue.code);
    this.name = 'ImportPayloadError';
  }
}

export function safeIssueKeys(keys: readonly string[]): readonly string[] {
  return [...new Set(keys.filter(key => /^[A-Za-z][A-Za-z0-9_]{0,30}$/.test(key)))].slice(0, 8);
}
