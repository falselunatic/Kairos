"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { BrandName } from "@/components/BrandName";
import styles from "../auth.module.css";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"form" | "otp">("form");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (!email.trim()) return "Enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
    if (!password) return "Choose a password.";
    if (password.length < 6) return "Password needs to be at least 6 characters.";
    return null;
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Supabase returns a user object with no identities (rather than an error) when
    // the email is already registered, to avoid leaking which emails exist.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("An account with this email already exists. Try logging in instead.");
      return;
    }
    setStage("otp");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!otp.trim()) {
      setError("Enter the verification code.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "signup" });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  return (
    <div className={styles.container}>
      <div className={styles.title}>
        Create your <BrandName /> account
      </div>
      <div className={styles.subtitle}>
        {stage === "form"
          ? "Sign up to start building a companion that remembers you."
          : `Enter the code we emailed to ${email}.`}
      </div>

      {stage === "form" ? (
        <form className={styles.form} onSubmit={handleSignup} noValidate>
          <input
            className={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={styles.input}
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div className={styles.error}>{error}</div>}
          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Sign up"}
          </button>
          <div className={styles.divider}>or</div>
          <button type="button" className={styles.googleButton} onClick={handleGoogle}>
            Continue with Google
          </button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={handleVerify} noValidate>
          <input
            className={styles.input}
            type="text"
            inputMode="numeric"
            placeholder="Verification code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          {error && <div className={styles.error}>{error}</div>}
          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Verify & continue"}
          </button>
        </form>
      )}

      <div className={styles.switchLink}>
        Already have an account? <a href="/login">Log in</a>
      </div>
    </div>
  );
}
