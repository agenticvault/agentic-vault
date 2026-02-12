import { type Address, type Hex, keccak256, recoverAddress, toHex } from 'viem';

/**
 * secp256k1 curve order (n).
 * Used for low-s normalization (EIP-2).
 */
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const SECP256K1_HALF_N = SECP256K1_N / 2n;

/**
 * Parse a DER-encoded ECDSA signature into r and s components.
 *
 * DER format: 0x30 <total-len> 0x02 <r-len> <r-bytes> 0x02 <s-len> <s-bytes>
 */
export function parseDerSignature(der: Uint8Array): {
  r: Uint8Array;
  s: Uint8Array;
} {
  let offset = 0;

  if (der[offset++] !== 0x30) {
    throw new Error('Invalid DER signature: missing SEQUENCE tag');
  }

  // total length (skip, we parse by structure)
  const totalLen = der[offset++]!;
  if (offset + totalLen > der.length) {
    throw new Error('Invalid DER signature: length exceeds buffer');
  }

  // Parse r
  if (der[offset++] !== 0x02) {
    throw new Error('Invalid DER signature: missing INTEGER tag for r');
  }
  const rLen = der[offset++]!;
  const rRaw = new Uint8Array(der.buffer, der.byteOffset + offset, rLen);
  offset += rLen;

  // Parse s
  if (der[offset++] !== 0x02) {
    throw new Error('Invalid DER signature: missing INTEGER tag for s');
  }
  const sLen = der[offset++]!;
  const sRaw = new Uint8Array(der.buffer, der.byteOffset + offset, sLen);

  // Strip leading zero padding (DER uses signed integers) and pad to 32 bytes
  const r = padTo32Bytes(stripLeadingZeros(rRaw));
  const s = padTo32Bytes(stripLeadingZeros(sRaw));

  return { r, s };
}

/**
 * Parse a DER-encoded SPKI public key to extract the uncompressed secp256k1 point (65 bytes).
 *
 * SPKI structure for secp256k1:
 *   SEQUENCE {
 *     SEQUENCE { OID ecPublicKey, OID secp256k1 }
 *     BIT STRING { 0x00 (unused bits) 0x04 <x 32 bytes> <y 32 bytes> }
 *   }
 */
export function parseDerPublicKey(der: Uint8Array): Uint8Array {
  // Find the BIT STRING containing the public key
  // The uncompressed key starts with 0x04 and is 65 bytes
  for (let i = 0; i <= der.length - 65; i++) {
    if (der[i] === 0x04) {
      // Verify the byte before is 0x00 (BIT STRING unused bits indicator)
      if (i > 0 && der[i - 1] === 0x00) {
        return new Uint8Array(der.buffer, der.byteOffset + i, 65);
      }
    }
  }
  throw new Error('Failed to extract uncompressed public key from SPKI DER');
}

/**
 * Apply EIP-2 low-s normalization.
 * If s > secp256k1n/2, replace s with secp256k1n - s.
 */
export function normalizeSignature(
  r: Uint8Array,
  s: Uint8Array,
): { r: Uint8Array; s: Uint8Array } {
  const sBigInt = bytesToBigInt(s);

  if (sBigInt > SECP256K1_HALF_N) {
    const normalizedS = SECP256K1_N - sBigInt;
    return { r, s: bigIntTo32Bytes(normalizedS) };
  }

  return { r, s };
}

/**
 * Resolve the recovery parameter (yParity) by trying 0 and 1,
 * then comparing the recovered address against the expected address.
 * Uses viem's recoverAddress internally.
 */
export async function resolveRecoveryParam(
  digest: Uint8Array,
  r: Uint8Array,
  s: Uint8Array,
  address: Address,
): Promise<number> {
  const hashHex: Hex = toHex(digest);
  const rHex: Hex = toHex(r, { size: 32 });
  const sHex: Hex = toHex(s, { size: 32 });

  for (const yParity of [0, 1] as const) {
    try {
      const recovered = await recoverAddress({
        hash: hashHex,
        signature: { r: rHex, s: sHex, yParity },
      });
      if (recovered.toLowerCase() === address.toLowerCase()) {
        return yParity;
      }
    } catch {
      // Try next recovery value
    }
  }

  throw new Error('Failed to resolve recovery parameter: no matching yParity found');
}

/**
 * Derive Ethereum address from an uncompressed secp256k1 public key (65 bytes).
 * address = keccak256(pubkey[1:])[12:]
 */
export function publicToAddress(pubkey: Uint8Array): Address {
  if (pubkey.length !== 65 || pubkey[0] !== 0x04) {
    throw new Error('Expected 65-byte uncompressed public key starting with 0x04');
  }

  // Hash the 64-byte x,y coordinates (skip the 0x04 prefix)
  const coordBytes = new Uint8Array(pubkey.buffer, pubkey.byteOffset + 1, 64);
  const hash = keccak256(toHex(coordBytes));
  // Take last 20 bytes (40 hex chars) of the hash
  return `0x${hash.slice(26)}` as Address;
}

/** Strip leading zero bytes from a byte array */
function stripLeadingZeros(bytes: Uint8Array): Uint8Array {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) {
    start++;
  }
  return start > 0 ? new Uint8Array(bytes.buffer, bytes.byteOffset + start, bytes.length - start) : bytes;
}

/** Left-pad a byte array to 32 bytes */
function padTo32Bytes(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 32) return bytes;
  if (bytes.length > 32) return new Uint8Array(bytes.buffer, bytes.byteOffset, 32);
  const padded = new Uint8Array(32);
  padded.set(bytes, 32 - bytes.length);
  return padded;
}

/** Convert a Uint8Array to a BigInt */
export function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

/** Convert a BigInt to a 32-byte Uint8Array */
export function bigIntTo32Bytes(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let v = value;
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return bytes;
}
