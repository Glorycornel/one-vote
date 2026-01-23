// app/poll/[pollId]/VoteForm.tsx
"use client";

import { useState } from "react";

type Option = { id: string; text: string };

type VoteFormProps = {
  options: Option[];
  isOpen: boolean;
  onVote: (optionId: string) => void;
};

const glassCard =
  "rounded-3xl border border-white/10 bg-white/5 p-6 text-white " +
  "shadow-[0_30px_120px_-85px_rgba(0,0,0,0.95)] backdrop-blur-2xl";

export default function VoteForm({ options, isOpen, onVote }: VoteFormProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleVote = () => {
    if (!selected) {
      window.alert("Pick an option before voting.");
      return;
    }
    onVote(selected);
  };

  return (
    <div className={glassCard}>
      <h2 className="text-xl font-semibold text-white">Cast your vote</h2>

      <p className="mt-2 text-sm text-white/65">
        {isOpen ? "Poll is open." : "Poll is closed."} Votes update live.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {options.map((option) => {
          const isSelected = selected === option.id;

          return (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition backdrop-blur-xl ${
                isSelected
                  ? "border-[rgba(79,255,216,0.55)] bg-[rgba(79,255,216,0.12)] text-white shadow-[0_0_0_2px_rgba(79,255,216,0.08)]"
                  : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              <input
                type="radio"
                name="vote"
                value={option.id}
                checked={isSelected}
                onChange={() => setSelected(option.id)}
                className="h-4 w-4 accent-[rgba(79,255,216,0.95)]"
              />
              <span className="text-sm font-medium">{option.text}</span>
            </label>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleVote}
        disabled={!isOpen}
        className="mt-5 w-full rounded-2xl bg-[rgba(79,255,216,0.92)] px-6 py-3 text-sm font-semibold text-slate-950
                   shadow-[0_18px_55px_-35px_rgba(79,255,216,0.85)] transition
                   hover:bg-[rgba(79,255,216,1)] hover:shadow-[0_22px_75px_-45px_rgba(79,255,216,0.95)]
                   active:translate-y-[1px]
                   disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isOpen ? "Vote" : "Voting closed"}
      </button>
    </div>
  );
}
