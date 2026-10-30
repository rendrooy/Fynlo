const ACCESS_TOKEN_KEY = "fynlo_access_token";

export const AUTH_SESSION_CLEARED_EVENT = "fynlo_auth_session_cleared";

export const getAccessToken = () => {
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAccessToken = (token: string) => {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
};

export const clearAccessToken = () => {
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // Nothing is stored when storage is unavailable.
  }
};
