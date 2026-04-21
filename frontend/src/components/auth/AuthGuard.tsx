"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser, StoredUser } from "../../lib/auth";

interface AuthGuardProps {
  children: (user: StoredUser) => React.ReactNode;
}

/**
 * Client-side guard. On mount, checks localStorage for a token.
 * - No token → redirect to /login
 * - Token present → render children with the user context
 *
 * While we're verifying, render a minimal splash so we don't flash protected UI.
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    const u = getUser();
    if (!token || !u) {
      router.replace("/login");
      return;
    }
    setUser(u);
    setReady(true);
  }, [router]);

  if (!ready || !user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050505",
          color: "#ff1a1a",
          fontFamily: '"Orbitron", sans-serif',
          letterSpacing: "4px",
          fontSize: "0.9rem",
        }}
      >
        VERIFYING ACCESS...
      </div>
    );
  }

  return <>{children(user)}</>;
}
