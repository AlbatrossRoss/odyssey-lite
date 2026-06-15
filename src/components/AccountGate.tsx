"use client";

import Image from "next/image";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { ImagePlus, LogIn } from "lucide-react";
import {
  AppAccount,
  createAccount,
  fetchAccountById,
  loginAccount,
  readAccountSessionId,
  writeAccountSessionId,
} from "@/lib/accounts";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type AccountGateProps = {
  children: ReactNode;
};

type Mode = "create" | "login";

export function AccountGate({ children }: AccountGateProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [account, setAccount] = useState<AppAccount | null>(null);
  const [mode, setMode] = useState<Mode>("create");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"ready" | "saving">("ready");
  const [restoreStatus, setRestoreStatus] = useState<"checking" | "ready">("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const accountId = readAccountSessionId();

      if (!accountId || !isSupabaseConfigured()) {
        if (active) {
          setRestoreStatus("ready");
        }
        return;
      }

      try {
        const restored = await withTimeout(fetchAccountById(accountId), 2500);

        if (active) {
          setAccount(restored);
        }
      } catch {
        // Let the user log in again if session restore fails.
      } finally {
        if (active) {
          setRestoreStatus("ready");
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!username.trim() || !password.trim()) {
      setMessage("Enter a username and password.");
      return;
    }

    setStatus("saving");

    try {
      const nextAccount =
        mode === "create"
          ? await createAccount({ username, password, profilePhotoUrl: photoUrl })
          : await loginAccount(username, password);

      if (!nextAccount) {
        setMessage("No account matched that username and password.");
        setStatus("ready");
        return;
      }

      writeAccountSessionId(nextAccount.id);
      setAccount(nextAccount);
      setStatus("ready");
    } catch (error) {
      const errorMessage = formatError(error);
      setMessage(errorMessage.includes("duplicate") ? "That username is already taken." : errorMessage);
      setStatus("ready");
    }
  }

  async function handlePhotoSelect(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    setPhotoUrl(await fileToDataUrl(file));
  }

  if (account) {
    return children;
  }

  if (restoreStatus === "checking") {
    return <LoadingScreen />;
  }

  return (
    <main className="min-h-[100dvh] bg-shell px-5 py-8 text-ink sm:flex sm:items-center sm:justify-center">
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[393px] flex-col justify-between overflow-hidden rounded-[34px] bg-white shadow-soft sm:min-h-[760px]">
        <div className="relative h-56 overflow-hidden bg-[#dfe8e3]">
          <div className="absolute inset-0 bg-[url('/hawaii-reference-map.png')] bg-cover bg-center opacity-75" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-white" />
          <div className="absolute left-6 top-7">
            <Image alt="Odyssey Lite" className="h-16 w-16 rounded-[18px] shadow-lift" height={64} src="/icon-192.png" width={64} priority />
          </div>
        </div>

        <form className="-mt-8 flex flex-1 flex-col px-6 pb-7" onSubmit={handleSubmit}>
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-coral">Odyssey Lite</p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-ink">
              {mode === "create" ? "Create your account" : "Welcome back"}
            </h1>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-full bg-shell p-1">
            {(["create", "login"] as Mode[]).map((option) => (
              <button
                className={`h-10 rounded-full text-sm font-black capitalize transition ${
                  mode === option ? "bg-ink text-white shadow-lift" : "text-ink/58"
                }`}
                key={option}
                onClick={() => {
                  setMode(option);
                  setMessage("");
                }}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>

          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-bold text-ink/70">Username</span>
            <input
              autoCapitalize="none"
              autoComplete="username"
              className="h-14 w-full rounded-2xl border border-ink/10 bg-shell px-4 text-base font-bold text-ink outline-none focus:border-coral"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="maya"
              value={username}
            />
          </label>

          <label className="mb-5 block">
            <span className="mb-1 block text-sm font-bold text-ink/70">Password</span>
            <input
              autoComplete={mode === "create" ? "new-password" : "current-password"}
              className="h-14 w-full rounded-2xl border border-ink/10 bg-shell px-4 text-base font-bold text-ink outline-none focus:border-coral"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="password"
              type="password"
              value={password}
            />
          </label>

          {mode === "create" ? (
            <div className="mb-5 flex items-center gap-3">
              <button
                aria-label="Add profile photo"
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-shell text-ink/58 ring-1 ring-ink/8"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="h-full w-full object-cover" src={photoUrl} />
                ) : (
                  <ImagePlus aria-hidden="true" size={23} />
                )}
              </button>
              <div>
                <p className="text-sm font-black text-ink">Profile photo</p>
                <p className="text-xs font-semibold leading-relaxed text-ink/52">Optional for now. You can add or change it later.</p>
              </div>
              <input
                accept="image/*"
                className="hidden"
                onChange={(event) => void handlePhotoSelect(event.target.files?.[0])}
                ref={fileInputRef}
                type="file"
              />
            </div>
          ) : null}

          {message ? <p className="mb-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{message}</p> : null}

          <button
            className="mt-auto flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-base font-black text-white shadow-lift disabled:opacity-60"
            disabled={status === "saving"}
            type="submit"
          >
            <LogIn aria-hidden="true" size={20} />
            {status === "saving" ? "Saving..." : mode === "create" ? "Create Account" : "Log In"}
          </button>
        </form>
      </section>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-shell px-5 text-ink">
      <section className="flex w-full max-w-[393px] flex-col items-center rounded-[34px] bg-white px-8 py-12 text-center shadow-soft">
        <Image alt="Odyssey Lite" className="h-20 w-20 rounded-[22px] shadow-lift" height={80} src="/icon-192.png" width={80} priority />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-coral">Odyssey Lite</p>
        <h1 className="mt-2 text-2xl font-black text-ink">Loading your map</h1>
        <div className="mt-8 h-2 w-full overflow-hidden rounded-full bg-shell">
          <div className="h-full w-2/5 rounded-full bg-coral motion-safe:animate-[odyssey-loading_1.2s_ease-in-out_infinite]" />
        </div>
      </section>
    </main>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race<T | null>([
    promise,
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; details?: unknown; code?: unknown };
    const message = typeof candidate.message === "string" ? candidate.message : undefined;
    const details = typeof candidate.details === "string" ? candidate.details : undefined;
    const code = typeof candidate.code === "string" ? candidate.code : undefined;

    return [message, details, code].filter(Boolean).join(" ") || "Something went wrong.";
  }

  return "Something went wrong.";
}
