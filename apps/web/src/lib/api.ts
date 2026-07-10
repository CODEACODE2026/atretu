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
  createdAt: string;
  updatedAt: string;
};

export type StudentSummary = {
  id: string;
  status: "ACTIVE";
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
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
  endReason?: "RELEASED" | "SWITCHED" | null;
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
  eventType: "LINKED" | "RELEASED" | "SWITCHED";
  note?: string | null;
  occurredAt: string;
  fromBus?: BusRecord | null;
  toBus?: BusRecord | null;
};

export type StudentDocumentType =
  | "CPF"
  | "RG"
  | "PROOF_OF_ADDRESS"
  | "PROOF_OF_ENROLLMENT";

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
};

export type ListStudentsParams = {
  page?: number;
  limit?: number;
  search?: string;
  academicYearId?: string;
  institutionId?: string;
  shiftId?: string;
  sort?: "name" | "joinedAt" | "createdAt";
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
    throw new Error(body?.message ?? "Nao foi possivel concluir a operacao");
  }

  return response.json() as Promise<T>;
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

  listAcademicYears() {
    return request<{ data: AcademicYear[] }>("/academic-years");
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

  listStudents(params?: ListStudentsParams) {
    return request<ListResponse<StudentSummary>>(withParams("/students", params));
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
    const response = await fetch(
      `${API_URL}${withParams(
        `/students/${studentId}/documents/${documentId}/file`,
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
