import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "one-vote-session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const PASSWORD_KEY_LENGTH = 64;

type PasswordParts = {
  salt: string;
  hash: string;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const parsePasswordHash = (passwordHash: string): PasswordParts | null => {
  const [salt, hash] = passwordHash.split(":");
  if (!salt || !hash) return null;
  return { salt, hash };
};

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  return `${salt}:${derived.toString("hex")}`;
};

export const verifyPassword = (password: string, passwordHash: string) => {
  const parsed = parsePasswordHash(passwordHash);
  if (!parsed) return false;
  const derived = scryptSync(password, parsed.salt, PASSWORD_KEY_LENGTH);
  const stored = Buffer.from(parsed.hash, "hex");
  if (stored.length !== derived.length) return false;
  return timingSafeEqual(stored, derived);
};

export const createSession = async (userId: string) => {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });
  return { token, expiresAt };
};

export const clearSession = async (token?: string) => {
  if (!token) return;
  await prisma.session.deleteMany({
    where: {
      tokenHash: hashToken(token),
    },
  });
};

export const getSessionUserByToken = async (token?: string) => {
  if (!token) return null;
  const session = await prisma.session.findFirst({
    where: {
      tokenHash: hashToken(token),
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  });
  return session?.user ?? null;
};

export const getSessionCookieName = () => SESSION_COOKIE;

export const getSessionMaxAge = () => Math.floor(SESSION_TTL_MS / 1000);
