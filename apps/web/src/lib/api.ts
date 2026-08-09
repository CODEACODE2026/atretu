import { mapApiErrorMessage } from "./formatters";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "INACTIVE";
  roles: RoleCode[];
  institutionIds?: string[];
  mustChangePassword?: boolean;
  lastLoginAt?: string | null;
};

export type AuthResponse = {
  user: ApiUser;
};

export type RoleCode = "SUPER_ADMIN" | "SECRETARIA" | "GESTOR";
export type UserStatus = "ACTIVE" | "INACTIVE";

export type AssociationSettings = {
  id: string;
  legalName: string;
  displayName: string | null;
  cnpj: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  primaryPhone: string;
  secondaryPhone: string | null;
  email: string;
  website: string | null;
  logoStorageKey: string | null;
  logoContentType: string | null;
  logoFileName: string | null;
  logoSizeBytes: number | null;
  logoUrl: string | null;
  footerText: string;
  createdAt: string;
  updatedAt: string;
  updatedByUserId: string | null;
};

export type UpdateAssociationSettingsBody = Pick<
  AssociationSettings,
  | "city"
  | "cnpj"
  | "district"
  | "email"
  | "legalName"
  | "number"
  | "postalCode"
  | "primaryPhone"
  | "state"
  | "street"
> &
  Partial<
    Pick<
      AssociationSettings,
      "complement" | "displayName" | "secondaryPhone" | "website"
    >
  >;

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roles: RoleCode[];
  institutionIds: string[];
  institutions: Array<{ id: string; name: string; status: string }>;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  blockedAt: string | null;
  effectivePermissions: {
    canAdminUsers: boolean;
    globalAccess: boolean;
    institutionScope: "global" | "restricted" | "none";
  };
};

export type AdminUserSort =
  | "createdAt"
  | "email"
  | "lastLoginAt"
  | "name"
  | "status"
  | "updatedAt";

export type ListAdminUsersParams = {
  institutionId?: string;
  limit?: number;
  mustChangePassword?: boolean;
  neverLoggedIn?: boolean;
  order?: "asc" | "desc";
  page?: number;
  role?: RoleCode;
  search?: string;
  sort?: AdminUserSort;
  status?: UserStatus;
  withoutInstitution?: boolean;
};

export type CreateAdminUserBody = {
  email: string;
  institutionIds: string[];
  name: string;
  role: Exclude<RoleCode, "GESTOR">;
};

export type UpdateAdminUserBody = Partial<
  Pick<CreateAdminUserBody, "email" | "name" | "role">
>;

export type AdminUserPasswordResponse = {
  temporaryPassword: string;
  user: AdminUser;
};

export type AccountUser = ApiUser & {
  institutionIds: string[];
  mustChangePassword: boolean;
};

export type AccountResponse = {
  user: AccountUser;
};

export type UpdateOwnAccountPayload = {
  name: string;
};

export type ChangeOwnPasswordPayload = {
  confirmPassword?: string;
  currentPassword: string;
  newPassword: string;
};

export type ChangeOwnPasswordResponse = {
  ok: true;
  requiresLogin: true;
};

export type JobStatus = {
  name: string;
  enabled: boolean;
  registered: boolean;
  intervalMs: number;
  tickCount: number;
  lastTickAt?: string | null;
  lastRunStartedAt?: string | null;
  lastRunFinishedAt?: string | null;
  nextRunEstimatedAt?: string | null;
  running: boolean;
  lastError?: {
    at: string;
    type: string;
    message: string;
  } | null;
};

export type JobsStatusResponse = {
  serverTime: string;
  uptimeSeconds: number;
  pid: number;
  jobs: JobStatus[];
};

export type DashboardOverviewParams = {
  academicYearId?: string;
  institutionId?: string;
};

export type DashboardMetricStatus =
  | "neutral"
  | "success"
  | "warning"
  | "danger";

export type DashboardMetric = {
  key: string;
  label: string;
  value: number;
  formattedValue: string;
  context: string | null;
  status: DashboardMetricStatus;
  href?: string;
};

export type DashboardListItemStatus =
  | PreRegistrationStatus
  | BankSlipStatus
  | CollectionOperationalStatus
  | CollectionPriority
  | "DOCUMENTS_PENDING"
  | "FOLLOW_UP_TODAY"
  | "FULL"
  | "NEAR_FULL"
  | "PENDING";

export type DashboardListItem = {
  id: string;
  label: string;
  description: string | null;
  status: DashboardListItemStatus;
  date: string | null;
  amountCents?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type DashboardChartType = "bar" | "line";
export type DashboardBusOccupancyStatus = "NORMAL" | "NEAR_FULL" | "FULL";

export type DashboardChartPoint = {
  busId?: string;
  label: string;
  value: number;
  amountCents?: number | null;
  capacity?: number;
  occupiedSeats?: number;
  availableSeats?: number;
  occupancyPercent?: number;
  status?: DashboardBusOccupancyStatus;
};

export type DashboardChart = {
  key:
    | "overdueByAgingBucket"
    | "occupancyByBus"
    | "studentsByInstitution"
    | "preRegistrationsByMonth";
  title: string;
  description: string;
  type: DashboardChartType;
  data: DashboardChartPoint[];
};

export type DashboardQuickShortcut = {
  key: string;
  label: string;
  href: string;
  restrictedTo?: ApiUser["roles"];
};

export type DashboardOperationalBlock = {
  key: "academics" | "finance" | "collections" | "transport" | "quickActions";
  title: string;
  description: string;
  status: "loaded" | "error";
  error?: string | null;
  metrics: DashboardMetric[];
  shortcuts?: DashboardQuickShortcut[];
};

export type AdminDashboardResponse = {
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
  operationalBlocks?: DashboardOperationalBlock[];
  charts: {
    overdueByAgingBucket: DashboardChart & {
      key: "overdueByAgingBucket";
      type: "bar";
    };
    occupancyByBus: DashboardChart & {
      key: "occupancyByBus";
      type: "bar";
      data: Array<
        DashboardChartPoint & {
          busId: string;
          capacity: number;
          occupiedSeats: number;
          availableSeats: number;
          occupancyPercent: number;
          status: DashboardBusOccupancyStatus;
        }
      >;
    };
    studentsByInstitution: DashboardChart & {
      key: "studentsByInstitution";
      type: "bar";
    };
    preRegistrationsByMonth: DashboardChart & {
      key: "preRegistrationsByMonth";
      type: "line";
    };
  };
  quickShortcuts: DashboardQuickShortcut[];
};

export type RecordStatus = "ACTIVE" | "INACTIVE";

export type BaseRecord = {
  id: string;
  name: string;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type BusRecord = BaseRecord & {
  capacity: number;
  occupiedSeats?: number;
  availableSeats?: number;
  isFull?: boolean;
};

export type BusAvailabilityFilter = "all" | "available" | "full";

export type ListResponse<T> = {
  data: T[];
  academicYearId?: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type InvoiceListSummary = {
  openAmountCents: number;
  overdueAmountCents: number;
  paidAmountCents: number;
  cancelledAmountCents: number;
  loadedInvoiceCount: number;
  totalFilteredInvoiceCount: number;
  failedBankSlips: number;
};

export type ListRecordsParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: "active" | "inactive" | "all";
  sort?: "name" | "status" | "createdAt" | "updatedAt";
  order?: "asc" | "desc";
  academicYearId?: string;
  institutionId?: string;
  availability?: BusAvailabilityFilter;
};

export type AcademicYear = {
  id: string;
  year: number;
  isCurrent: boolean;
  status: "ACTIVE" | "ARCHIVED";
  archivedAt?: string | null;
  dependencyCounts?: {
    enrollments: number;
    preRegistrations: number;
    cardSequences: number;
    studentCards: number;
  };
  canEditYear?: boolean;
  canDelete?: boolean;
  canArchive?: boolean;
  canReactivate?: boolean;
  canSetCurrent?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StudentStatus = "ACTIVE" | "SUSPENDED" | "TERMINATED";
export type BoardMembershipStatus = "ACTIVE" | "ENDED";
export type BoardMemberRole =
  | "MEMBER"
  | "PRESIDENT"
  | "SECRETARY"
  | "TREASURER"
  | "VICE_PRESIDENT";
export type StudentCardType = "STUDENT" | "BOARD_MEMBER";
export type StudentCardStatus = "ACTIVE" | "INVALIDATED";
export type StudentCardInvalidationReason =
  | "SUPERSEDED_BY_BOARD_CARD"
  | "BOARD_MEMBERSHIP_ENDED"
  | "STUDENT_TERMINATED"
  | "MANUAL_CORRECTION"
  | "OTHER";

export type BoardMembershipRecord = {
  id: string;
  studentId: string;
  role?: BoardMemberRole | null;
  status: BoardMembershipStatus;
  startedAt: string;
  endedAt?: string | null;
  startNote?: string | null;
  endNote?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudentSummary = {
  id: string;
  status: StudentStatus;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
  canReceiveFutureInvoices: boolean;
  activeBoardMembership?: BoardMembershipRecord | null;
  currentStudentCard?: {
    id: string;
    cardType: StudentCardType;
    sequenceNumber: number;
    cardNumber: string;
    academicYear: AcademicYear;
  } | null;
  person: {
    id: string;
    fullName: string;
    cpfMasked: string;
  };
  currentEnrollment: EnrollmentRecord | null;
};

export type StudentDetail = Omit<StudentSummary, "person" | "currentEnrollment"> & {
  person: PersonRecord;
  guardian: GuardianRecord | null;
  enrollments: EnrollmentRecord[];
};

export type PersonRecord = {
  id: string;
  fullName: string;
  cpf: string;
  rg?: string | null;
  birthDate: string;
  phone?: string | null;
  email?: string | null;
  addressStreet: string;
  addressNumber: string;
  addressNeighborhood: string;
  addressCity: string;
  addressZipCode?: string | null;
  addressState?: string | null;
  addressComplement?: string | null;
};

export type GuardianRecord = {
  id: string;
  fullName: string;
  cpf?: string | null;
  rg?: string | null;
};

export type EnrollmentRecord = {
  id: string;
  status: "ACTIVE";
  course: string;
  grade: string;
  academicYear: AcademicYear;
  institution: BaseRecord;
  shift: BaseRecord;
  createdAt: string;
  updatedAt: string;
};

export type BusAssignmentRecord = {
  id: string;
  status: "ACTIVE" | "ENDED";
  startedAt: string;
  endedAt?: string | null;
  endReason?: "RELEASED" | "SWITCHED" | "SUSPENSION" | "TERMINATION" | null;
  note?: string | null;
  bus: BusRecord;
  enrollment: EnrollmentRecord;
  student: {
    id: string;
    fullName: string;
    cpfMasked: string;
  };
};

export type BusAssignmentsResponse = ListResponse<BusAssignmentRecord> & {
  occupancy: {
    busId: string;
    capacity: number;
    occupiedSeats: number;
    availableSeats: number;
    isFull: boolean;
  };
};

export type BusAssignmentEvent = {
  id: string;
  eventType:
    | "LINKED"
    | "RELEASED"
    | "SWITCHED"
    | "SUSPENSION_RELEASED"
    | "TERMINATION_RELEASED";
  note?: string | null;
  occurredAt: string;
  fromBus?: BusRecord | null;
  toBus?: BusRecord | null;
};

export type StudentDocumentType =
  | "CPF"
  | "RG"
  | "PROOF_OF_ADDRESS"
  | "PROOF_OF_ENROLLMENT"
  | "PHOTO";

export type StudentDocumentStatus = "ACTIVE" | "REPLACED" | "REMOVED";

export type StudentDocumentRecord = {
  id: string;
  studentId: string;
  documentType: StudentDocumentType;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  checksumSha256: string;
  status: StudentDocumentStatus;
  uploadedByUserId?: string | null;
  removedByUserId?: string | null;
  replacedById?: string | null;
  replacedAt?: string | null;
  removedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudentDocumentsResponse = {
  data: StudentDocumentRecord[];
  missingTypes: StudentDocumentType[];
};

export type OfficialDocumentType =
  | "ADHESION_TERM"
  | "ANNUAL_CLEARANCE_DECLARATION"
  | "INTERNAL_REGULATION"
  | "TRANSPORT_REFUND_REQUEST"
  | "TRANSPORT_REGULATION"
  | "TERMINATION_LETTER"
  | "TERMINATION_TERM";
export type OfficialDocumentSituation = "ISSUED" | "NOT_ISSUED";

export type OfficialDocumentIssue = {
  id: string;
  studentId: string | null;
  type: OfficialDocumentType;
  status: "ISSUED";
  templateKey: string;
  templateVersion: number;
  version: number;
  protocol: string;
  fileName: string;
  sizeBytes: number;
  checksumSha256: string;
  issuedAt: string;
  issuedBy: { id: string; name: string; email: string } | null;
  sourceIssueId: string | null;
  notes: string | null;
  adhesionDetails: {
    firstInstallmentDate: string | null;
    installmentAmountCents: number | null;
    installmentCount: number | null;
    installmentDueDay: number | null;
    installments: Array<{
      amountCents: number | null;
      dueDate: string | null;
      label: string | null;
      number: number | null;
    }>;
    totalContractAmountCents: number | null;
  } | null;
  annualClearanceDetails: {
    finalClearanceDate: string | null;
    issueDate: string | null;
    issuePlaceDateText: string | null;
    periodEnd: string | null;
    periodStart: string | null;
    totalAmountCents: number | null;
    totalAmountWords: string | null;
    year: number | null;
  } | null;
  approvalDate: string | null;
  refundDetails: {
    issueDate: string | null;
    issuePlaceDateText: string | null;
    paymentMethod: string | null;
    reason: string | null;
    refundAmountCents: number | null;
    refundAmountWords: string | null;
  } | null;
  signerDetails: Array<{
    boardId: string | null;
    boardMemberId: string | null;
    boardPeriodEnd: string | null;
    boardPeriodStart: string | null;
    endedAt: string | null;
    label: string | null;
    name: string | null;
    personId: string | null;
    resolvedAt: string | null;
    role: string | null;
    roleLabel: string | null;
    signerName: string | null;
    signerPersonId: string | null;
    signerRole: string | null;
    signerRoleLabel: string | null;
    signerSource: string | null;
    signerStudentId: string | null;
    source: string | null;
    startedAt: string | null;
    studentId: string | null;
  }>;
  termDetails: {
    dueDate: string | null;
    notificationDate: string | null;
    reason: string | null;
    regularizationDeadlineDays: number | null;
    regularizationLimit: string | null;
  } | null;
};

export type OfficialDocumentCatalogItem = {
  type: OfficialDocumentType;
  title: string;
  description: string;
  situation: OfficialDocumentSituation;
  canIssue: boolean;
  blockedReason: string | null;
  signerPreview?: {
    error: string | null;
    signerName: string | null;
    signerRole: string | null;
    signerRoleLabel: string | null;
  } | null;
  latestIssue: OfficialDocumentIssue | null;
  history: OfficialDocumentIssue[];
};

export type OfficialDocumentsResponse = {
  data: OfficialDocumentCatalogItem[];
};

export type IssueOfficialDocumentBody = {
  bankAccount?: string;
  bankAccountType?: string;
  bankAgency?: string;
  bankName?: string;
  dueDate?: string;
  finalClearanceDate?: string;
  firstInstallmentDate?: string;
  installmentAmountCents?: number;
  installmentCount?: number;
  notificationDate?: string;
  notes?: string;
  paymentMethod?: "BANK_ACCOUNT" | "PIX";
  pixKey?: string;
  reason?: string;
  regularizationDeadlineDays?: number;
  refundAmountCents?: number;
  totalAmountCents?: number;
  year?: number;
};

export type IssueInstitutionalOfficialDocumentBody = {
  approvalDate?: string;
  notes?: string;
};

export type DocumentationStatus = "none" | "partial" | "complete";

export type StudentDocumentationStatusRecord = {
  studentId: string;
  fullName: string;
  cpfMasked: string;
  joinedAt: string;
  institution: BaseRecord | null;
  academicYear: AcademicYear | null;
  enrollment: EnrollmentRecord | null;
  expectedDocumentCount: number;
  activeDocumentCount: number;
  missingDocumentCount: number;
  missingTypes: StudentDocumentType[];
  documentationStatus: DocumentationStatus;
};

export type StudentPhotoResponse = {
  photo: StudentDocumentRecord | null;
};

export type PreRegistrationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type PreRegistrationDocumentStatus = "UPLOADED" | "PROMOTED" | "REMOVED";

export type PreRegistrationOptions = {
  academicYears: Pick<AcademicYear, "id" | "year" | "isCurrent">[];
  institutions: Pick<BaseRecord, "id" | "name">[];
  shifts: Pick<BaseRecord, "id" | "name">[];
};

export type PublicPreRegistrationPayload = {
  fullName: string;
  cpf: string;
  rg?: string;
  birthDate: string;
  phone?: string;
  email?: string;
  addressStreet: string;
  addressNumber: string;
  addressNeighborhood: string;
  addressCity: string;
  guardianFullName?: string;
  guardianCpf?: string;
  guardianRg?: string;
  academicYearId: string;
  institutionId: string;
  shiftId: string;
  course: string;
  grade: string;
  website?: string;
};

export type PublicPreRegistrationFiles = Partial<
  Record<
    | "cpfDocument"
    | "rgDocument"
    | "proofOfAddressDocument"
    | "proofOfEnrollmentDocument",
    File
  >
>;

export type PublicPreRegistrationResponse = {
  received: true;
  publicCode?: string;
  message: string;
};

export type PreRegistrationSummary = {
  id: string;
  publicCode: string;
  status: PreRegistrationStatus;
  fullName: string;
  cpfMasked: string;
  academicYear: Pick<AcademicYear, "id" | "year" | "isCurrent">;
  institution: Pick<BaseRecord, "id" | "name">;
  shift: Pick<BaseRecord, "id" | "name">;
  course: string;
  grade: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string | null;
};

export type PreRegistrationDocumentRecord = {
  id: string;
  documentType: StudentDocumentType;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  checksumSha256: string;
  status: PreRegistrationDocumentStatus;
  promotedToStudentDocumentId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PreRegistrationDetail = PreRegistrationSummary & {
  cpf: string;
  rg?: string | null;
  birthDate: string;
  phone?: string | null;
  email?: string | null;
  addressStreet: string;
  addressNumber: string;
  addressNeighborhood: string;
  addressCity: string;
  guardian: {
    fullName: string;
    cpf?: string | null;
    rg?: string | null;
  } | null;
  documents: PreRegistrationDocumentRecord[];
  reviewedBy?: Pick<ApiUser, "id" | "name" | "email"> | null;
  rejectionReason?: string | null;
  approvedStudent?: {
    id: string;
    fullName: string;
    cpfMasked: string;
  } | null;
};

export type ListPreRegistrationsParams = {
  academicYearId?: string;
  institutionId?: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: PreRegistrationStatus | "all";
  sort?: "createdAt" | "name" | "status";
  order?: "asc" | "desc";
};

export type StudentPayload = {
  person: {
    fullName: string;
    cpf: string;
    rg?: string;
    birthDate: string;
    phone?: string;
    email?: string;
    addressStreet: string;
    addressNumber: string;
    addressNeighborhood: string;
    addressCity: string;
    addressZipCode?: string;
    addressState?: string;
    addressComplement?: string;
  };
  guardian?: {
    fullName: string;
    cpf?: string;
    rg?: string;
  };
  joinedAt?: string;
  enrollment: {
    academicYearId: string;
    institutionId: string;
    shiftId: string;
    course: string;
    grade: string;
  };
  busId?: string;
};

export type ListStudentsParams = {
  page?: number;
  limit?: number;
  search?: string;
  academicYearId?: string;
  institutionId?: string;
  shiftId?: string;
  course?: string;
  status?: "active" | "suspended" | "terminated" | "all";
  sort?: "cardNumber" | "name" | "joinedAt" | "createdAt";
  order?: "asc" | "desc";
};

export type ListStudentDocumentationStatusParams = ListStudentsParams & {
  documentationStatus: DocumentationStatus;
};

export type StudentHistoryEvent = {
  id: string;
  eventType:
    | "STUDENT_SUSPENDED"
    | "STUDENT_REACTIVATED"
    | "STUDENT_TERMINATED"
    | "STUDENT_REINSTATED"
    | "STUDENT_REENROLLED"
    | "STUDENT_CARD_ISSUED"
    | "STUDENT_CARD_INVALIDATED"
    | "INVOICE_CREATED"
    | "INVOICE_CANCELLED"
    | "BOARD_MEMBERSHIP_STARTED"
    | "BOARD_MEMBERSHIP_ENDED";
  suspensionReason?: "NON_PAYMENT" | "INFRACTION" | "OTHER" | null;
  terminationReason?: "WITHDRAWAL" | "NON_PAYMENT" | null;
  justification?: string | null;
  busSeatReleased?: boolean | null;
  occurredAt: string;
  bus?: BusRecord | null;
  busAssignment?: BusAssignmentRecord | null;
  boardMembership?: BoardMembershipRecord | null;
};

export type ReenrollmentPreview = {
  student: StudentDetail;
  academicYear: AcademicYear;
  previousEnrollment: EnrollmentRecord | null;
  previousBusAssignment: {
    id: string;
    bus: BusRecord;
    note?: string | null;
  } | null;
  eligible: boolean;
  blockingReason?: string | null;
};

export type ReenrollmentCandidatesResponse = ListResponse<StudentSummary> & {
  academicYear: AcademicYear;
};

export type ReenrollmentPayload = StudentPayload["enrollment"] & {
  busId?: string;
  note?: string;
};

export type ReinstateStudentPayload = Partial<StudentPayload["enrollment"]> & {
  academicYearId: string;
  busId?: string;
  reason: string;
  note?: string;
};

export type StudentCardRecord = {
  id: string;
  cardType: StudentCardType;
  sequenceNumber: number;
  cardNumber: string;
  status: StudentCardStatus;
  issuedAt: string;
  invalidatedAt?: string | null;
  invalidationReason?: StudentCardInvalidationReason | null;
  invalidationNote?: string | null;
  validity: {
    usable: boolean;
    reason?: string | null;
  };
  student: {
    id: string;
    status: StudentStatus;
    person: {
      id: string;
      fullName: string;
      cpfMasked: string;
    };
    activeBoardMembership?: BoardMembershipRecord | null;
  };
  enrollment: EnrollmentRecord;
  academicYear: AcademicYear;
  boardMembership?: BoardMembershipRecord | null;
};

export type StudentCardPreview = {
  student: StudentCardRecord["student"];
  enrollment: EnrollmentRecord;
  academicYear: AcademicYear;
  cardType: StudentCardType;
  activeBoardMembership?: BoardMembershipRecord | null;
  previousCard?: StudentCardRecord | null;
  eligible: boolean;
  blockingReason?: string | null;
};

export type PendingStudentCardRecord = {
  enrollmentId: string;
  studentId: string;
  fullName: string;
  cpfMasked: string;
  institution: BaseRecord;
  academicYear: AcademicYear;
  enrollment: EnrollmentRecord;
  photoAvailable: boolean;
  joinedAt: string;
  blockingReason: string | null;
};

export type ListStudentCardsParams = {
  page?: number;
  limit?: number;
  search?: string;
  academicYearId?: string;
  cardType?: StudentCardType;
  status?: StudentCardStatus;
  validity?: "all" | "usable" | "notUsable";
  sort?: "issuedAt" | "cardNumber";
  order?: "asc" | "desc";
};

export type ListPendingStudentCardsParams = {
  page?: number;
  limit?: number;
  search?: string;
  academicYearId?: string;
  institutionId?: string;
};

export type StudentCardPdfDisposition = "inline" | "attachment";

export type InvoiceStatus = "OPEN" | "PAID" | "CANCELLED";
export type InvoiceCancellationReason = "MANUAL_CORRECTION" | "DUPLICATE" | "OTHER";
export type BankSlipStatus =
  | "PENDING_ISSUE"
  | "ISSUED"
  | "PAID"
  | "PENDING_CANCELLATION"
  | "CANCELLED"
  | "ISSUE_FAILED"
  | "CANCELLATION_FAILED"
  | "UNKNOWN";

export type BankSlipRecord = {
  id: string;
  invoiceId: string;
  provider: "SICREDI";
  environment: "SANDBOX" | "PRODUCTION";
  status: BankSlipStatus;
  documentSpecies: string;
  nossoNumero?: string | null;
  nossoNumeroMasked?: string | null;
  seuNumero: string;
  linhaDigitavel?: string | null;
  codigoBarras?: string | null;
  originalAmountCents: number;
  paidAmountCents?: number | null;
  issuedAt?: string | null;
  paidAt?: string | null;
  cancellationRequestedAt?: string | null;
  cancellationReason?: InvoiceCancellationReason | null;
  cancellationNote?: string | null;
  cancelledAt?: string | null;
  lastCheckedAt?: string | null;
  providerStatus?: string | null;
  providerErrorCode?: string | null;
  providerErrorMessage?: string | null;
  pdfStorageKey?: string | null;
  pdfStoredAt?: string | null;
  pdfSha256?: string | null;
  pdfSizeBytes?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type BankSlipSummary = {
  id: string;
  status: BankSlipStatus;
  nossoNumeroMasked?: string | null;
  issuedAt?: string | null;
  paidAmountCents?: number | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
  lastCheckedAt?: string | null;
  pdfStoredAt?: string | null;
};

export type SyncPaidBankSlipsDaySummary = {
  date: string;
  pagesProcessed: number;
  recordsReceived: number;
  bankSlipsFound: number;
  paymentsConfirmed: number;
  alreadySynced: number;
  notFound: number;
  errors: Array<{ seuNumero: string; nossoNumero: string; code: string }>;
};

export type BankSlipIssueBatchStatus =
  | "DRAFT"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS"
  | "FAILED"
  | "CANCELLED";

export type BankSlipIssueBatchItemStatus =
  | "QUEUED"
  | "PROCESSING"
  | "ISSUED"
  | "SKIPPED"
  | "FAILED"
  | "UNKNOWN"
  | "CANCELLED";

export type BankSlipIssueBatch = {
  id: string;
  source: "MANUAL" | "INSTITUTION";
  institutionId?: string | null;
  institution?: {
    id: string;
    name: string;
  } | null;
  competence?: string | null;
  dueDate?: string | null;
  shiftId?: string | null;
  shift?: {
    id: string;
    name: string;
  } | null;
  status: BankSlipIssueBatchStatus;
  requestedByUserId: string;
  cancelledByUserId?: string | null;
  cancelReason?: string | null;
  totalStudents: number;
  totalInvoices: number;
  totalEligible: number;
  unitAmountCents: number;
  totalValueCents: number;
  totalItems: number;
  processedItems: number;
  successItems: number;
  progressPercent: number;
  queuedItems: number;
  processingItems: number;
  issuedItems: number;
  skippedItems: number;
  failedItems: number;
  unknownItems: number;
  cancelledItems: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  cancelledAt?: string | null;
  metadata?: {
    previewSummary?: Partial<BankSlipIssueBatchPreview>;
    report?: {
      issuedAmountCents?: number;
      issuedAmountFormatted?: string;
      alreadyPaid?: number;
      alreadyHadBankSlip?: number;
      incompleteRegistration?: number;
    };
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type BankSlipIssueBatchPreviewItem = {
  invoiceId?: string | null;
  enrollmentId?: string | null;
  studentId?: string | null;
  studentName: string;
  studentCpfMasked: string;
  institutionId: string;
  institutionName: string;
  shiftId?: string | null;
  shiftName?: string | null;
  course?: string | null;
  grade?: string | null;
  invoiceStatus?: InvoiceStatus | null;
  dueDate?: string | null;
  amountCents?: number | null;
  amountFormatted?: string | null;
  institutionIssueStatus?:
    | "WILL_CREATE_INVOICE"
    | "EXISTING_INVOICE_ELIGIBLE"
    | "ALREADY_PAID"
    | "ACTIVE_BANK_SLIP"
    | "INVOICE_AMOUNT_CONFLICT"
    | "BLOCKED"
    | null;
  bankSlipId?: string | null;
  bankSlipStatus?: BankSlipStatus | null;
  eligible: boolean;
  eligibilityCode?: string | null;
  eligibilityReason?: string | null;
};

export type BankSlipIssueBatchPreview = {
  institutionId: string;
  institutionName: string;
  competence: string;
  shiftId?: string | null;
  dueDate?: string | null;
  unitAmountCents: number;
  unitAmountFormatted: string;
  totalEnrollmentsFound: number;
  totalStudentsFound: number;
  totalInvoicesFound: number;
  totalEligible: number;
  totalWillCreateInvoices: number;
  totalExistingInvoiceEligible: number;
  totalAlreadyPaid: number;
  totalWithActiveBankSlip: number;
  totalWithCancelledBankSlipAllowsNewIssue: number;
  totalMissingInvoice: number;
  totalInvoiceAmountConflict: number;
  totalMissingValidFinancialResponsible: number;
  totalInvalidOrMissingCpfCnpj: number;
  totalIncompleteRequiredAddress: number;
  totalBlocked: number;
  eligibleAmountCents: number;
  eligibleAmountFormatted: string;
  items: BankSlipIssueBatchPreviewItem[];
  pagination: ListResponse<BankSlipIssueBatchPreviewItem>["pagination"];
};

export type BankSlipIssueBatchInstitutionPayload = {
  source: "INSTITUTION";
  institutionId: string;
  amountCents: number;
  shiftId?: string;
  dueDate: string;
  createMissingInvoices?: boolean;
};

export type BankSlipIssueBatchManualPayload = {
  source?: "MANUAL";
  invoiceIds: string[];
};

export type BankSlipIssueBatchItem = {
  id: string;
  batchId: string;
  invoiceId?: string | null;
  studentId?: string | null;
  enrollmentId?: string | null;
  bankSlipId?: string | null;
  studentName?: string | null;
  bankSlipStatus?: BankSlipStatus | null;
  nossoNumero?: string | null;
  linhaDigitavel?: string | null;
  status: BankSlipIssueBatchItemStatus;
  attempts: number;
  nextAttemptAt?: string | null;
  lockedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  skipReason?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceRecord = {
  id: string;
  amountCents: number;
  amountFormatted: string;
  dueDate: string;
  status: InvoiceStatus;
  overdue: boolean;
  description?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: InvoiceCancellationReason | null;
  cancellationNote?: string | null;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    status: StudentStatus;
    person: {
      id: string;
      fullName: string;
      cpfMasked: string;
    };
    activeBoardMembership?: BoardMembershipRecord | null;
  };
  enrollment: EnrollmentRecord;
  createdByUser?: Pick<ApiUser, "id" | "name" | "email"> | null;
  cancelledByUser?: Pick<ApiUser, "id" | "name" | "email"> | null;
  bankSlipSummary: BankSlipSummary | null;
};

export type InvoicePreview = {
  student: InvoiceRecord["student"];
  enrollment: EnrollmentRecord;
  eligible: boolean;
  blockingReason?: string | null;
};

export type ListInvoicesParams = {
  page?: number;
  limit?: number;
  search?: string;
  academicYearId?: string;
  institutionId?: string;
  status?: InvoiceStatus;
  overdue?: "all" | "overdue" | "notOverdue";
  dueDateFrom?: string;
  dueDateTo?: string;
  paidAtFrom?: string;
  paidAtTo?: string;
  sort?: "dueDate" | "createdAt" | "amount" | "studentName";
  order?: "asc" | "desc";
};

export type CollectionAgingBucket =
  | "DAYS_1_30"
  | "DAYS_31_60"
  | "DAYS_61_90"
  | "DAYS_90_PLUS";

export type CollectionOperationalStatus =
  | "OVERDUE_NO_ACTION"
  | "CONTACTED"
  | "PROMISE_ACTIVE"
  | "PROMISE_BROKEN"
  | "FOLLOW_UP_SCHEDULED"
  | "NO_CONTACT"
  | "PARTIAL_PAYMENT_REVIEW"
  | "RESOLVED_BY_PAYMENT"
  | "CANCELLED";

export type CollectionPriority = "NORMAL" | "HIGH" | "CRITICAL";

export type CollectionActionType =
  | "CONTACT_ATTEMPT"
  | "CONTACT_MADE"
  | "PROMISE_TO_PAY"
  | "FOLLOW_UP_SCHEDULED"
  | "NO_CONTACT"
  | "PARTIAL_PAYMENT_REVIEW_NOTE"
  | "INTERNAL_NOTE";

export type CollectionChannel =
  | "PHONE"
  | "WHATSAPP"
  | "EMAIL"
  | "IN_PERSON"
  | "OTHER";

export type CollectionAction = {
  id: string;
  invoiceId: string;
  actionType: CollectionActionType;
  channel?: CollectionChannel | null;
  source: "MANUAL" | "SYSTEM" | "WHATSAPP" | "EMAIL";
  contactedName?: string | null;
  contactedDocumentMasked?: string | null;
  note: string;
  promisedAmountCents?: number | null;
  promiseDueDate?: string | null;
  nextFollowUpAt?: string | null;
  createdAt: string;
  createdByUser?: Pick<ApiUser, "id" | "name" | "email"> | null;
};

export type CreateCollectionActionBody = {
  actionType: CollectionActionType;
  channel?: CollectionChannel;
  contactedName?: string;
  contactedDocumentMasked?: string;
  note: string;
  promisedAmountCents?: number;
  promiseDueDate?: string;
  nextFollowUpAt?: string;
};

export type CollectionCase = {
  invoiceId: string;
  studentId: string;
  enrollmentId: string;
  amountCents: number;
  amountFormatted: string;
  dueDate: string;
  invoiceStatus: InvoiceStatus;
  daysOverdue: number;
  outstandingAmountCents: number;
  outstandingAmountFormatted?: string | null;
  agingBucket: CollectionAgingBucket;
  operationalStatus: CollectionOperationalStatus;
  priority: CollectionPriority;
  brokenPromise: boolean;
  partialPaymentReview: boolean;
  nextFollowUpAt?: string | null;
  lastAction?: CollectionAction | null;
  student: {
    id: string;
    status: StudentStatus;
    person: {
      id: string;
      fullName: string;
      cpfMasked: string;
      phone?: string | null;
      email?: string | null;
    };
    guardian?: GuardianRecord | null;
  };
  enrollment: Pick<EnrollmentRecord, "id" | "course" | "grade"> & {
    institution: Pick<BaseRecord, "id" | "name">;
    academicYear: Pick<AcademicYear, "id" | "year">;
  };
  bankSlip?: {
    id: string;
    status: BankSlipStatus;
    paidAmountCents?: number | null;
    paidAt?: string | null;
    providerErrorCode?: string | null;
    providerErrorMessage?: string | null;
    nossoNumeroMasked?: string | null;
    pdfStoredAt?: string | null;
  } | null;
};

export type CollectionCaseDetail = CollectionCase;
export type CollectionFollowUp = CollectionCase;

export type CollectionSummary = {
  totalOverdueCents: number;
  invoiceCount: number;
  studentCount: number;
  averageOverdueAmountCents: number;
  agingBuckets: Record<CollectionAgingBucket, number>;
  promisesActiveCount: number;
  promisesBrokenCount: number;
  followUpsTodayCount: number;
  partialPaymentReviewCount: number;
};

export type ListCollectionCasesParams = {
  page?: number;
  limit?: number;
  institutionId?: string;
  academicYearId?: string;
  studentId?: string;
  search?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  agingBucket?: CollectionAgingBucket;
  operationalStatus?: CollectionOperationalStatus;
  actionType?: CollectionActionType;
  followUpFrom?: string;
  followUpTo?: string;
};

type ApiRequestInit = RequestInit & {
  skipSessionInvalidationEvent?: boolean;
};

type ApiErrorResponseBody = {
  code?: string;
  message?: string | string[];
  requestId?: string;
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function notifySessionInvalid(path: string, status: number) {
  if (
    status !== 401 ||
    path === "/auth/login" ||
    typeof window === "undefined"
  ) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent("atretu:session-invalid", { detail: { path, status } }),
  );
}

async function request<T>(
  path: string,
  options: ApiRequestInit = {},
): Promise<T> {
  const { skipSessionInvalidationEvent, ...fetchOptions } = options;
  const isFormData =
    typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | ApiErrorResponseBody
      | null;
    if (!skipSessionInvalidationEvent) {
      notifySessionInvalid(path, response.status);
    }
    throw new ApiRequestError(formatApiErrorBody(body), response.status);
  }

  return response.json() as Promise<T>;
}

async function requestBlob(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | ApiErrorResponseBody
      | null;
    notifySessionInvalid(path, response.status);
    throw new ApiRequestError(formatApiErrorBody(body), response.status);
  }

  return {
    blob: await response.blob(),
    fileName: fileNameFromDisposition(response.headers.get("content-disposition")),
    headers: response.headers,
  };
}

function formatApiErrorBody(body: ApiErrorResponseBody | null) {
  const message = Array.isArray(body?.message)
    ? body.message.join(" ")
    : body?.message;
  return mapApiErrorMessage(message, { requestId: body?.requestId ?? body?.code });
}

function withParams(path: string, params: Record<string, unknown> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export const api = {
  login(email: string, password: string) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      skipSessionInvalidationEvent: true,
    });
  },

  me() {
    return request<AuthResponse>("/auth/me");
  },

  getJobsStatus() {
    return request<JobsStatusResponse>("/admin/jobs/status");
  },

  listAdminUsers(params?: ListAdminUsersParams) {
    return request<ListResponse<AdminUser>>(withParams("/admin/users", params));
  },

  getAdminUser(id: string) {
    return request<AdminUser>(`/admin/users/${id}`);
  },

  createAdminUser(body: CreateAdminUserBody) {
    return request<AdminUserPasswordResponse>("/admin/users", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateAdminUser(id: string, body: UpdateAdminUserBody) {
    return request<AdminUser>(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  updateAdminUserInstitutions(id: string, institutionIds: string[]) {
    return request<AdminUser>(`/admin/users/${id}/institutions`, {
      method: "PATCH",
      body: JSON.stringify({ institutionIds }),
    });
  },

  blockAdminUser(id: string) {
    return request<AdminUser>(`/admin/users/${id}/block`, {
      method: "PATCH",
    });
  },

  unblockAdminUser(id: string) {
    return request<AdminUser>(`/admin/users/${id}/unblock`, {
      method: "PATCH",
    });
  },

  resetAdminUserPassword(id: string) {
    return request<AdminUserPasswordResponse>(
      `/admin/users/${id}/reset-password`,
      {
        method: "POST",
      },
    );
  },

  getAdminDashboard(params?: DashboardOverviewParams) {
    return request<AdminDashboardResponse>(
      withParams("/dashboard/overview", params),
    );
  },

  logout() {
    return request<{ ok: true }>("/auth/logout", {
      method: "POST",
    });
  },

  getAccount() {
    return request<AccountResponse>("/account");
  },

  updateAccount(body: UpdateOwnAccountPayload) {
    return request<AccountResponse>("/account", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  changeOwnPassword(body: ChangeOwnPasswordPayload) {
    return request<ChangeOwnPasswordResponse>("/account/password", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  listInstitutions(params?: ListRecordsParams) {
    return request<ListResponse<BaseRecord>>(withParams("/institutions", params));
  },

  createInstitution(body: { name: string }) {
    return request<BaseRecord>("/institutions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateInstitution(id: string, body: { name: string }) {
    return request<BaseRecord>(`/institutions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  inactivateInstitution(id: string) {
    return request<BaseRecord>(`/institutions/${id}/inactivate`, {
      method: "PATCH",
    });
  },

  reactivateInstitution(id: string) {
    return request<BaseRecord>(`/institutions/${id}/reactivate`, {
      method: "PATCH",
    });
  },

  listShifts(params?: ListRecordsParams) {
    return request<ListResponse<BaseRecord>>(withParams("/shifts", params));
  },

  createShift(body: { name: string }) {
    return request<BaseRecord>("/shifts", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateShift(id: string, body: { name: string }) {
    return request<BaseRecord>(`/shifts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  inactivateShift(id: string) {
    return request<BaseRecord>(`/shifts/${id}/inactivate`, {
      method: "PATCH",
    });
  },

  reactivateShift(id: string) {
    return request<BaseRecord>(`/shifts/${id}/reactivate`, {
      method: "PATCH",
    });
  },

  listBuses(params?: ListRecordsParams) {
    return request<ListResponse<BusRecord>>(withParams("/buses", params));
  },

  createBus(body: { name: string; capacity: number }) {
    return request<BusRecord>("/buses", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateBus(id: string, body: { name: string; capacity: number }) {
    return request<BusRecord>(`/buses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  inactivateBus(id: string) {
    return request<BusRecord>(`/buses/${id}/inactivate`, {
      method: "PATCH",
    });
  },

  reactivateBus(id: string) {
    return request<BusRecord>(`/buses/${id}/reactivate`, {
      method: "PATCH",
    });
  },

  listAcademicYears(params?: { status?: "active" | "archived" | "all" }) {
    return request<{ data: AcademicYear[] }>(withParams("/academic-years", params));
  },

  createAcademicYear(body: { year: number; isCurrent?: boolean }) {
    return request<AcademicYear>("/academic-years", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateAcademicYear(id: string, body: { year: number }) {
    return request<AcademicYear>(`/academic-years/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  setCurrentAcademicYear(id: string) {
    return request<AcademicYear>(`/academic-years/${id}/set-current`, {
      method: "PATCH",
    });
  },

  archiveAcademicYear(id: string) {
    return request<AcademicYear>(`/academic-years/${id}/archive`, {
      method: "PATCH",
    });
  },

  reactivateAcademicYear(id: string) {
    return request<AcademicYear>(`/academic-years/${id}/reactivate`, {
      method: "PATCH",
    });
  },

  deleteAcademicYear(id: string) {
    return request<{ deleted: boolean; id: string }>(`/academic-years/${id}`, {
      method: "DELETE",
    });
  },

  getAssociationSettings() {
    return request<AssociationSettings>("/admin/association-settings");
  },

  updateAssociationSettings(body: UpdateAssociationSettingsBody) {
    return request<AssociationSettings>("/admin/association-settings", {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  updateAssociationLogo(file: File) {
    const form = new FormData();
    form.set("file", file);
    return request<AssociationSettings>("/admin/association-settings/logo", {
      method: "POST",
      body: form,
    });
  },

  async downloadAssociationLogo(storageKey?: string | null) {
    return requestBlob(
      withParams("/admin/association-settings/logo", {
        key: storageKey ?? undefined,
      }),
    );
  },

  listStudents(params?: ListStudentsParams) {
    return request<ListResponse<StudentSummary>>(withParams("/students", params));
  },

  listStudentDocumentationStatus(params: ListStudentDocumentationStatusParams) {
    return request<ListResponse<StudentDocumentationStatusRecord>>(
      withParams("/students/documentation-status", params),
    );
  },

  listReenrollmentCandidates(params?: ListStudentsParams) {
    return request<ReenrollmentCandidatesResponse>(
      withParams("/students/reenrollment-candidates", params),
    );
  },

  listStudentCards(params?: ListStudentCardsParams) {
    return request<ListResponse<StudentCardRecord>>(
      withParams("/student-cards", params),
    );
  },

  listPendingStudentCards(params?: ListPendingStudentCardsParams) {
    return request<ListResponse<PendingStudentCardRecord>>(
      withParams("/student-cards/pending", params),
    );
  },

  listInvoices(params?: ListInvoicesParams) {
    return request<ListResponse<InvoiceRecord> & { summary?: InvoiceListSummary }>(
      withParams("/finance/invoices", params),
    );
  },

  getCollectionSummary(params?: ListCollectionCasesParams) {
    return request<CollectionSummary>(
      withParams("/finance/collections/summary", params),
    );
  },

  listCollectionCases(params?: ListCollectionCasesParams) {
    return request<ListResponse<CollectionCase>>(
      withParams("/finance/collections/cases", params),
    );
  },

  getCollectionCase(invoiceId: string) {
    return request<CollectionCaseDetail>(
      `/finance/collections/cases/${invoiceId}`,
    );
  },

  listCollectionActions(invoiceId: string) {
    return request<{ data: CollectionAction[] }>(
      `/finance/collections/cases/${invoiceId}/actions`,
    );
  },

  listCollectionFollowUps(params?: ListCollectionCasesParams) {
    return request<{ data: CollectionFollowUp[] }>(
      withParams("/finance/collections/follow-ups", params),
    );
  },

  createCollectionAction(invoiceId: string, body: CreateCollectionActionBody) {
    return request<CollectionAction>(
      `/finance/collections/cases/${invoiceId}/actions`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  getInvoice(id: string) {
    return request<InvoiceRecord>(`/finance/invoices/${id}`);
  },

  listInvoicesForStudent(studentId: string) {
    return request<{ data: InvoiceRecord[] }>(`/students/${studentId}/invoices`);
  },

  previewInvoice(studentId: string, params: { enrollmentId: string }) {
    return request<InvoicePreview>(
      withParams(`/students/${studentId}/invoice-preview`, params),
    );
  },

  createInvoice(
    studentId: string,
    body: {
      enrollmentId: string;
      amountCents: number;
      dueDate: string;
      description?: string;
      idempotencyKey: string;
    },
  ) {
    return request<InvoiceRecord>(`/students/${studentId}/invoices`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  cancelInvoice(
    invoiceId: string,
    body: { reason: InvoiceCancellationReason; note?: string },
  ) {
    return request<InvoiceRecord>(`/finance/invoices/${invoiceId}/cancel`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  getInvoiceBankSlip(invoiceId: string) {
    return request<BankSlipRecord>(`/finance/invoices/${invoiceId}/bank-slip`);
  },

  issueInvoiceBankSlip(invoiceId: string) {
    return request<BankSlipRecord>(
      `/finance/invoices/${invoiceId}/bank-slip/issue`,
      { method: "POST" },
    );
  },

  syncInvoiceBankSlip(invoiceId: string) {
    return request<BankSlipRecord>(`/finance/invoices/${invoiceId}/bank-slip/sync`, {
      method: "POST",
    });
  },

  cancelInvoiceBankSlip(
    invoiceId: string,
    body: { reason: InvoiceCancellationReason; note?: string },
  ) {
    return request<BankSlipRecord>(
      `/finance/invoices/${invoiceId}/bank-slip/cancel`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  downloadInvoiceBankSlipPdf(invoiceId: string) {
    return requestBlob(`/finance/invoices/${invoiceId}/bank-slip/pdf`);
  },

  syncPaidBankSlipsDay(date: string) {
    return request<SyncPaidBankSlipsDaySummary>("/finance/bank-slips/sync-paid-day", {
      method: "POST",
      body: JSON.stringify({ date }),
    });
  },

  previewBankSlipIssueBatch(payload: Omit<BankSlipIssueBatchInstitutionPayload, "source" | "createMissingInvoices"> & { page?: number; limit?: number }) {
    return request<BankSlipIssueBatchPreview>("/finance/bank-slip-issue-batches/preview", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  createBankSlipIssueBatch(payload: BankSlipIssueBatchManualPayload | BankSlipIssueBatchInstitutionPayload | string[]) {
    const body = Array.isArray(payload) ? { source: "MANUAL", invoiceIds: payload } : payload;
    return request<BankSlipIssueBatch>("/finance/bank-slip-issue-batches", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  listBankSlipIssueBatches(params?: {
    page?: number;
    limit?: number;
    source?: "MANUAL" | "INSTITUTION";
    institutionId?: string;
    competence?: string;
    shiftId?: string;
    dueDate?: string;
  }) {
    return request<ListResponse<BankSlipIssueBatch>>(
      withParams("/finance/bank-slip-issue-batches", params),
    );
  },

  getBankSlipIssueBatch(batchId: string) {
    return request<BankSlipIssueBatch>(`/finance/bank-slip-issue-batches/${batchId}`);
  },

  listBankSlipIssueBatchItems(batchId: string, params?: { page?: number; limit?: number }) {
    return request<ListResponse<BankSlipIssueBatchItem>>(
      withParams(`/finance/bank-slip-issue-batches/${batchId}/items`, params),
    );
  },

  downloadBankSlipIssueBatchZip(batchId: string) {
    return requestBlob(`/finance/bank-slip-issue-batches/${batchId}/download`);
  },

  cancelBankSlipIssueBatch(batchId: string, body: { reason?: string }) {
    return request<BankSlipIssueBatch>(
      `/finance/bank-slip-issue-batches/${batchId}/cancel`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  retryFailedBankSlipIssueBatch(batchId: string, body: { reason?: string }) {
    return request<BankSlipIssueBatch>(
      `/finance/bank-slip-issue-batches/${batchId}/retry-failed`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  listStudentCardsForStudent(studentId: string) {
    return request<{ data: StudentCardRecord[] }>(`/students/${studentId}/cards`);
  },

  downloadStudentCardPdf(
    cardId: string,
    disposition: StudentCardPdfDisposition = "inline",
  ) {
    return requestBlob(
      withParams(`/student-cards/${cardId}/pdf`, {
        disposition,
      }),
    );
  },

  previewStudentCard(
    studentId: string,
    params: { enrollmentId: string; cardType: StudentCardType },
  ) {
    return request<StudentCardPreview>(
      withParams(`/students/${studentId}/card-preview`, params),
    );
  },

  issueStudentCard(
    studentId: string,
    body: { enrollmentId: string; cardType: StudentCardType; note?: string },
  ) {
    return request<StudentCardRecord>(`/students/${studentId}/cards`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  invalidateStudentCard(
    studentId: string,
    cardId: string,
    body: { reason: StudentCardInvalidationReason; note?: string },
  ) {
    return request<StudentCardRecord>(
      `/students/${studentId}/cards/${cardId}/invalidate`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  createStudent(body: StudentPayload) {
    return request<StudentDetail>("/students", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  getStudent(id: string) {
    return request<StudentDetail>(`/students/${id}`);
  },

  updateStudentPerson(id: string, body: StudentPayload["person"]) {
    return request<StudentDetail>(`/students/${id}/person`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  updateStudentGuardian(
    id: string,
    body: { clear?: boolean; guardian?: StudentPayload["guardian"] },
  ) {
    return request<StudentDetail>(`/students/${id}/guardian`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  createEnrollment(id: string, body: StudentPayload["enrollment"]) {
    return request<EnrollmentRecord>(`/students/${id}/enrollments`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateEnrollment(
    id: string,
    enrollmentId: string,
    body: Partial<StudentPayload["enrollment"]>,
  ) {
    return request<EnrollmentRecord>(`/students/${id}/enrollments/${enrollmentId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  previewReenrollment(id: string, academicYearId?: string) {
    return request<ReenrollmentPreview>(
      withParams(`/students/${id}/reenrollment-preview`, { academicYearId }),
    );
  },

  reenrollStudent(id: string, body: ReenrollmentPayload) {
    return request<EnrollmentRecord>(`/students/${id}/reenroll`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  suspendStudent(
    id: string,
    body: {
      reason: "NON_PAYMENT" | "INFRACTION" | "OTHER";
      justification: string;
      releaseBusSeat: boolean;
    },
  ) {
    return request<StudentDetail>(`/students/${id}/suspend`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  reactivateStudent(id: string, body: { busId?: string; note?: string }) {
    return request<StudentDetail>(`/students/${id}/reactivate`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  reinstateStudent(id: string, body: ReinstateStudentPayload) {
    return request<StudentDetail>(`/students/${id}/reinstate`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  terminateStudent(
    id: string,
    body: {
      terminationReason: "WITHDRAWAL" | "NON_PAYMENT";
      justification: string;
    },
  ) {
    return request<StudentDetail>(`/students/${id}/terminate`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  listStudentHistory(id: string) {
    return request<{ data: StudentHistoryEvent[] }>(`/students/${id}/history`);
  },

  listBoardMemberships(id: string) {
    return request<{ data: BoardMembershipRecord[] }>(
      `/students/${id}/board-memberships`,
    );
  },

  startBoardMembership(id: string, body: { note?: string; role?: BoardMemberRole }) {
    return request<BoardMembershipRecord>(`/students/${id}/board-memberships`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateBoardMembershipRole(
    id: string,
    membershipId: string,
    body: { note?: string; role: BoardMemberRole },
  ) {
    return request<BoardMembershipRecord>(
      `/students/${id}/board-memberships/${membershipId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );
  },

  endBoardMembership(id: string, membershipId: string, body: { note?: string }) {
    return request<BoardMembershipRecord>(
      `/students/${id}/board-memberships/${membershipId}/end`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  listBusAssignments(
    busId: string,
    params?: {
      page?: number;
      limit?: number;
      academicYearId?: string;
      status?: "active" | "all";
      search?: string;
    },
  ) {
    return request<BusAssignmentsResponse>(
      withParams(`/buses/${busId}/assignments`, params),
    );
  },

  getCurrentBusAssignment(enrollmentId: string) {
    return request<BusAssignmentRecord | null>(
      `/enrollments/${enrollmentId}/bus-assignment`,
    );
  },

  assignBus(enrollmentId: string, body: { busId: string; note?: string }) {
    return request<BusAssignmentRecord>(
      `/enrollments/${enrollmentId}/bus-assignment`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  releaseBus(enrollmentId: string, body: { note?: string }) {
    return request<BusAssignmentRecord>(
      `/enrollments/${enrollmentId}/bus-assignment/release`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  switchBus(enrollmentId: string, body: { newBusId: string; note?: string }) {
    return request<BusAssignmentRecord>(
      `/enrollments/${enrollmentId}/bus-assignment/switch`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  listBusAssignmentEvents(enrollmentId: string) {
    return request<{ data: BusAssignmentEvent[] }>(
      `/enrollments/${enrollmentId}/bus-assignment-events`,
    );
  },

  listStudentDocuments(
    studentId: string,
    params?: { status?: StudentDocumentStatus | "all" },
  ) {
    return request<StudentDocumentsResponse>(
      withParams(`/students/${studentId}/documents`, params),
    );
  },

  uploadStudentDocument(
    studentId: string,
    documentType: StudentDocumentType,
    file: File,
  ) {
    const form = new FormData();
    form.set("documentType", documentType);
    form.set("file", file);
    return request<StudentDocumentRecord>(`/students/${studentId}/documents`, {
      method: "POST",
      body: form,
    });
  },

  getStudentDocument(studentId: string, documentId: string) {
    return request<StudentDocumentRecord>(
      `/students/${studentId}/documents/${documentId}`,
    );
  },

  replaceStudentDocument(studentId: string, documentId: string, file: File) {
    const form = new FormData();
    form.set("file", file);
    return request<StudentDocumentRecord>(
      `/students/${studentId}/documents/${documentId}/replace`,
      {
        method: "POST",
        body: form,
      },
    );
  },

  removeStudentDocument(studentId: string, documentId: string) {
    return request<StudentDocumentRecord>(
      `/students/${studentId}/documents/${documentId}/remove`,
      {
        method: "PATCH",
      },
    );
  },

  async downloadStudentDocument(
    studentId: string,
    documentId: string,
    disposition: "attachment" | "inline" = "attachment",
  ) {
    return requestBlob(
      withParams(`/students/${studentId}/documents/${documentId}/file`, {
        disposition,
      }),
    );
  },

  listStudentOfficialDocuments(studentId: string) {
    return request<OfficialDocumentsResponse>(
      `/students/${studentId}/official-documents`,
    );
  },

  listInstitutionalOfficialDocuments() {
    return request<OfficialDocumentsResponse>("/official-documents/institutional");
  },

  issueOfficialDocument(
    studentId: string,
    type: OfficialDocumentType,
    body?: IssueOfficialDocumentBody,
  ) {
    return request<OfficialDocumentIssue>(
      `/students/${studentId}/official-documents/${type}/issue`,
      {
        body: body ? JSON.stringify(body) : undefined,
        method: "POST",
      },
    );
  },

  reissueOfficialDocument(studentId: string, issueId: string) {
    return request<OfficialDocumentIssue>(
      `/students/${studentId}/official-documents/${issueId}/reissue`,
      { method: "POST" },
    );
  },

  issueInstitutionalOfficialDocument(
    type: OfficialDocumentType,
    body?: IssueInstitutionalOfficialDocumentBody,
  ) {
    return request<OfficialDocumentIssue>(
      `/official-documents/institutional/${type}/issue`,
      {
        body: body ? JSON.stringify(body) : undefined,
        method: "POST",
      },
    );
  },

  reissueInstitutionalOfficialDocument(issueId: string) {
    return request<OfficialDocumentIssue>(
      `/official-documents/institutional/${issueId}/reissue`,
      { method: "POST" },
    );
  },

  getInstitutionalOfficialDocumentIssue(issueId: string) {
    return request<OfficialDocumentIssue>(
      `/official-documents/institutional/${issueId}`,
    );
  },

  getOfficialDocumentIssue(studentId: string, issueId: string) {
    return request<OfficialDocumentIssue>(
      `/students/${studentId}/official-documents/${issueId}`,
    );
  },

  async downloadOfficialDocument(
    studentId: string,
    issueId: string,
    disposition: "attachment" | "inline" = "attachment",
  ) {
    return requestBlob(
      withParams(`/students/${studentId}/official-documents/${issueId}/file`, {
        disposition,
      }),
    );
  },

  async downloadInstitutionalOfficialDocument(
    issueId: string,
    disposition: "attachment" | "inline" = "attachment",
  ) {
    return requestBlob(
      withParams(`/official-documents/institutional/${issueId}/file`, {
        disposition,
      }),
    );
  },

  getStudentPhoto(studentId: string) {
    return request<StudentPhotoResponse>(`/students/${studentId}/photo`);
  },

  uploadOrReplaceStudentPhoto(studentId: string, file: File) {
    const form = new FormData();
    form.set("file", file);
    return request<StudentDocumentRecord>(`/students/${studentId}/photo`, {
      method: "POST",
      body: form,
    });
  },

  removeStudentPhoto(studentId: string) {
    return request<StudentDocumentRecord>(`/students/${studentId}/photo`, {
      method: "DELETE",
    });
  },

  async downloadStudentPhoto(
    studentId: string,
    disposition: "attachment" | "inline" = "inline",
  ) {
    return requestBlob(
      withParams(`/students/${studentId}/photo/file`, {
        disposition,
      }),
    );
  },

  getPreRegistrationOptions() {
    return request<PreRegistrationOptions>("/public/pre-registration/options");
  },

  createPublicPreRegistration(
    body: PublicPreRegistrationPayload,
    files: PublicPreRegistrationFiles = {},
  ) {
    const form = new FormData();
    Object.entries(body).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        form.set(key, String(value));
      }
    });
    Object.entries(files).forEach(([key, file]) => {
      if (file) {
        form.set(key, file);
      }
    });
    return request<PublicPreRegistrationResponse>("/public/pre-registrations", {
      method: "POST",
      body: form,
    });
  },

  listPreRegistrations(params?: ListPreRegistrationsParams) {
    return request<ListResponse<PreRegistrationSummary>>(
      withParams("/pre-registrations", params),
    );
  },

  getPreRegistration(id: string) {
    return request<PreRegistrationDetail>(`/pre-registrations/${id}`);
  },

  approvePreRegistration(id: string, body?: { busId?: string }) {
    return request<PreRegistrationDetail>(`/pre-registrations/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    });
  },

  rejectPreRegistration(id: string, reason: string) {
    return request<PreRegistrationDetail>(`/pre-registrations/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  async downloadPreRegistrationDocument(
    preRegistrationId: string,
    documentId: string,
    disposition: "attachment" | "inline" = "attachment",
  ) {
    const response = await fetch(
      `${API_URL}${withParams(
        `/pre-registrations/${preRegistrationId}/documents/${documentId}/file`,
        { disposition },
      )}`,
      { credentials: "include" },
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      throw new Error(body?.message ?? "Nao foi possivel baixar o documento");
    }

    return {
      blob: await response.blob(),
      fileName: fileNameFromDisposition(
        response.headers.get("content-disposition"),
      ),
    };
  },
};

function fileNameFromDisposition(value: string | null) {
  const fallback = "atretu-documento";
  if (!value) {
    return fallback;
  }
  const match = /filename="([^"]+)"/i.exec(value);
  return match?.[1] ?? fallback;
}
