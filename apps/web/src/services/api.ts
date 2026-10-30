import type {
  AccountInputInterface,
  AccountInterface,
  AccountTypeInterface,
  AuthUserInterface,
  LoginResponseInterface,
} from "@fynlo/types";

import {
  AUTH_SESSION_CLEARED_EVENT,
  clearAccessToken,
  getAccessToken,
} from "@/utils/auth-storage";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}) {
  const token = getAccessToken();
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Please try again.");
  }

  const body = (await response.json().catch(() => null)) as null | {
    data?: T;
    message?: string;
  };

  if (!response.ok) {
    // A rejected token means the session is over everywhere in the app.
    if (response.status === 401 && token) {
      clearAccessToken();
      window.dispatchEvent(new Event(AUTH_SESSION_CLEARED_EVENT));
    }
    throw new ApiError(
      response.status,
      body?.message || "Something went wrong. Please try again.",
    );
  }
  return body?.data as T;
}

export const loginRequest = (email: string, password: string) =>
  request<LoginResponseInterface>("/auth/login", {
    body: JSON.stringify({ email, password }),
    method: "POST",
  });

export const getProfileRequest = () => request<AuthUserInterface>("/auth/me");

export const listAccountTypesRequest = () =>
  request<AccountTypeInterface[]>("/account-types");

export const createAccountTypeRequest = (name: string) =>
  request<AccountTypeInterface>("/account-types", {
    body: JSON.stringify({ name }),
    method: "POST",
  });

export const renameAccountTypeRequest = (id: string, name: string) =>
  request<AccountTypeInterface>(`/account-types/${id}`, {
    body: JSON.stringify({ name }),
    method: "PATCH",
  });

export const deleteAccountTypeRequest = (id: string) =>
  request<undefined>(`/account-types/${id}`, { method: "DELETE" });

export const listAccountsRequest = () =>
  request<AccountInterface[]>("/accounts");

export const createAccountRequest = (input: AccountInputInterface) =>
  request<AccountInterface>("/accounts", {
    body: JSON.stringify(input),
    method: "POST",
  });

export const updateAccountRequest = (
  id: string,
  changes: Partial<AccountInputInterface> & { isExcluded?: boolean },
) =>
  request<AccountInterface>(`/accounts/${id}`, {
    body: JSON.stringify(changes),
    method: "PATCH",
  });

export const deleteAccountRequest = (id: string) =>
  request<undefined>(`/accounts/${id}`, { method: "DELETE" });
