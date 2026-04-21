"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Lock, KeyRound } from "lucide-react";
import { apiPost, saveAuth, StoredUser } from "../../lib/auth";
import styles from "../auth.module.css";

type Stage = "password" | "totp";

export default function LoginPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await apiPost<any>("/api/auth/login", { email, password });
      if (res.status === "totp_required") {
        setStage("totp");
      } else if (res.status === "ok") {
        const user: StoredUser = {
          email: email.toLowerCase(),
          name: res.name || email,
          role: res.role || "analyst",
          totp_enabled: res.totp_enabled || false,
        };
        saveAuth(res.token, user);
        // No 2FA yet — push them to setup
        if (!user.totp_enabled) {
          router.push("/setup-2fa");
        } else {
          router.push("/");
        }
      }
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleTotp(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await apiPost<any>("/api/auth/totp/verify", { email, code });
      const user: StoredUser = {
        email: email.toLowerCase(),
        name: res.name || email,
        role: res.role || "analyst",
        totp_enabled: true,
      };
      saveAuth(res.token, user);
      router.push("/");
    } catch (e: any) {
      setErr(e.message || "Invalid 2FA code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.badge}>
          <span className={styles.badgeDot} />
          <span>CYBERSOC</span>
        </div>

        {stage === "password" ? (
          <>
            <h1 className={styles.title}>
              <Shield size={22} style={{ display: "inline", marginRight: 8 }} />
              ACCESS CONTROL
            </h1>
            <div className={styles.subtitle}>Sign in to your command console</div>

            {err && <div className={styles.error}>{err}</div>}

            <form onSubmit={handlePassword}>
              <label className={styles.field}>
                <span className={styles.label}>Operator Email</span>
                <input
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@cybersoc.local"
                  required
                  autoFocus
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Password</span>
                <input
                  className={styles.input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </label>

              <button className={styles.button} type="submit" disabled={loading}>
                <Lock size={14} style={{ display: "inline", marginRight: 8 }} />
                {loading ? "AUTHENTICATING..." : "ENTER"}
              </button>
            </form>

            <div className={styles.link}>
              No account?<Link href="/register">Register</Link>
            </div>
          </>
        ) : (
          <>
            <h1 className={styles.title}>
              <KeyRound size={22} style={{ display: "inline", marginRight: 8 }} />
              2FA VERIFY
            </h1>
            <div className={styles.subtitle}>
              Enter the 6-digit code from Google Authenticator
            </div>

            {err && <div className={styles.error}>{err}</div>}

            <form onSubmit={handleTotp}>
              <label className={styles.field}>
                <span className={styles.label}>Authenticator Code</span>
                <input
                  className={styles.codeInput}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  required
                  autoFocus
                />
              </label>

              <button
                className={styles.button}
                type="submit"
                disabled={loading || code.length !== 6}
              >
                {loading ? "VERIFYING..." : "CONFIRM"}
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.secondary}`}
                onClick={() => {
                  setStage("password");
                  setCode("");
                  setErr(null);
                }}
              >
                BACK
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
