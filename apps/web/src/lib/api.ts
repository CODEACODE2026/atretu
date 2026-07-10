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
};

export type ListResponse<T> = {
  data: T[];
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
};

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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

function withParams(path: string, params: ListRecordsParams = {}) {
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
};
