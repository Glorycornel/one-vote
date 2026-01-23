// app/poll/[pollId]/PollClient.tsx
"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import VoteForm from "./VoteForm";

type Option = { id: string; text: string };

type PollClientProps = {
  pollId: string;
  question: string;
  options: Option[];
  initialCounts: Record<string, number>;
  initialTotal: number;
  initialIsOpen: boolean;
};

type PollStatePayload = {
  pollId: string;
  isOpen: boolean;
  counts: Record<string, number>;
  totalVotes: number;
};

const VOTER_KEY = "one-vote:voter-id";
const getOrCreateVoterId = () => {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(VOTER_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(VOTER_KEY, created);
  return created;
};

const glassCard =
  "rounded-3xl border border-white/10 bg-white/5 text-white " +
  "shadow-[0_30px_120px_-85px_rgba(0,0,0,0.95)] backdrop-blur-2xl";

const glassChip =
  "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur-xl";

const glassOutlineButton =
  "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-xl transition " +
  "hover:border-white/20 hover:bg-white/10 hover:text-white";

const glassInput =
  "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 " +
  "shadow-[0_0_0_1px_rgba(255,255,255,0.04)] focus:border-[rgba(79,255,216,0.55)] focus:outline-none focus:ring-2 focus:ring-[rgba(79,255,216,0.22)]";

export default function PollClient({
  pollId,
  question,
  options,
  initialCounts,
  initialTotal,
  initialIsOpen,
}: PollClientProps) {
  const router = useRouter();

  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [totalVotes, setTotalVotes] = useState(initialTotal);
  const [isOpen, setIsOpen] = useState(initialIsOpen);
  const [status, setStatus] = useState<"idle" | "casting" | "error">("idle");
  const [socketConnected, setSocketConnected] = useState(false);

  const [pollIdStatus, setPollIdStatus] = useState<"idle" | "copied" | "error">("idle");
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "error">("idle");

  const socketRef = useRef<Socket | null>(null);
  const castingRef = useRef(false);

  const socketUrl = process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4000";
  const voterId = useMemo(() => getOrCreateVoterId(), []);
  const [pollUrl, setPollUrl] = useState(`/poll/${pollId}`);

  const copyText = async (text: string, setState: (v: "copied" | "error") => void) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const input = document.createElement("input");
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setState("copied");
    } catch {
      setState("error");
    }
  };

  const recordJoinedPoll = useCallback(async () => {
    try {
      await fetch("/api/polls/joined", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId }),
      });
    } catch {
      // ignore
    }
  }, [pollId]);

  useEffect(() => {
    const socket: Socket = io(socketUrl);
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("join_poll", { pollId, voterId });
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
      if (castingRef.current) {
        setStatus("error");
        castingRef.current = false;
      }
    });

    socket.on("connect_error", () => {
      setSocketConnected(false);
      if (castingRef.current) {
        setStatus("error");
        castingRef.current = false;
      }
    });

    socket.on("poll_state", (payload: PollStatePayload) => {
      if (payload.pollId !== pollId) return;
      setCounts(payload.counts);
      setTotalVotes(payload.totalVotes);
      setIsOpen(payload.isOpen);
    });

    socket.on("poll_update", (payload: PollStatePayload) => {
      if (payload.pollId !== pollId) return;
      setCounts(payload.counts);
      setTotalVotes(payload.totalVotes);
      setIsOpen(payload.isOpen);
      setStatus("idle");

      if (castingRef.current) {
        void recordJoinedPoll();
        castingRef.current = false;
      }
    });

    socket.on("vote_error", () => {
      setStatus("error");
      castingRef.current = false;
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [pollId, recordJoinedPoll, socketUrl, voterId]);

  useEffect(() => {
    if (socketConnected) return;
    let cancelled = false;

    const fetchPollState = async () => {
      try {
        const response = await fetch(`/api/polls/${pollId}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          counts: Record<string, number>;
          totalVotes: number;
          isOpen: boolean;
        };
        if (cancelled) return;
        setCounts(data.counts ?? {});
        setTotalVotes(data.totalVotes ?? 0);
        setIsOpen(Boolean(data.isOpen));
      } catch {
        // ignore network errors while reconnecting
      }
    };

    void fetchPollState();
    const interval = window.setInterval(fetchPollState, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pollId, socketConnected]);

  useEffect(() => {
    setPollUrl(`${window.location.origin}/poll/${pollId}`);
  }, [pollId]);

  useEffect(() => {
    if (pollIdStatus === "idle") return;
    const t = window.setTimeout(() => setPollIdStatus("idle"), 2000);
    return () => window.clearTimeout(t);
  }, [pollIdStatus]);

  useEffect(() => {
    if (shareStatus === "idle") return;
    const t = window.setTimeout(() => setShareStatus("idle"), 2000);
    return () => window.clearTimeout(t);
  }, [shareStatus]);

  const handleVote = (optionId: string) => {
    if (!socketRef.current || !socketConnected) {
      setStatus("error");
      castingRef.current = false;
      return;
    }
    castingRef.current = true;
    setStatus("casting");
    socketRef.current.emit("cast_vote", { pollId, optionId, voterId });
  };

  return (
    <div className="relative min-h-screen px-6 py-14 text-white">
      {/* Background image */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <Image
          src="/images/background.png"
          alt=""
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-slate-950/60" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(700px circle at 18% 18%, rgba(79,255,216,0.14), transparent 55%)," +
              "radial-gradient(600px circle at 78% 68%, rgba(96,165,250,0.10), transparent 60%)",
          }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        {/* Header */}
        <header className={`${glassCard} p-8`}>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              <span className="text-lg leading-none">←</span>
            </button>

            <Image
              src="/images/loog.png"
              alt="OneVote"
              width={460}
              height={140}
              priority
              className="h-auto w-[220px] drop-shadow-[0_18px_40px_rgba(79,255,216,0.25)] sm:w-[320px] md:w-[420px]"
            />

            <div className="h-10 w-10" />
          </div>

          <span className="mt-6 block w-full text-center text-xs font-semibold uppercase tracking-[0.45em] text-white/45">
            Live poll
          </span>

          <h1 className="mt-4 text-center text-3xl font-semibold text-white sm:text-4xl">
            {question}
          </h1>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm">
            <span className={glassChip}>{isOpen ? "Open" : "Closed"}</span>
            <span className={glassChip}>{totalVotes} total votes</span>
            {status === "error" ? (
              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200 backdrop-blur-xl">
                Vote rejected
              </span>
            ) : null}
            {status === "casting" ? (
              <span className="rounded-full border border-[rgba(79,255,216,0.35)] bg-[rgba(79,255,216,0.10)] px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-xl">
                Casting...
              </span>
            ) : null}
          </div>

          {/* Poll ID */}
          <div className="mt-7 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-white/45">
              Poll ID
            </span>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex-1 rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-2 font-mono text-sm text-white/85">
                {pollId}
              </div>
              <button
                type="button"
                onClick={() => void copyText(pollId, setPollIdStatus)}
                className={glassOutlineButton}
              >
                Copy ID
              </button>
            </div>

            {pollIdStatus === "copied" ? (
              <span className="text-xs text-[rgba(79,255,216,0.95)]">
                Poll ID copied.
              </span>
            ) : null}
            {pollIdStatus === "error" ? (
              <span className="text-xs text-red-200">
                Could not copy. Select it manually.
              </span>
            ) : null}
          </div>

          {/* Share */}
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-white/45">
              Share
            </span>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <input value={pollUrl} readOnly className={glassInput} />
              <button
                type="button"
                onClick={() => void copyText(pollUrl, setShareStatus)}
                className={glassOutlineButton}
              >
                Copy link
              </button>
            </div>

            {shareStatus === "copied" ? (
              <span className="text-xs text-[rgba(79,255,216,0.95)]">Link copied.</span>
            ) : null}
            {shareStatus === "error" ? (
              <span className="text-xs text-red-200">
                Could not copy. Select it manually.
              </span>
            ) : null}
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_0.7fr]">
          {/* Results */}
          <section className={`${glassCard} p-8`}>
            <h2 className="text-xl font-semibold text-white">Current results</h2>

            <div className="mt-6 flex flex-col gap-5">
              {options.map((option) => {
                const count = counts[option.id] ?? 0;
                const percentage =
                  totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

                return (
                  <div key={option.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm font-medium text-white/85">
                      <span className="truncate">{option.text}</span>
                      <span className="shrink-0 text-white/65">
                        {count} · {percentage}%
                      </span>
                    </div>

                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          background:
                            "linear-gradient(90deg, rgba(79,255,216,0.95), rgba(96,165,250,0.85))",
                          boxShadow: "0 0 22px rgba(79,255,216,0.35)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <VoteForm options={options} isOpen={isOpen} onVote={handleVote} />
        </div>
      </div>
    </div>
  );
}
