"use client";

import { Button } from "@fynlo/ui/components/button";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/providers/auth-provider";
import { ApiError } from "@/services/api";

export default function PageContent() {
  const router = useRouter();
  const { signIn, status } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [router, status]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Something went wrong. Please try again.",
      );
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card card">
        <div className="brand auth-brand">
          <div className="brandmark">F</div>
          <div>
            <strong>fynlo</strong>
            <span>Personal finance tracker</span>
          </div>
        </div>
        <h1>Sign in</h1>
        <p>Keep an eye on your finances in one place.</p>

        <form noValidate onSubmit={submit}>
          <label>
            Email
            <input
              autoComplete="username"
              autoFocus
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <span className="auth-password">
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
                type="button"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" size={18} />
                ) : (
                  <Eye aria-hidden="true" size={18} />
                )}
              </button>
            </span>
          </label>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <Button disabled={submitting} type="submit">
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
