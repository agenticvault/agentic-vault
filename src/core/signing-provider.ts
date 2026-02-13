export interface SignatureBlob {
  readonly bytes: Uint8Array;
  readonly encoding: 'der' | 'raw';
  readonly algorithm: 'secp256k1' | 'ed25519';
}

export interface PublicKeyBlob {
  readonly bytes: Uint8Array;
  readonly algorithm: 'secp256k1' | 'ed25519';
}

export interface SigningProvider {
  signDigest(digest: Uint8Array): Promise<SignatureBlob>;
  getPublicKey(): Promise<PublicKeyBlob>;
  healthCheck(): Promise<void>;
}
