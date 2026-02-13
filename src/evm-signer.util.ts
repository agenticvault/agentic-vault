// Re-export shim for backward compatibility.
// Canonical location: src/crypto/evm-signer.util.ts
export {
  parseDerSignature,
  parseDerPublicKey,
  normalizeSignature,
  resolveRecoveryParam,
  publicToAddress,
  bytesToBigInt,
  bigIntTo32Bytes,
} from './crypto/evm-signer.util.js';
