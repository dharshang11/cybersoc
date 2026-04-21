"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, Shield } from "lucide-react";
import { apiPost } from "../../lib/auth";
import styles from "../auth.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);

    if (password !== confirm) {
      setErr("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await apiPost("/api/auth/register", { email, password, name });
      // After register, drop straight into login — then 2FA setup
      router.push(`/login?registered=1&email=${encodeURIComponent(email)}`);
    } catch (e: any) {
      setErr(e.message || "Registration failed");
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

        <h1 className={styles.title}>
          <UserPlus size={22} style={{ display: "inline", marginRight: 8 }} />
          CREATE OPERATOR
        </h1>
        <div className={styles.subtitle}>
          Register a new analyst account
        </div>

        {err && <div className={styles.error}>{err}</div>}

        <form onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Callsign / Name</span>
            <input
              className={styles.input}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dharshan"
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="analyst@cybersoc.local"
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Password (min 6)</span>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Confirm Password</span>
            <input
              className={styles.input}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </label>

          <button className={styles.button} type="submit" disabled={loading}>
            <Shield size={14} style={{ display: "inline", marginRight: 8 }} />
            {loading ? "CREATING..." : "REGISTER"}
          </button>
        </form>

        <div className={styles.link}>
          Already have an account?<Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
