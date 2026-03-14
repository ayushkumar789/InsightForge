import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Syncs Clerk user profile to the backend database after sign-in.
 * Runs once per session (tracked via sessionStorage).
 */
export default function UserSync({ children }) {
  const { isSignedIn, getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!isSignedIn || !isLoaded || !user || syncedRef.current) return;

    // Check if already synced this session
    const syncKey = `clerk_synced_${user.id}`;
    if (sessionStorage.getItem(syncKey)) {
      syncedRef.current = true;
      return;
    }

    const sync = async () => {
      try {
        const token = await getToken();
        await axios.post(
          `${API}/auth/sync`,
          {
            email: user.primaryEmailAddress?.emailAddress || "",
            name: user.fullName || user.firstName || "",
            picture: user.imageUrl || null,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        sessionStorage.setItem(syncKey, "1");
        syncedRef.current = true;
      } catch (e) {
        console.error("User sync failed:", e);
      }
    };
    sync();
  }, [isSignedIn, isLoaded, user, getToken]);

  return children;
}
