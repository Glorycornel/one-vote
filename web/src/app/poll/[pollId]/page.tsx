// app/poll/[pollId]/page.tsx
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import PollClient from "./PollClient";

type PageProps = {
  params: Promise<{
    pollId: string;
  }>;
};

export default async function PollPage({ params }: PageProps) {
  const { pollId } = await params;

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: { orderBy: { order: "asc" } },
    },
  });

  if (!poll) {
    return (
      <div className="relative min-h-screen px-6 py-16 text-white">
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

        <div className="mx-auto max-w-2xl">
          <Image
            src="/images/loog.png"
            alt="OneVote"
            width={420}
            height={140}
            priority
            className="h-auto w-[260px] drop-shadow-[0_18px_40px_rgba(79,255,216,0.25)] sm:w-[340px] md:w-[420px]"
          />
          <h1 className="mt-8 text-3xl font-semibold">Poll not found</h1>
          <p className="mt-3 text-white/70">
            Double-check the poll ID or ask the host to resend the link.
          </p>
        </div>
      </div>
    );
  }

  const groupedVotes = await prisma.vote.groupBy({
    by: ["optionId"],
    where: { pollId: poll.id },
    _count: { optionId: true },
  });

  const counts = groupedVotes.reduce<Record<string, number>>((acc, group) => {
    acc[group.optionId] = group._count.optionId;
    return acc;
  }, {});

  const totalVotes = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <PollClient
      pollId={poll.id}
      question={poll.question}
      options={poll.options.map((option) => ({ id: option.id, text: option.text }))}
      initialCounts={counts}
      initialTotal={totalVotes}
      initialIsOpen={poll.isOpen}
      allowAnonymousVotes={poll.allowAnonymousVotes}
      collectVoterEmail={poll.collectVoterEmail}
    />
  );
}
