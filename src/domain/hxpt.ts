import type { ArchitectureId } from './types';

// Match the HTTPS site covered by the app's HXPT web rule.
export function isHxptAddress(address: string): boolean {
  return /^https:\/\/www\.hxpt\.org(?::443)?\/?$/i.test(address.trim());
}

export function usesHxptWebSession(architecture: ArchitectureId, address: string): boolean {
  return architecture === 'nexusphp' && isHxptAddress(address);
}
