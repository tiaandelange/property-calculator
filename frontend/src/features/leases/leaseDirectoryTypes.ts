import type { TenantLeaseStatus } from "../tenants/tenantDirectoryTypes";

export type LeaseListItem = {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  tenantId: string;
  tenantName: string;
  tenantEmail?: string | null;
  tenantPhone?: string | null;
  monthlyRent: number | null;
  depositAmount: number | null;
  rentDueDay: number | null;
  leaseType: string;
  leaseTypeLabel: string;
  startDate: string | null;
  endDate: string | null;
  displayStatus: string;
  lifecycleStatus: TenantLeaseStatus;
  isCancellable: boolean;
};

export type LeaseDirectoryMetrics = {
  totalLeases: number;
  activeLeases: number;
  monthlyRentRoll: number;
  renewalsDue: number;
};

export type LeaseFilters = {
  q: string;
  propertyId: string;
  status: string;
  leaseType: string;
};
