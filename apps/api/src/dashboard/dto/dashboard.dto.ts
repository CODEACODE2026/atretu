import { IsOptional, IsUUID } from "class-validator";

export class DashboardOverviewQueryDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;
}

export type DashboardMetric = {
  key: string;
  label: string;
  value: number;
  formattedValue: string;
  context: string | null;
  status: "neutral" | "success" | "warning" | "danger";
};

export type DashboardListItem = {
  id: string;
  label: string;
  description: string | null;
  status: string;
  date: string | null;
  amountCents?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type DashboardChartPoint = {
  busId?: string;
  label: string;
  value: number;
  amountCents?: number | null;
  capacity?: number;
  occupiedSeats?: number;
  availableSeats?: number;
  occupancyPercent?: number;
  status?: "NORMAL" | "NEAR_FULL" | "FULL";
};

export type DashboardChart = {
  key: string;
  title: string;
  description: string;
  type: "bar" | "line";
  data: DashboardChartPoint[];
};

export type DashboardQuickShortcut = {
  key: string;
  label: string;
  href: string;
  restrictedTo?: Array<"SUPER_ADMIN" | "SECRETARIA">;
};

export type DashboardOverviewResponse = {
  generatedAt: string;
  academicYear: {
    id: string;
    year: number;
    isCurrent: boolean;
  } | null;
  indicators: {
    activeStudents: DashboardMetric;
    pendingPreRegistrations: DashboardMetric;
    overdueAmount: DashboardMetric;
    overdueInvoices: DashboardMetric;
    bankSlipsAttention: DashboardMetric;
    busSeats: DashboardMetric;
    pendingStudentCards: DashboardMetric;
    incompleteDocuments: DashboardMetric;
  };
  agendaToday: {
    collectionFollowUps: DashboardListItem[];
    preRegistrationsToReview: DashboardListItem[];
    pendingCards: DashboardListItem[];
  };
  criticalAlerts: DashboardListItem[];
  financeAndCollections: {
    metrics: DashboardMetric[];
    criticalCases: DashboardListItem[];
  };
  academicsAndDocuments: {
    metrics: DashboardMetric[];
    recentItems: DashboardListItem[];
  };
  busesAndSeats: {
    metrics: DashboardMetric[];
    attentionBuses: DashboardListItem[];
  };
  preRegistrations: {
    metrics: DashboardMetric[];
    pendingItems: DashboardListItem[];
  };
  pendingStudentCards: {
    metrics: DashboardMetric[];
    items: DashboardListItem[];
  };
  charts: {
    overdueByAgingBucket: DashboardChart;
    occupancyByBus: DashboardChart;
    studentsByInstitution: DashboardChart;
    preRegistrationsByMonth: DashboardChart;
  };
  quickShortcuts: DashboardQuickShortcut[];
};
