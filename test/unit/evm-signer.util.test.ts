import { describe, it, expect } from 'vitest';
import {
  parseDerSignature,
  parseDerPublicKey,
  normalizeSignature,
  resolveRecoveryParam,
  publicToAddress,
  bytesToBigInt,
  bigIntTo32Bytes,
} from '@/evm-signer.util.js';
import type { Address } from 'viem';

// ============================================================================
// Test Vectors — Hardhat Account #0
// Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
// Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
// ============================================================================

const HARDHAT_0_ADDRESS: Address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

/** Uncompressed secp256k1 public key (65 bytes, 0x04 prefix) */
const HARDHAT_0_PUBKEY = new Uint8Array(
  Buffer.from(
    '048318535b54105d4a7aae60c08fc45f9687181b4fdfc625bd1a753fa7397fed753547f11ca8696646f2f3acb08e31016afac23e630c5d11f59f61fef57b0d2aa5e',
    'hex',
  ),
);

/** SPKI DER-encoded public key (as returned by AWS KMS GetPublicKey) */
const SPKI_DER = new Uint8Array([
  48, 86, 48, 16, 6, 7, 42, 134, 72, 206, 61, 2, 1, 6, 5, 43, 129, 4, 0, 10,
  3, 66, 0, 4, 131, 24, 83, 91, 84, 16, 93, 74, 122, 174, 96, 192, 143, 196,
  95, 150, 135, 24, 27, 79, 223, 198, 37, 189, 26, 117, 63, 167, 57, 127, 237,
  117, 53, 71, 241, 28, 168, 105, 102, 70, 242, 243, 172, 176, 142, 49, 1, 106,
  250, 194, 62, 99, 12, 93, 17, 245, 159, 97, 254, 245, 123, 13, 42, 165, 94,
]);

/**
 * DER-encoded ECDSA signature for keccak256(0xdeadbeef) signed by Hardhat #0.
 * r = 0xa8a8de243232c52140496c6b3e428090a8a944e1da3af2d6873d0f2151aa54b3
 * s = 0x5aa7e59729d04cd6cc405bacc7e5e834ad56a945a1b2570948ba39febdfbdd3c
 * yParity = 1
 */
const DER_SIGNATURE = new Uint8Array([
  48, 69, 2, 33, 0, 168, 168, 222, 36, 50, 50, 197, 33, 64, 73, 108, 107, 62,
  66, 128, 144, 168, 169, 68, 225, 218, 58, 242, 214, 135, 61, 15, 33, 81,
  170, 84, 179, 2, 32, 90, 167, 229, 151, 41, 208, 76, 214, 204, 64, 91, 172,
  199, 229, 232, 52, 173, 86, 169, 69, 161, 178, 87, 9, 72, 186, 57, 254, 189,
  251, 221, 60,
]);

const EXPECTED_R = new Uint8Array(
  Buffer.from('a8a8de243232c52140496c6b3e428090a8a944e1da3af2d6873d0f2151aa54b3', 'hex'),
);
const EXPECTED_S = new Uint8Array(
  Buffer.from('5aa7e59729d04cd6cc405bacc7e5e834ad56a945a1b2570948ba39febdfbdd3c', 'hex'),
);

/** Digest = keccak256(0xdeadbeef) */
const DIGEST = new Uint8Array(
  Buffer.from('d4fd4e189132273036449fc9e11198c739161b4c0116a9a2dccdfa1c492006f1', 'hex'),
);

const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

// ============================================================================
// parseDerSignature
// ============================================================================

describe('parseDerSignature', () => {
  it('should parse a valid DER-encoded ECDSA signature into r and s', () => {
    const { r, s } = parseDerSignature(DER_SIGNATURE);
    expect(Buffer.from(r).toString('hex')).toBe(Buffer.from(EXPECTED_R).toString('hex'));
    expect(Buffer.from(s).toString('hex')).toBe(Buffer.from(EXPECTED_S).toString('hex'));
  });

  it('should produce 32-byte r and s values', () => {
    const { r, s } = parseDerSignature(DER_SIGNATURE);
    expect(r.length).toBe(32);
    expect(s.length).toBe(32);
  });

  it('should strip leading zero padding from DER integers', () => {
    // The test DER has r with a leading 0x00 (33-byte r due to high bit)
    // parseDerSignature should strip it and pad to 32 bytes
    const { r } = parseDerSignature(DER_SIGNATURE);
    expect(r.length).toBe(32);
    expect(r[0]).not.toBe(0); // leading zero stripped, actual r starts with 0xa8
  });

  it('should throw on invalid SEQUENCE tag', () => {
    const invalid = new Uint8Array([0x31, ...DER_SIGNATURE.slice(1)]);
    expect(() => parseDerSignature(invalid)).toThrow('missing SEQUENCE tag');
  });

  it('should throw on truncated DER', () => {
    // Set total length to a value exceeding the buffer
    const invalid = new Uint8Array(DER_SIGNATURE);
    invalid[1] = 255;
    expect(() => parseDerSignature(invalid)).toThrow('length exceeds buffer');
  });

  it('should throw on missing INTEGER tag for r', () => {
    const invalid = new Uint8Array(DER_SIGNATURE);
    invalid[2] = 0x03; // change r's INTEGER tag to BIT STRING
    expect(() => parseDerSignature(invalid)).toThrow('missing INTEGER tag for r');
  });

  it('should throw on missing INTEGER tag for s', () => {
    // We need to find where s's INTEGER tag starts
    // Structure: 0x30 <len> 0x02 <rlen> <r...> 0x02 <slen> <s...>
    const rLen = DER_SIGNATURE[3]!;
    const sTagOffset = 4 + rLen;
    const invalid = new Uint8Array(DER_SIGNATURE);
    invalid[sTagOffset] = 0x03;
    expect(() => parseDerSignature(invalid)).toThrow('missing INTEGER tag for s');
  });

  it('should handle a second valid DER signature vector', () => {
    // keccak256(0xcafebabe) signed by Hardhat #0
    const der2 = new Uint8Array([
      48, 68, 2, 32, 94, 81, 48, 140, 123, 240, 166, 215, 31, 138, 54, 134,
      103, 219, 71, 39, 45, 67, 9, 212, 127, 242, 40, 68, 238, 180, 139, 17,
      26, 185, 165, 145, 2, 32, 119, 177, 5, 24, 195, 40, 33, 248, 19, 49, 45,
      231, 93, 35, 207, 151, 184, 28, 9, 33, 62, 30, 103, 41, 9, 30, 238, 134,
      101, 229, 33, 149,
    ]);
    const { r, s } = parseDerSignature(der2);
    expect(r.length).toBe(32);
    expect(s.length).toBe(32);
    expect(Buffer.from(r).toString('hex')).toBe(
      '5e51308c7bf0a6d71f8a368667db47272d4309d47ff22844eeb48b111ab9a591',
    );
    expect(Buffer.from(s).toString('hex')).toBe(
      '77b10518c32821f813312de75d23cf97b81c09213e1e6729091eee8665e52195',
    );
  });
});

// ============================================================================
// parseDerPublicKey
// ============================================================================

describe('parseDerPublicKey', () => {
  it('should extract uncompressed public key from SPKI DER', () => {
    const pubkey = parseDerPublicKey(SPKI_DER);
    expect(pubkey.length).toBe(65);
    expect(pubkey[0]).toBe(0x04);
    expect(Buffer.from(pubkey).toString('hex')).toBe(
      Buffer.from(HARDHAT_0_PUBKEY).toString('hex'),
    );
  });

  it('should throw when no valid public key is found', () => {
    const garbage = new Uint8Array(88).fill(0xff);
    expect(() => parseDerPublicKey(garbage)).toThrow(
      'Failed to extract uncompressed public key from SPKI DER',
    );
  });

  it('should reject DER without 0x00 byte before 0x04 marker', () => {
    // Modify SPKI DER so the byte before 0x04 is not 0x00
    const modified = new Uint8Array(SPKI_DER);
    // Find the 0x00 0x04 pattern
    for (let i = 0; i < modified.length - 1; i++) {
      if (modified[i] === 0x00 && modified[i + 1] === 0x04) {
        modified[i] = 0x01; // break the pattern
        break;
      }
    }
    expect(() => parseDerPublicKey(modified)).toThrow(
      'Failed to extract uncompressed public key',
    );
  });
});

// ============================================================================
// normalizeSignature
// ============================================================================

describe('normalizeSignature', () => {
  it('should return unchanged r and s when s is already low', () => {
    const result = normalizeSignature(EXPECTED_R, EXPECTED_S);
    expect(Buffer.from(result.r).toString('hex')).toBe(
      Buffer.from(EXPECTED_R).toString('hex'),
    );
    expect(Buffer.from(result.s).toString('hex')).toBe(
      Buffer.from(EXPECTED_S).toString('hex'),
    );
  });

  it('should normalize high-s to low-s (s = secp256k1n - s)', () => {
    const lowSBigInt = bytesToBigInt(EXPECTED_S);
    const highSBigInt = SECP256K1_N - lowSBigInt;
    const highS = bigIntTo32Bytes(highSBigInt);

    const result = normalizeSignature(EXPECTED_R, highS);
    expect(Buffer.from(result.s).toString('hex')).toBe(
      Buffer.from(EXPECTED_S).toString('hex'),
    );
  });

  it('should preserve r unchanged during normalization', () => {
    const lowSBigInt = bytesToBigInt(EXPECTED_S);
    const highSBigInt = SECP256K1_N - lowSBigInt;
    const highS = bigIntTo32Bytes(highSBigInt);

    const result = normalizeSignature(EXPECTED_R, highS);
    expect(result.r).toBe(EXPECTED_R); // same reference, r not modified
  });

  it('should handle s equal to secp256k1n/2 (boundary case)', () => {
    const halfN = SECP256K1_N / 2n;
    const halfNBytes = bigIntTo32Bytes(halfN);
    const result = normalizeSignature(EXPECTED_R, halfNBytes);
    // s == halfN is not > halfN, so should remain unchanged
    expect(Buffer.from(result.s).toString('hex')).toBe(
      Buffer.from(halfNBytes).toString('hex'),
    );
  });

  it('should normalize s equal to secp256k1n/2 + 1', () => {
    const halfNPlusOne = SECP256K1_N / 2n + 1n;
    const input = bigIntTo32Bytes(halfNPlusOne);
    const result = normalizeSignature(EXPECTED_R, input);
    const resultBigInt = bytesToBigInt(result.s);
    const expected = SECP256K1_N - halfNPlusOne;
    expect(resultBigInt).toBe(expected);
    // Result should be <= halfN (low-s range)
    expect(resultBigInt <= SECP256K1_N / 2n).toBe(true);
  });
});

// ============================================================================
// resolveRecoveryParam
// ============================================================================

describe('resolveRecoveryParam', () => {
  it('should resolve yParity for a known signature', async () => {
    const yParity = await resolveRecoveryParam(
      DIGEST,
      EXPECTED_R,
      EXPECTED_S,
      HARDHAT_0_ADDRESS,
    );
    expect(yParity).toBe(1);
  });

  it('should throw when no valid yParity matches the address', async () => {
    const wrongAddress: Address = '0x0000000000000000000000000000000000000001';
    await expect(
      resolveRecoveryParam(DIGEST, EXPECTED_R, EXPECTED_S, wrongAddress),
    ).rejects.toThrow('no matching yParity found');
  });

  it('should handle case-insensitive address comparison', async () => {
    const lowerCaseAddress = HARDHAT_0_ADDRESS.toLowerCase() as Address;
    const yParity = await resolveRecoveryParam(
      DIGEST,
      EXPECTED_R,
      EXPECTED_S,
      lowerCaseAddress,
    );
    expect(yParity).toBe(1);
  });
});

// ============================================================================
// publicToAddress
// ============================================================================

describe('publicToAddress', () => {
  it('should derive the correct Ethereum address from an uncompressed public key', () => {
    const address = publicToAddress(HARDHAT_0_PUBKEY);
    expect(address.toLowerCase()).toBe(HARDHAT_0_ADDRESS.toLowerCase());
  });

  it('should throw for invalid public key length', () => {
    const shortKey = new Uint8Array(64);
    shortKey[0] = 0x04;
    expect(() => publicToAddress(shortKey)).toThrow(
      'Expected 65-byte uncompressed public key starting with 0x04',
    );
  });

  it('should throw for compressed public key (wrong prefix)', () => {
    const compressed = new Uint8Array(65);
    compressed[0] = 0x02;
    expect(() => publicToAddress(compressed)).toThrow(
      'Expected 65-byte uncompressed public key starting with 0x04',
    );
  });
});

// ============================================================================
// bytesToBigInt / bigIntTo32Bytes (roundtrip)
// ============================================================================

describe('bytesToBigInt / bigIntTo32Bytes', () => {
  it('should roundtrip a known value', () => {
    const original = 0xdeadbeefcafebaben;
    const bytes = bigIntTo32Bytes(original);
    const result = bytesToBigInt(bytes);
    expect(result).toBe(original);
  });

  it('should handle zero', () => {
    const bytes = bigIntTo32Bytes(0n);
    expect(bytes.length).toBe(32);
    expect(bytes.every((b) => b === 0)).toBe(true);
    expect(bytesToBigInt(bytes)).toBe(0n);
  });

  it('should handle secp256k1 curve order', () => {
    const bytes = bigIntTo32Bytes(SECP256K1_N);
    const result = bytesToBigInt(bytes);
    expect(result).toBe(SECP256K1_N);
  });

  it('should produce exactly 32 bytes', () => {
    const bytes = bigIntTo32Bytes(1n);
    expect(bytes.length).toBe(32);
    expect(bytes[31]).toBe(1);
    expect(bytes[0]).toBe(0);
  });
});
