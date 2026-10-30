import type { AuthUserInterface, LoginResponseInterface } from "@fynlo/types";

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
