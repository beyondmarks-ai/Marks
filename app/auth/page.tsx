"use client";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { firebaseReady, getAuthInstance, getGoogleProvider } from "../lib/firebase";
import { saveUserProfile } from "../lib/records";

function AuthPanel() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";

  useEffect(() => {
    if (!loading && user) {
      router.replace(nextPath);
    }
  }, [loading, nextPath, router, user]);

  const submitEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    const trimmedName = name.trim();
    if (isRegistering && trimmedName.length < 2) {
      setError("Enter your name to create an account.");
      setBusy(false);
      return;
    }

    if (isRegistering && password !== confirmPassword) {
      setError("Passwords do not match.");
      setBusy(false);
      return;
    }

    try {
      if (isRegistering) {
        const credential = await createUserWithEmailAndPassword(getAuthInstance(), email, password);
        await updateProfile(credential.user, { displayName: trimmedName });
        await saveUserProfile(credential.user.uid, trimmedName, credential.user.email ?? email);
      } else {
        await signInWithEmailAndPassword(getAuthInstance(), email, password);
      }
      router.replace(nextPath);
    } catch {
      setError("Could not sign in. Check your details and Firebase auth settings.");
    } finally {
      setBusy(false);
    }
  };

  const submitGoogle = async () => {
    setBusy(true);
    setError("");

    try {
      const credential = await signInWithPopup(getAuthInstance(), getGoogleProvider());
      await saveUserProfile(
        credential.user.uid,
        credential.user.displayName || "AERO User",
        credential.user.email ?? "",
      );
      router.replace(nextPath);
    } catch {
      setError("Google sign-in did not complete. Check Firebase provider setup.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-label="Sign in">
        <div className="auth-brand">
          <span>AERO</span>
          <p>Sign in to save chats, images, and videos.</p>
        </div>

        {!firebaseReady ? (
          <div className="auth-warning">
            Add your Firebase environment variables before signing in.
          </div>
        ) : null}

        <button className="google-button" type="button" onClick={submitGoogle} disabled={busy}>
          Continue with Google
        </button>

        <form className="auth-form" onSubmit={submitEmail}>
          {isRegistering ? (
            <input
              aria-label="Name"
              autoComplete="name"
              placeholder="Name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          ) : null}
          <input
            aria-label="Email"
            autoComplete="email"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            aria-label="Password"
            autoComplete={isRegistering ? "new-password" : "current-password"}
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {isRegistering ? (
            <input
              aria-label="Confirm password"
              autoComplete="new-password"
              placeholder="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          ) : null}
          <button type="submit" disabled={busy}>
            {isRegistering ? "Create account" : "Sign in"}
          </button>
        </form>

        {error ? <div className="auth-error">{error}</div> : null}

        <button
          className="auth-switch"
          type="button"
          onClick={() => {
            setIsRegistering((value) => !value);
            setConfirmPassword("");
            setError("");
          }}
        >
          {isRegistering ? "Use an existing account" : "Create a new account"}
        </button>
      </section>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <section className="auth-panel">
            <div className="loading-mark">AERO</div>
          </section>
        </main>
      }
    >
      <AuthPanel />
    </Suspense>
  );
}
