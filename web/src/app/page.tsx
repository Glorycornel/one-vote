"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { extractPollId } from "@/lib/poll-links";

const DEFAULT_OPTIONS = ["", ""];

// Neon-glass palette (matches your background + logo)
const GLOW_CYAN = "rgba(79,255,216,0.35)";
const GLOW_CYAN_STRONG = "rgba(79,255,216,0.55)";

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(DEFAULT_OPTIONS);
  const [joinId, setJoinId] = useState("");
  const [allowAnonymousVotes, setAllowAnonymousVotes] = useState(true);
  const [collectVoterEmail, setCollectVoterEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [sessionUser, setSessionUser] = useState<{
    id: string;
    email: string;
    name?: string | null;
  } | null>(null);

  const [sessionLoading, setSessionLoading] = useState(true);

  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMyPollsOpen, setIsMyPollsOpen] = useState(false);
  const [isJoinedPollsOpen, setIsJoinedPollsOpen] = useState(false);
  const [isVotersModalOpen, setIsVotersModalOpen] = useState(false);
  const [sidebarRight, setSidebarRight] = useState<number | null>(null);
  const sidebarButtonRef = useRef<HTMLButtonElement | null>(null);

  const [pollsLoading, setPollsLoading] = useState(false);
  const [pollsLoaded, setPollsLoaded] = useState(false);
  const [pollsError, setPollsError] = useState<string | null>(null);
  const [polls, setPolls] = useState<
    {
      id: string;
      question: string;
      createdAt: string;
      totalVotes: number;
      isOpen: boolean;
      allowAnonymousVotes: boolean;
      collectVoterEmail: boolean;
      identifiedVotes: number;
      anonymousVotes: number;
    }[]
  >([]);
  const [pollActionId, setPollActionId] = useState<string | null>(null);

  const [joinedPolls, setJoinedPolls] = useState<
    { id: string; question: string; joinedAt: string }[]
  >([]);
  const [joinedPollsLoading, setJoinedPollsLoading] = useState(false);
  const [joinedPollsLoaded, setJoinedPollsLoaded] = useState(false);
  const [joinedPollsError, setJoinedPollsError] = useState<string | null>(null);
  const [selectedVotersPoll, setSelectedVotersPoll] = useState<{
    id: string;
    question: string;
  } | null>(null);
  const [votersLoading, setVotersLoading] = useState(false);
  const [votersError, setVotersError] = useState<string | null>(null);
  const [voters, setVoters] = useState<
    { email: string; optionText: string; votedAt: string }[]
  >([]);
  const [pollStatusFilter, setPollStatusFilter] = useState<"all" | "open" | "closed">(
    (searchParams.get("status") as "all" | "open" | "closed") || "all",
  );
  const [pollSortField, setPollSortField] = useState<"createdAt" | "totalVotes">(
    (searchParams.get("sort") as "createdAt" | "totalVotes") || "createdAt",
  );
  const [pollSortOrder, setPollSortOrder] = useState<"desc" | "asc">(
    (searchParams.get("order") as "desc" | "asc") || "desc",
  );
  const [pollFromDate, setPollFromDate] = useState(searchParams.get("from") ?? "");
  const [pollToDate, setPollToDate] = useState(searchParams.get("to") ?? "");
  const [pollMinVotes, setPollMinVotes] = useState(searchParams.get("minVotes") ?? "");
  const [pollMaxVotes, setPollMaxVotes] = useState(searchParams.get("maxVotes") ?? "");
  const [pollQuery, setPollQuery] = useState(searchParams.get("q") ?? "");

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((option, i) => (i === index ? value : option)));
  };

  const addOption = () => setOptions((prev) => [...prev, ""]);

  const formatJoinedDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Unknown date";
    return parsed.toLocaleDateString();
  };

  const formatVoteDateTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Unknown time";
    return parsed.toLocaleString();
  };

  const handleCreate = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          options,
          allowAnonymousVotes,
          collectVoterEmail,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create poll.");
      }

      const data = (await response.json()) as { pollId: string };
      setAllowAnonymousVotes(true);
      setCollectVoterEmail(false);
      router.push(`/poll/${data.pollId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadSession = async () => {
    try {
      const response = await fetch("/api/auth/session");
      const data = (await response.json()) as {
        user: { id: string; email: string; name?: string | null } | null;
      };
      setSessionUser(data.user);
    } catch {
      setSessionUser(null);
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    void loadSession();
  }, []);

  const handleAuthSubmit = async () => {
    setAuthError(null);
    if (authMode === "signup" && authPassword !== authConfirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }
    setAuthSubmitting(true);
    try {
      const response = await fetch(
        authMode === "signup" ? "/api/auth/signup" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: authEmail,
            password: authPassword,
            confirmPassword: authMode === "signup" ? authConfirmPassword : undefined,
            name: authMode === "signup" ? authName : undefined,
          }),
        },
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to authenticate.");
      }

      const data = (await response.json()) as {
        user: { id: string; email: string; name?: string | null };
      };
      setSessionUser(data.user);
      setAuthPassword("");
      setAuthConfirmPassword("");
      setAuthError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to authenticate.";
      setAuthError(message);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setSessionUser(null);
    setPolls([]);
    setJoinedPolls([]);
    setPollsLoaded(false);
    setJoinedPollsLoaded(false);
  };

  const updatePollStatus = async (pollId: string, nextIsOpen: boolean) => {
    if (!sessionUser) return;

    setPollsError(null);
    setPollActionId(pollId);

    const previousIsOpen = polls.find((p) => p.id === pollId)?.isOpen;
    setPolls((prev) =>
      prev.map((p) => (p.id === pollId ? { ...p, isOpen: nextIsOpen } : p)),
    );

    try {
      const response = await fetch(`/api/polls/${pollId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: nextIsOpen }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to update poll status.");
      }

      const data = (await response.json()) as { isOpen: boolean };
      setPolls((prev) =>
        prev.map((p) => (p.id === pollId ? { ...p, isOpen: data.isOpen } : p)),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to update poll status.";
      setPollsError(message);

      if (typeof previousIsOpen === "boolean") {
        setPolls((prev) =>
          prev.map((p) => (p.id === pollId ? { ...p, isOpen: previousIsOpen } : p)),
        );
      }
    } finally {
      setPollActionId(null);
    }
  };

  const openVotersModal = async (pollId: string, question: string) => {
    if (!sessionUser) return;

    setSelectedVotersPoll({ id: pollId, question });
    setVoters([]);
    setVotersError(null);
    setVotersLoading(true);
    setIsVotersModalOpen(true);

    try {
      const response = await fetch(`/api/polls/${pollId}/voters`);
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to load voters.");
      }
      const data = (await response.json()) as {
        voters: { email: string; optionText: string; votedAt: string }[];
      };
      setVoters(data.voters);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load voters.";
      setVotersError(message);
    } finally {
      setVotersLoading(false);
    }
  };

  const getMyPollQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (pollStatusFilter !== "all") params.set("status", pollStatusFilter);
    if (pollSortField !== "createdAt") params.set("sort", pollSortField);
    if (pollSortOrder !== "desc") params.set("order", pollSortOrder);
    if (pollFromDate) params.set("from", pollFromDate);
    if (pollToDate) params.set("to", pollToDate);
    if (pollMinVotes.trim()) params.set("minVotes", pollMinVotes.trim());
    if (pollMaxVotes.trim()) params.set("maxVotes", pollMaxVotes.trim());
    if (pollQuery.trim()) params.set("q", pollQuery.trim());
    return params;
  }, [
    pollFromDate,
    pollMaxVotes,
    pollMinVotes,
    pollQuery,
    pollSortField,
    pollSortOrder,
    pollStatusFilter,
    pollToDate,
  ]);

  const loadMyPolls = useCallback(async () => {
    if (!sessionUser) return;
    setPollsLoading(true);
    setPollsError(null);
    try {
      const params = getMyPollQueryParams();
      const query = params.toString();
      const response = await fetch(
        query ? `/api/polls/mine?${query}` : "/api/polls/mine",
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to load polls.");
      }
      const data = (await response.json()) as {
        polls: {
          id: string;
          question: string;
          createdAt: string;
          totalVotes: number;
          isOpen: boolean;
          allowAnonymousVotes: boolean;
          collectVoterEmail: boolean;
          identifiedVotes: number;
          anonymousVotes: number;
        }[];
      };
      setPolls(data.polls);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load polls.";
      setPollsError(message);
    } finally {
      setPollsLoading(false);
      setPollsLoaded(true);
    }
  }, [getMyPollQueryParams, sessionUser]);

  const loadJoinedPolls = useCallback(async () => {
    if (!sessionUser) return;
    setJoinedPollsLoading(true);
    setJoinedPollsError(null);
    try {
      const response = await fetch("/api/polls/joined");
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to load joined polls.");
      }
      const data = (await response.json()) as {
        polls: { id: string; question: string; joinedAt: string }[];
      };
      setJoinedPolls(data.polls);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load joined polls.";
      setJoinedPollsError(message);
    } finally {
      setJoinedPollsLoading(false);
      setJoinedPollsLoaded(true);
    }
  }, [sessionUser]);

  useEffect(() => {
    if (isMyPollsOpen) void loadMyPolls();
  }, [isMyPollsOpen, loadMyPolls]);

  useEffect(() => {
    const params = getMyPollQueryParams();
    const next = params.toString();
    const current = searchParams.toString();
    if (next === current) return;
    router.replace(next ? `${pathname}?${next}` : pathname);
  }, [getMyPollQueryParams, pathname, router, searchParams]);

  useEffect(() => {
    if (isJoinedPollsOpen) void loadJoinedPolls();
  }, [isJoinedPollsOpen, loadJoinedPolls]);

  useEffect(() => {
    if (!sessionUser) return;
    if (!pollsLoaded) void loadMyPolls();
    if (!joinedPollsLoaded) void loadJoinedPolls();
  }, [joinedPollsLoaded, loadJoinedPolls, loadMyPolls, pollsLoaded, sessionUser]);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const updateSidebarPosition = () => {
      if (!sidebarButtonRef.current) return;
      const rect = sidebarButtonRef.current.getBoundingClientRect();
      const rightOffset = window.innerWidth - (rect.left - 2);
      setSidebarRight(rightOffset);
    };
    updateSidebarPosition();
    window.addEventListener("resize", updateSidebarPosition);
    window.addEventListener("scroll", updateSidebarPosition, true);
    return () => {
      window.removeEventListener("resize", updateSidebarPosition);
      window.removeEventListener("scroll", updateSidebarPosition, true);
    };
  }, [isSidebarOpen]);

  const handleJoin = () => {
    const pollId = extractPollId(joinId);
    if (!pollId) {
      setError("Enter a poll ID or link to join.");
      return;
    }
    router.push(`/poll/${pollId}`);
  };

  // Shared input classes (dark glass)
  const glassInput =
    "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/40 " +
    "shadow-[0_0_0_1px_rgba(255,255,255,0.04)] " +
    "focus:border-[rgba(79,255,216,0.55)] focus:outline-none focus:ring-2 focus:ring-[rgba(79,255,216,0.22)]";

  const glassButton =
    "rounded-2xl bg-[rgba(79,255,216,0.92)] px-6 py-3 text-base font-semibold text-slate-950 " +
    "shadow-[0_18px_50px_-25px_rgba(79,255,216,0.7)] transition " +
    "hover:bg-[rgba(79,255,216,1)] hover:shadow-[0_22px_70px_-35px_rgba(79,255,216,0.9)] " +
    "active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60";

  const glassCard =
    "rounded-3xl border border-white/10 bg-white/5 p-8 text-white " +
    "shadow-[0_30px_120px_-85px_rgba(0,0,0,0.9)] backdrop-blur-2xl";

  const hasPasswordMismatch =
    authMode === "signup" &&
    authPassword.length > 0 &&
    authConfirmPassword.length > 0 &&
    authPassword !== authConfirmPassword;

  const resetMyPollFilters = () => {
    setPollStatusFilter("all");
    setPollSortField("createdAt");
    setPollSortOrder("desc");
    setPollFromDate("");
    setPollToDate("");
    setPollMinVotes("");
    setPollMaxVotes("");
    setPollQuery("");
  };

  return (
    <div className="relative min-h-screen px-6 py-14 text-white">
      {/* Background image (your chosen one) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <Image
          src="/images/background.png"
          alt=""
          fill
          priority
          className="object-cover object-center"
        />
        {/* Slight dark veil for readability (keeps neon vibe) */}
        <div className="absolute inset-0 bg-slate-950/55" />
        {/* Subtle cyan glow layer so logo + buttons feel integrated */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(700px circle at 18% 18%, rgba(79,255,216,0.14), transparent 55%)," +
              "radial-gradient(600px circle at 78% 68%, rgba(96,165,250,0.10), transparent 60%)",
          }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Logo */}
              <Image
                src="/images/loog.png"
                alt="OneVote"
                width={460}
                height={140}
                priority
                className="h-auto w-[180px] drop-shadow-[0_18px_40px_rgba(79,255,216,0.22)] sm:w-[420px]"
              />
            </div>

            {/* Menu button (glass) */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              ref={sidebarButtonRef}
              aria-label="Open sidebar"
              className="flex h-11 w-12 flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl
                         shadow-[0_16px_50px_-30px_rgba(0,0,0,0.9)] transition
                         hover:border-white/20 hover:bg-white/10"
            >
              <span className="h-0.5 w-6 rounded-full bg-white/70" />
              <span className="h-0.5 w-6 rounded-full bg-white/70" />
              <span className="h-0.5 w-6 rounded-full bg-white/70" />
            </button>
          </div>

          <h1 className="text-4xl font-semibold leading-tight text-white drop-shadow-[0_20px_60px_rgba(0,0,0,0.75)] sm:text-5xl">
            Launch a live poll and watch results shift in real time.
          </h1>

          <p className="max-w-2xl text-lg text-white/70">
            Create a question, share the link, and let everyone vote once. Results update
            instantly.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Create poll (glass) */}
          <section className={glassCard}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">Create a poll</h2>
                {!sessionUser ? (
                  <p className="mt-2 text-sm text-white/55">Sign up to host a poll.</p>
                ) : null}
              </div>

              {sessionUser ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75
                             backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  Sign out
                </button>
              ) : null}
            </div>

            {sessionLoading ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/65 backdrop-blur-xl">
                Checking account status...
              </div>
            ) : sessionUser ? (
              <div className="mt-6 flex flex-col gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/65 backdrop-blur-xl">
                  Signed in as {sessionUser.name || sessionUser.email}.
                </div>

                <label className="text-sm font-semibold text-white/75">Question</label>
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="What should we build next?"
                  className={glassInput}
                />

                <div className="mt-2 flex flex-col gap-3">
                  <span className="text-sm font-semibold text-white/75">Options</span>
                  {options.map((option, index) => (
                    <input
                      key={`option-${index}`}
                      value={option}
                      onChange={(event) => updateOption(index, event.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className={glassInput}
                    />
                  ))}

                  <button
                    type="button"
                    onClick={addOption}
                    className="self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/75
                               backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                  >
                    + Add option
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75 backdrop-blur-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/45">
                    Voter identity
                  </p>
                  <label className="mt-3 flex items-center justify-between gap-3">
                    <span>Allow anonymous votes</span>
                    <input
                      type="checkbox"
                      checked={allowAnonymousVotes}
                      onChange={(event) => setAllowAnonymousVotes(event.target.checked)}
                      className="h-4 w-4 accent-[rgba(79,255,216,0.95)]"
                    />
                  </label>
                  <label className="mt-3 flex items-center justify-between gap-3">
                    <span>Collect voter email</span>
                    <input
                      type="checkbox"
                      checked={collectVoterEmail}
                      onChange={(event) => setCollectVoterEmail(event.target.checked)}
                      className="h-4 w-4 accent-[rgba(79,255,216,0.95)]"
                    />
                  </label>
                  <p className="mt-3 text-xs text-white/55">
                    {!collectVoterEmail
                      ? "Email will not be collected for votes."
                      : allowAnonymousVotes
                        ? "Email is optional for voters."
                        : "Email is required for every vote."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isSubmitting}
                  className={glassButton}
                >
                  {isSubmitting ? "Creating poll..." : "Create poll"}
                </button>
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signup");
                      setAuthError(null);
                      setAuthConfirmPassword("");
                    }}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition backdrop-blur-xl ${
                      authMode === "signup"
                        ? "border-[rgba(79,255,216,0.55)] bg-[rgba(79,255,216,0.12)] text-white shadow-[0_0_0_2px_rgba(79,255,216,0.08)]"
                        : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    Sign up
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError(null);
                      setAuthConfirmPassword("");
                    }}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition backdrop-blur-xl ${
                      authMode === "login"
                        ? "border-[rgba(79,255,216,0.55)] bg-[rgba(79,255,216,0.12)] text-white shadow-[0_0_0_2px_rgba(79,255,216,0.08)]"
                        : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    Log in
                  </button>
                </div>

                {authMode === "signup" ? (
                  <input
                    value={authName}
                    onChange={(event) => setAuthName(event.target.value)}
                    placeholder="Name (optional)"
                    className={glassInput}
                  />
                ) : null}

                <input
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="Email"
                  type="email"
                  className={glassInput}
                />
                <input
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="Password"
                  type="password"
                  className={glassInput}
                />
                {authMode === "signup" ? (
                  <input
                    value={authConfirmPassword}
                    onChange={(event) => setAuthConfirmPassword(event.target.value)}
                    placeholder="Confirm password"
                    type="password"
                    className={glassInput}
                  />
                ) : null}

                {authError ? (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur-xl">
                    {authError}
                  </div>
                ) : null}
                {!authError && hasPasswordMismatch ? (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur-xl">
                    Passwords do not match.
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleAuthSubmit}
                  disabled={authSubmitting || hasPasswordMismatch}
                  className={glassButton}
                >
                  {authSubmitting
                    ? authMode === "signup"
                      ? "Creating account..."
                      : "Signing in..."
                    : authMode === "signup"
                      ? "Create account"
                      : "Sign in"}
                </button>
              </div>
            )}
          </section>

          {/* Join a poll (slightly darker glass panel) */}
          <section
            className={
              "rounded-3xl border border-white/10 bg-slate-950/30 p-8 text-white backdrop-blur-2xl " +
              "shadow-[0_30px_120px_-85px_rgba(0,0,0,0.95)]"
            }
            style={{
              boxShadow: `0 30px 120px -85px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.05), 0 0 80px -40px ${GLOW_CYAN}`,
            }}
          >
            <h2 className="text-2xl font-semibold">Join a poll</h2>
            <p className="mt-3 text-sm text-white/65">
              Paste a poll ID or link to join a poll, no signup required.
            </p>

            <div className="mt-6 flex flex-col gap-4">
              <input
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="Poll ID"
                className={glassInput}
              />
              <button type="button" onClick={handleJoin} className={glassButton}>
                Join poll
              </button>
            </div>

            <div
              className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 backdrop-blur-xl"
              style={{
                boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 0 60px -35px ${GLOW_CYAN_STRONG}`,
              }}
            >
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/45">
                Pro tip
              </p>
              <p className="mt-2">
                Share the poll link for instant access to live results.
              </p>
            </div>
          </section>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur-xl">
            {error}
          </div>
        ) : null}
      </div>

      {/* Sidebar (glass, dark) */}
      <div
        className={`fixed top-20 z-40 w-[min(16rem,85vw)] rounded-3xl border border-white/10 bg-slate-950/35 p-4 text-white
                    shadow-[0_30px_90px_-60px_rgba(0,0,0,0.95)] backdrop-blur-2xl transition duration-200 ${
                      isSidebarOpen
                        ? "translate-x-0 opacity-100"
                        : "pointer-events-none translate-x-6 opacity-0"
                    }`}
        style={sidebarRight !== null ? { right: sidebarRight } : { right: "1.5rem" }}
      >
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              setIsMyPollsOpen(true);
              setIsJoinedPollsOpen(false);
              setIsSidebarOpen(false);
            }}
            className="rounded-2xl border border-[rgba(79,255,216,0.35)] bg-[rgba(79,255,216,0.10)] px-4 py-3 text-sm font-semibold text-white
                       shadow-[0_18px_60px_-45px_rgba(79,255,216,0.45)] transition
                       hover:border-[rgba(79,255,216,0.55)] hover:bg-[rgba(79,255,216,0.14)]"
          >
            {sessionUser
              ? pollsLoaded
                ? `My polls (${polls.length})`
                : "My polls (...)"
              : "My polls"}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsJoinedPollsOpen(true);
              setIsMyPollsOpen(false);
              setIsSidebarOpen(false);
            }}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80
                       backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            {sessionUser
              ? joinedPollsLoaded
                ? `Polls joined (${joinedPolls.length})`
                : "Polls joined (...)"
              : "Polls joined"}
          </button>
        </div>
      </div>

      {/* My Polls Modal (glass) */}
      {isMyPollsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/55 px-6 py-10 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-3xl border border-white/10 bg-white/5 p-6 text-white backdrop-blur-2xl shadow-[0_35px_120px_-80px_rgba(0,0,0,0.95)]">
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-[rgba(15,23,42,0.55)] pb-3 backdrop-blur-xl">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/45">
                  My polls ({polls.length})
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Poll history</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMyPollsOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-3 flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={pollQuery}
                    onChange={(event) => setPollQuery(event.target.value)}
                    placeholder="Search question..."
                    className={glassInput}
                  />
                  <select
                    value={pollStatusFilter}
                    onChange={(event) =>
                      setPollStatusFilter(event.target.value as "all" | "open" | "closed")
                    }
                    className={glassInput}
                  >
                    <option value="all">All status</option>
                    <option value="open">Open only</option>
                    <option value="closed">Closed only</option>
                  </select>
                  <select
                    value={pollSortField}
                    onChange={(event) =>
                      setPollSortField(event.target.value as "createdAt" | "totalVotes")
                    }
                    className={glassInput}
                  >
                    <option value="createdAt">Sort by create date</option>
                    <option value="totalVotes">Sort by vote count</option>
                  </select>
                  <select
                    value={pollSortOrder}
                    onChange={(event) =>
                      setPollSortOrder(event.target.value as "desc" | "asc")
                    }
                    className={glassInput}
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                  <input
                    type="date"
                    value={pollFromDate}
                    onChange={(event) => setPollFromDate(event.target.value)}
                    className={glassInput}
                  />
                  <input
                    type="date"
                    value={pollToDate}
                    onChange={(event) => setPollToDate(event.target.value)}
                    className={glassInput}
                  />
                  <input
                    type="number"
                    min="0"
                    value={pollMinVotes}
                    onChange={(event) => setPollMinVotes(event.target.value)}
                    placeholder="Min votes"
                    className={glassInput}
                  />
                  <input
                    type="number"
                    min="0"
                    value={pollMaxVotes}
                    onChange={(event) => setPollMaxVotes(event.target.value)}
                    placeholder="Max votes"
                    className={glassInput}
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={resetMyPollFilters}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                  >
                    Clear filters
                  </button>
                </div>
              </div>

              {!sessionUser ? (
                <div className="rounded-2xl border border-[rgba(79,255,216,0.25)] bg-[rgba(79,255,216,0.10)] px-4 py-3 text-sm text-white/80 backdrop-blur-xl">
                  Sign in to view your polls.
                </div>
              ) : pollsLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/65 backdrop-blur-xl">
                  Loading your polls...
                </div>
              ) : pollsError ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur-xl">
                  {pollsError}
                </div>
              ) : polls.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/65 backdrop-blur-xl">
                  No polls yet. Create your first poll to see it here.
                </div>
              ) : (
                polls.map((poll) => (
                  <div
                    key={poll.id}
                    className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/25 px-4 py-4 backdrop-blur-xl md:flex-row md:items-center md:justify-between"
                    style={{
                      boxShadow: `0 0 0 1px rgba(255,255,255,0.03), 0 0 70px -55px ${GLOW_CYAN}`,
                    }}
                  >
                    <div>
                      <p className="text-base font-semibold text-white">
                        {poll.question}
                      </p>
                      <p className="mt-1 text-xs text-white/55">
                        {new Date(poll.createdAt).toLocaleDateString()} ·{" "}
                        {poll.totalVotes} votes · {poll.isOpen ? "Open" : "Closed"}
                      </p>
                      {poll.collectVoterEmail ? (
                        <p className="mt-1 text-xs text-white/50">
                          Identity mode:{" "}
                          {poll.allowAnonymousVotes ? "Optional email" : "Email required"}{" "}
                          · {poll.identifiedVotes} identified · {poll.anonymousVotes}{" "}
                          anonymous
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-white/50">
                          Identity mode: Anonymous only
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      {poll.collectVoterEmail ? (
                        <button
                          type="button"
                          onClick={() => void openVotersModal(poll.id, poll.question)}
                          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                        >
                          View voters
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => updatePollStatus(poll.id, !poll.isOpen)}
                        disabled={pollActionId === poll.id}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {pollActionId === poll.id
                          ? poll.isOpen
                            ? "Closing..."
                            : "Opening..."
                          : poll.isOpen
                            ? "Close poll"
                            : "Open poll"}
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/poll/${poll.id}`)}
                        className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-xl transition hover:bg-white/15"
                        style={{
                          boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 0 70px -55px ${GLOW_CYAN_STRONG}`,
                        }}
                      >
                        View poll
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Voters Modal (glass) */}
      {isVotersModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/55 px-6 py-10 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-3xl border border-white/10 bg-white/5 p-6 text-white backdrop-blur-2xl shadow-[0_35px_120px_-80px_rgba(0,0,0,0.95)]">
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-[rgba(15,23,42,0.55)] pb-3 backdrop-blur-xl">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/45">
                  Voter details
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  {selectedVotersPoll?.question ?? "Poll voters"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVotersModalOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-3 flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
              {votersLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/65 backdrop-blur-xl">
                  Loading voters...
                </div>
              ) : votersError ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur-xl">
                  {votersError}
                </div>
              ) : voters.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/65 backdrop-blur-xl">
                  No voter emails recorded for this poll yet.
                </div>
              ) : (
                voters.map((voter, index) => (
                  <div
                    key={`${voter.email}-${voter.votedAt}-${index}`}
                    className="rounded-2xl border border-white/10 bg-slate-950/25 px-4 py-4 backdrop-blur-xl"
                    style={{
                      boxShadow: `0 0 0 1px rgba(255,255,255,0.03), 0 0 70px -55px ${GLOW_CYAN}`,
                    }}
                  >
                    <p className="text-sm font-semibold text-white">{voter.email}</p>
                    <p className="mt-1 text-xs text-white/60">
                      Voted for: {voter.optionText}
                    </p>
                    <p className="mt-1 text-xs text-white/50">
                      {formatVoteDateTime(voter.votedAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Joined Polls Modal (glass) */}
      {isJoinedPollsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/55 px-6 py-10 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-3xl border border-white/10 bg-white/5 p-6 text-white backdrop-blur-2xl shadow-[0_35px_120px_-80px_rgba(0,0,0,0.95)]">
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-[rgba(15,23,42,0.55)] pb-3 backdrop-blur-xl">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/45">
                  Polls joined ({joinedPolls.length})
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  Participation history (excluding your own polls)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsJoinedPollsOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-3 flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
              {!sessionUser ? (
                <div className="rounded-2xl border border-[rgba(79,255,216,0.25)] bg-[rgba(79,255,216,0.10)] px-4 py-3 text-sm text-white/80 backdrop-blur-xl">
                  Sign in to view joined polls.
                </div>
              ) : joinedPollsLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/65 backdrop-blur-xl">
                  Loading joined polls...
                </div>
              ) : joinedPollsError ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur-xl">
                  {joinedPollsError}
                </div>
              ) : joinedPolls.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/65 backdrop-blur-xl">
                  No joined polls yet. Cast a vote to see it here.
                </div>
              ) : (
                joinedPolls.map((poll) => (
                  <div
                    key={poll.id}
                    className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/25 px-4 py-4 backdrop-blur-xl md:flex-row md:items-center md:justify-between"
                    style={{
                      boxShadow: `0 0 0 1px rgba(255,255,255,0.03), 0 0 70px -55px ${GLOW_CYAN}`,
                    }}
                  >
                    <div>
                      <p className="text-base font-semibold text-white">
                        {poll.question}
                      </p>
                      <p className="mt-1 text-xs text-white/55">
                        Joined on {formatJoinedDate(poll.joinedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/poll/${poll.id}`)}
                      className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-xl transition hover:bg-white/15"
                      style={{
                        boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 0 70px -55px ${GLOW_CYAN_STRONG}`,
                      }}
                    >
                      View poll
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
