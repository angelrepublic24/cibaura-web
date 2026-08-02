import axios, { AxiosError } from "axios";
import { API_URL } from "@/lib/config";
import { clearAccessToken, getAccessToken } from "@/shared/auth/token";

/**
 * Single axios instance for the whole app (mirrors Beusun `global/Global.ts`).
 * - `withCredentials` supports a cookie-based session if the backend uses one.
 * - A Bearer header is attached when a token exists in local storage.
 */
export const Api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

Api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Surface the backend's error message on `error.message` so callers that
 * read `e?.message` get the real NestJS message instead of a generic
 * "Request failed with status code 400". The original AxiosError is
 * preserved, so `e.response.data` still works.
 *
 * On 401 the stale token is dropped so the auth guard can redirect to
 * login instead of looping on a dead session.
 */
Api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string | string[] }>) => {
    const data = error.response?.data;
    const backendMessage = Array.isArray(data?.message)
      ? data?.message.join(", ")
      : data?.message;
    if (backendMessage) error.message = backendMessage;

    if (error.response?.status === 401) clearAccessToken();

    return Promise.reject(error);
  },
);
