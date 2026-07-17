import { mapApiErrorMessage } from "./formatters";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "INACTIVE";
  roles: Array<"SUPER_ADMIN" | "SECRETARIA">;
};

export type AuthResponse = {
  user: ApiUser;
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

export type ListRecordsParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: "active" | "inactive" | "all";
  sort?: "name" | "status" | "createdAt" | "updatedAt";
  order?: "asc" | "desc";
  academicYearId?: string;
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
  page?: number;
  limit?: number;
  search?: string;
  status?: PreRegistrationStatus;
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
  status?: "active" | "suspended" | "terminated" | "all";
  sort?: "cardNumber" | "name" | "joinedAt" | "createdAt";
  order?: "asc" | "desc";
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
  createdAt: string;
  updatedAt: string;
};

export type BankSlipSummary = {
  id: string;
  status: BankSlipStatus;
  nossoNumeroMasked?: string | null;
  issuedAt?: string | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
  lastCheckedAt?: string | null;
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
  status: BankSlipIssueBatchStatus;
  requestedByUserId: string;
  cancelledByUserId?: string | null;
  cancelReason?: string | null;
  totalItems: number;
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
    source?: "MANUAL" | "INSTITUTION";
    filters?: {
      institutionId?: string;
      institutionName?: string;
      competence?: string;
      shiftId?: string | null;
      dueDate?: string | null;
    };
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
  totalEnrollmentsFound: number;
  totalStudentsFound: number;
  totalInvoicesFound: number;
  totalEligible: number;
  totalAlreadyPaid: number;
  totalWithActiveBankSlip: number;
  totalWithCancelledBankSlipAllowsNewIssue: number;
  totalMissingInvoice: number;
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
  competence: string;
  shiftId?: string;
  dueDate?: string;
};

export type BankSlipIssueBatchManualPayload = {
  source?: "MANUAL";
  invoiceIds: string[];
};

export type BankSlipIssueBatchItem = {
  id: string;
  batchId: string;
  invoiceId: string;
  bankSlipId?: string | null;
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
  sort?: "dueDate" | "createdAt" | "amount" | "studentName";
  order?: "asc" | "desc";
};

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(mapApiErrorMessage(body?.message));
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
      | { message?: string }
      | null;
    throw new Error(mapApiErrorMessage(body?.message));
  }

  return {
    blob: await response.blob(),
    fileName: fileNameFromDisposition(response.headers.get("content-disposition")),
  };
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
    });
  },

  me() {
    return request<AuthResponse>("/auth/me");
  },

  logout() {
    return request<{ ok: true }>("/auth/logout", {
      method: "POST",
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

  listStudents(params?: ListStudentsParams) {
    return request<ListResponse<StudentSummary>>(withParams("/students", params));
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

  listInvoices(params?: ListInvoicesParams) {
    return request<ListResponse<InvoiceRecord>>(
      withParams("/finance/invoices", params),
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

  previewBankSlipIssueBatch(payload: Omit<BankSlipIssueBatchInstitutionPayload, "source"> & { page?: number; limit?: number }) {
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

  listBankSlipIssueBatches(params?: { page?: number; limit?: number }) {
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

  startBoardMembership(id: string, body: { note?: string }) {
    return request<BoardMembershipRecord>(`/students/${id}/board-memberships`, {
      method: "POST",
      body: JSON.stringify(body),
    });
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
