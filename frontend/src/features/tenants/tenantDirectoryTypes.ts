export type TenantPaymentStatus = "paid" | "partial" | "pending" | "overdue" | "unknown";

export type TenantLeaseStatus = "active" | "ending_soon" | "notice" | "expired" | "inactive" | string;

export type TenantListItem = {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  tenantStatus?: string | null;
  propertyId?: string | null;
  propertyName?: string | null;
  propertyAddress?: string | null;
  unitNumber?: string | null;
  leaseId?: string | null;
  monthlyRent?: number | null;
  leaseStartDate?: string | null;
  leaseEndDate?: string | null;
  leaseStatus?: TenantLeaseStatus | null;
  leaseDisplayStatus?: string | null;
  paymentStatus?: TenantPaymentStatus | null;
  outstandingAmount?: number | null;
  lastPaymentDate?: string | null;
  nextPaymentDueDate?: string | null;
  monthlyIncome?: number | null;
  fitScore?: number | null;
  targetRent?: number | null;
  applicationSubmittedAt?: string | null;
  applicationGroupId?: string | null;
  applicantGroupRole?: string | null;
  coApplicantTenantId?: string | null;
  /** All tenant ids in a joint application (for delete). */
  memberTenantIds?: string[];
};

export type TenantDirectoryMetrics = {
  totalTenants: number;
  activeLeases: number;
  pendingPaymentsTotal: number;
  pendingPaymentsCount: number;
  renewalsDue: number;
};

export type ApplicantDirectoryMetrics = {
  totalApplicants: number;
  awaitingProperty: number;
  linkedToProperty: number;
  readyForLease: number;
};
