import type { Address, Hex, TransactionSerializable, TypedDataDefinition } from 'viem';

export type SignatureComponents = { v: number; r: Hex; s: Hex };

export type SignTypedDataParams = TypedDataDefinition;

export interface SignerAdapter {
  getAddress(): Promise<Address>;
  signTransaction(tx: TransactionSerializable): Promise<Hex>;
  signTypedData(params: SignTypedDataParams): Promise<SignatureComponents>;
  healthCheck(): Promise<void>;
}
