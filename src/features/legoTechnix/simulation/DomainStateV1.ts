import type { LegoTechnixDomain } from '../domains';

export interface DomainStateV1 {
  readonly domainId: LegoTechnixDomain;
  readonly isOnline: boolean;
  readonly pressureBar?: number;
}
