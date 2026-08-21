import { randomInt } from "node:crypto";
import { assertPasswordPolicy } from "./password-policy.js";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%*-_+=";
const ALL = `${UPPER}${LOWER}${DIGITS}${SYMBOLS}`;

export function generateTemporaryPassword(length = 16): string {
  if (length < 8) {
    throw new Error("Temporary password length must be at least 8");
  }

  const chars = [
    pick(UPPER),
    pick(LOWER),
    pick(DIGITS),
    pick(SYMBOLS),
  ];
  while (chars.length < length) {
    chars.push(pick(ALL));
  }

  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex]!, chars[index]!];
  }

  const password = chars.join("");
  assertPasswordPolicy({ password });
  return password;
}

function pick(source: string): string {
  return source[randomInt(source.length)]!;
}
