import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

// No 0/O, 1/l/I so the password can be read out over the phone.
const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** 8 characters like "k7mp-q4xa", easy to type on a phone. */
export function generateTempPassword(): string {
  const pick = () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  const part = () => Array.from({ length: 4 }, pick).join("");
  return `${part()}-${part()}`;
}
