import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import axios from "axios";

/**
 * Global axios interceptor that attaches the Clerk JWT
 * as Authorization: Bearer <token> on every outgoing request.
 */
export default function AxiosInterceptor({ children }) {
  const { getToken, isSignedIn } = useAuth();
  const interceptorId = useRef(null);

  useEffect(() => {
    // Eject previous interceptor if any
    if (interceptorId.current !== null) {
      axios.interceptors.request.eject(interceptorId.current);
    }

    interceptorId.current = axios.interceptors.request.use(
      async (config) => {
        if (isSignedIn) {
          try {
            const token = await getToken();
            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
            }
          } catch {
            // Token fetch failed — request proceeds without auth
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => {
      if (interceptorId.current !== null) {
        axios.interceptors.request.eject(interceptorId.current);
      }
    };
  }, [getToken, isSignedIn]);

  return children;
}
