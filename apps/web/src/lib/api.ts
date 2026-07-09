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
};
