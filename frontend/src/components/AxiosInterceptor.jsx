import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import axios from "axios";

/**
 * Global axios interceptor that attaches the Clerk JWT
 * as Authorization: Bearer <token> on every outgoing request.
 * Uses refs to avoid stale closure issues.
 */
export default function AxiosInterceptor({ children }) {
  const { getToken, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  const isSignedInRef = useRef(isSignedIn);

  // Keep refs current without re-registering interceptor
  useEffect(() => {
    getTokenRef.current = getToken;
    isSignedInRef.current = isSignedIn;
  }, [getToken, isSignedIn]);

  useEffect(() => {
    const id = axios.interceptors.request.use(
      async (config) => {
        if (isSignedInRef.current) {
          try {
            const token = await getTokenRef.current();
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
      axios.interceptors.request.eject(id);
    };
  }, []); // Register once, use refs for latest values

  return children;
}
