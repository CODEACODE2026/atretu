import { timingSafeEqual } from "node:crypto";

export function timingSafeStringEqual(actual: string | undefined, expected: string) {
  if (!actual) {
    return false;
  }
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) {
    timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }
  return timingSafeEqual(actualBuffer, expectedBuffer);
}
