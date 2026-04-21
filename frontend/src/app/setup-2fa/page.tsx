"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Smartphone, KeyRound } from "lucide-react";
import { apiPost, saveAuth, getUser, StoredUser } from "../../lib/auth";
import styles from "../auth.module.css";

type Stage = "reauth" | "show_qr" | "done";

export default function Setup2FAPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("reauth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Prefill email if user is partially logged in
  useEffect(() => {
    const u = getUser();
    if (u?.email) setEmail(u.email);
  }, []);

  async function handleReauth(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await apiPost<any>("/api/auth/totp/setup", { email, password });
      setQr(res.qr_data_url);
      setSecret(res.secret);
      setStage("show_qr");
    } catch (e: any) {
      setErr(e.message || "Could not start 2FA setup");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
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
      setStage("done");
      setTimeout(() => router.push("/"), 1500);
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

        {stage === "reauth" && (
          <>
            <div className={styles.stepTag}>STEP 1 / 2</div>
            <h1 className={styles.title}>
              <ShieldCheck size={22} style={{ display: "inline", marginRight: 8 }} />
              ENABLE 2FA
            </h1>
            <div className={styles.subtitle}>
              Confirm your password to generate a fresh Authenticator secret
            </div>

            {err && <div className={styles.error}>{err}</div>}

            <form onSubmit={handleReauth}>
              <label className={styles.field}>
                <span className={styles.label}>Email</span>
                <input
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Password</span>
                <input
                  className={styles.input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <button className={styles.button} type="submit" disabled={loading}>
                {loading ? "GENERATING..." : "GENERATE QR"}
              </button>
            </form>
          </>
        )}

        {stage === "show_qr" && (
          <>
            <div className={styles.stepTag}>STEP 2 / 2</div>
            <h1 className={styles.title}>
              <Smartphone size={22} style={{ display: "inline", marginRight: 8 }} />
              SCAN WITH AUTHENTICATOR
            </h1>
            <div className={styles.subtitle}>
              Open Google Authenticator / Authy and scan this code
            </div>

            {err && <div className={styles.error}>{err}</div>}

            {qr && (
              <div className={styles.qrWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="Scan with Google Authenticator" />
              </div>
            )}

            {secret && (
              <>
                <div className={styles.helpText}>
                  If you can&apos;t scan, enter this key manually:
                </div>
                <div className={styles.secretBox}>{secret}</div>
              </>
            )}

            <form onSubmit={handleVerify}>
              <label className={styles.field}>
                <span className={styles.label}>6-digit Code</span>
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
                <KeyRound size={14} style={{ display: "inline", marginRight: 8 }} />
                {loading ? "VERIFYING..." : "ACTIVATE 2FA"}
              </button>
            </form>
          </>
        )}

        {stage === "done" && (
          <>
            <h1 className={styles.title}>
              <ShieldCheck size={22} style={{ display: "inline", marginRight: 8 }} />
              2FA ACTIVE
            </h1>
            <div className={styles.success}>
              2FA is enabled. Redirecting to your SOC console...
            </div>
          </>
        )}
      </div>
    </div>
  );
}
