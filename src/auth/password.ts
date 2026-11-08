const iterations = 100_000;
const saltBytes = 16;
const hashBits = 256;
const maxIterations = 1_000_000;

// Stored as iterations$saltBase64$hashBase64. Base64 does not contain "$".
export function passwordAcceptable(password: string): boolean {
  return typeof password === "string" && password.length >= 8 && password.length <= 1024;
}

export async function hashPassword(password: string): Promise<string> {
  if (!passwordAcceptable(password)) throw new Error("invalid password");
  const salt = crypto.getRandomValues(new Uint8Array(saltBytes));
  const hash = await deriveBits(password, salt, iterations);
  return `${iterations}$${encodeBase64(salt)}$${encodeBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (typeof password !== "string" || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const rounds = Number(parts[0]);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > maxIterations) return false;
  const salt = decodeBase64(parts[1] ?? "");
  const expected = decodeBase64(parts[2] ?? "");
  if (salt === null || expected === null || salt.length === 0 || expected.length === 0)
    return false;
  const actual = await deriveBits(password, salt, rounds);
  return timingSafeEqual(actual, expected);
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      const code = binary.charCodeAt(index);
      if (code > 255) return null;
      bytes[index] = code;
    }
    return bytes;
  } catch {
    return null;
  }
}

function timingSafeEqual(actual: Uint8Array, expected: Uint8Array): boolean {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= (actual[index] ?? 0) ^ (expected[index] ?? 0);
  }
  return difference === 0;
}

async function deriveBits(password: string, salt: Uint8Array, rounds: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    asBuffer(new TextEncoder().encode(password)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: asBuffer(salt),
      iterations: rounds,
    },
    key,
    hashBits,
  );
  return new Uint8Array(bits);
}

function asBuffer(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy;
}
