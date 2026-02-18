import { parseDecimalBigInt, type WorkflowContext, type WorkflowResult } from './types.js';

export interface SignPermitInput {
  chainId: number;
  token: string;
  spender: string;
  value: string;
  deadline: number;
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  message: Record<string, unknown>;
}

const DEFAULT_SERVICE = 'agentic-vault';
const CANONICAL_PERMIT_FIELDS = new Set(['owner', 'spender', 'value', 'nonce', 'deadline']);

/**
 * EIP-2612 permit signing workflow.
 *
 * Security validations:
 * 1. Canonical EIP-2612 types.Permit field check
 * 2. Message field presence (value, spender, deadline)
 * 3. Payload/metadata consistency (message vs top-level args)
 * 4. Domain validation (verifyingContract, chainId)
 */
export async function signPermit(
  ctx: WorkflowContext,
  input: SignPermitInput,
): Promise<WorkflowResult> {
  const service = ctx.service ?? DEFAULT_SERVICE;
  const token = input.token.toLowerCase() as `0x${string}`;

  // 0. Guard against non-object domain/types/message (no Zod at workflow boundary)
  if (!input.domain || typeof input.domain !== 'object') {
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: 'Invalid domain parameter: must be a non-null object',
      why: 'Input validation failed',
      result: 'error',
      details: { chainId: input.chainId, token },
    });
    return { status: 'error', reason: 'domain must be a non-null object' };
  }
  if (!input.types || typeof input.types !== 'object') {
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: 'Invalid types parameter: must be a non-null object',
      why: 'Input validation failed',
      result: 'error',
      details: { chainId: input.chainId, token },
    });
    return { status: 'error', reason: 'types must be a non-null object' };
  }
  if (!input.message || typeof input.message !== 'object') {
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: 'Invalid message parameter: must be a non-null object',
      why: 'Input validation failed',
      result: 'error',
      details: { chainId: input.chainId, token },
    });
    return { status: 'error', reason: 'message must be a non-null object' };
  }

  // 1. Parse value safely
  let amountWei: bigint;
  try {
    amountWei = parseDecimalBigInt(input.value);
  } catch {
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: `Invalid value parameter for token ${token} on chain ${input.chainId}`,
      why: 'Input validation: value must be a decimal string',
      result: 'error',
      details: { chainId: input.chainId, token },
    });
    return { status: 'error', reason: 'Invalid value: must be a decimal string' };
  }

  // 2. Evaluate policy
  const evaluation = ctx.policyEngine.evaluate({
    chainId: input.chainId,
    to: token,
    amountWei,
    deadline: input.deadline,
  });

  if (!evaluation.allowed) {
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: `Permit signing denied for token ${token} on chain ${input.chainId}`,
      why: `Policy violations: ${evaluation.violations.join('; ')}`,
      result: 'denied',
      details: { chainId: input.chainId, token, spender: input.spender, violations: evaluation.violations },
    });
    return {
      status: 'denied',
      reason: `Policy denied: ${evaluation.violations.join('; ')}`,
      violations: evaluation.violations,
    };
  }

  // 3. Validate types.Permit matches canonical EIP-2612 schema
  const typesPermit = (input.types as Record<string, unknown>)?.Permit;
  if (!Array.isArray(typesPermit)) {
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: 'Permit types.Permit is missing or not an array',
      why: 'Canonical EIP-2612 requires types.Permit definition',
      result: 'denied',
      details: { chainId: input.chainId, token },
    });
    return {
      status: 'denied',
      reason: 'types.Permit must be an array of EIP-712 field definitions',
    };
  }

  const typeFieldNames = new Set(
    typesPermit
      .filter(
        (f: unknown): f is { name: string } =>
          typeof f === 'object' &&
          f !== null &&
          typeof (f as Record<string, unknown>).name === 'string',
      )
      .map((f) => f.name),
  );
  const missingTypeFields = [...CANONICAL_PERMIT_FIELDS].filter((f) => !typeFieldNames.has(f));
  if (missingTypeFields.length > 0) {
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: `Permit types.Permit missing required fields: ${missingTypeFields.join(', ')}`,
      why: 'EIP-712 digest only includes fields listed in types; omitting policy-checked fields is a bypass',
      result: 'denied',
      details: { chainId: input.chainId, token, missingTypeFields },
    });
    return {
      status: 'denied',
      reason: `types.Permit must include canonical fields: ${missingTypeFields.join(', ')} missing`,
    };
  }

  // 4. Validate canonical EIP-2612 Permit fields are present in message
  const message = input.message;
  if (message.value == null || message.spender == null || message.deadline == null) {
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: 'Permit message missing required EIP-2612 fields',
      why: 'Canonical Permit must include value, spender, and deadline',
      result: 'denied',
      details: {
        chainId: input.chainId,
        token,
        hasValue: message.value != null,
        hasSpender: message.spender != null,
        hasDeadline: message.deadline != null,
      },
    });
    return {
      status: 'denied',
      reason: 'Permit message must include value, spender, and deadline fields',
    };
  }

  // 5. Validate message fields match policy-checked args
  if (String(message.value) !== input.value) {
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: `Permit payload mismatch: message.value (${String(message.value)}) !== args.value (${input.value})`,
      why: 'Payload/metadata consistency check failed',
      result: 'denied',
      details: { chainId: input.chainId, token, messageValue: String(message.value), argsValue: input.value },
    });
    return {
      status: 'denied',
      reason: 'Payload mismatch: message.value does not match value',
    };
  }

  if (String(message.spender).toLowerCase() !== input.spender.toLowerCase()) {
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: `Permit payload mismatch: message.spender (${String(message.spender)}) !== args.spender (${input.spender})`,
      why: 'Payload/metadata consistency check failed',
      result: 'denied',
      details: { chainId: input.chainId, token, messageSpender: String(message.spender), argsSpender: input.spender },
    });
    return {
      status: 'denied',
      reason: 'Payload mismatch: message.spender does not match spender',
    };
  }

  if (String(message.deadline) !== String(input.deadline)) {
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: `Permit payload mismatch: message.deadline (${String(message.deadline)}) !== args.deadline (${input.deadline})`,
      why: 'Payload/metadata consistency check failed',
      result: 'denied',
      details: { chainId: input.chainId, token, messageDeadline: String(message.deadline), argsDeadline: input.deadline },
    });
    return {
      status: 'denied',
      reason: 'Payload mismatch: message.deadline does not match deadline',
    };
  }

  // 6. Validate EIP-712 domain
  const domain = input.domain as { verifyingContract?: string; chainId?: number };

  if (!domain.verifyingContract || !domain.chainId) {
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: 'Permit domain missing required fields',
      why: 'Domain must include verifyingContract and chainId for replay protection',
      result: 'denied',
      details: {
        chainId: input.chainId,
        token,
        hasVerifyingContract: !!domain.verifyingContract,
        hasChainId: domain.chainId != null,
      },
    });
    return {
      status: 'denied',
      reason: 'Permit domain must include verifyingContract and chainId',
    };
  }

  if (domain.verifyingContract.toLowerCase() !== token) {
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: `Permit payload mismatch: domain.verifyingContract (${domain.verifyingContract}) !== token (${token})`,
      why: 'Payload/metadata consistency check failed',
      result: 'denied',
      details: { chainId: input.chainId, token, domainContract: domain.verifyingContract },
    });
    return {
      status: 'denied',
      reason: 'Payload mismatch: domain.verifyingContract does not match token',
    };
  }

  if (domain.chainId !== input.chainId) {
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: `Permit payload mismatch: domain.chainId (${domain.chainId}) !== args.chainId (${input.chainId})`,
      why: 'Payload/metadata consistency check failed',
      result: 'denied',
      details: { argsChainId: input.chainId, domainChainId: domain.chainId },
    });
    return {
      status: 'denied',
      reason: 'Payload mismatch: domain.chainId does not match chainId',
    };
  }

  // 7. Dry-run: return validation result without signing
  if (ctx.dryRun) {
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: `Dry-run approved permit for token ${token} on chain ${input.chainId}`,
      why: 'Permit validation passed (dry-run)',
      result: 'approved',
      details: { chainId: input.chainId, token, spender: input.spender, dryRun: true },
    });
    return {
      status: 'dry-run-approved',
      details: {
        chainId: input.chainId,
        token,
        spender: input.spender,
        value: input.value,
        deadline: input.deadline,
      },
    };
  }

  // 8. Sign
  if (!ctx.signer) {
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: 'Signer not available for permit signing',
      why: 'Configuration error: signer is required when dryRun is not enabled',
      result: 'error',
    });
    return { status: 'error', reason: 'Signer is required when dryRun is not enabled' };
  }

  try {
    const sig = await ctx.signer.signTypedData({
      domain: input.domain,
      types: input.types,
      primaryType: 'Permit',
      message: input.message,
    });

    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: `Signed permit for token ${token} on chain ${input.chainId}`,
      why: 'Permit signing approved by policy',
      result: 'approved',
      details: { chainId: input.chainId, token, spender: input.spender },
    });

    return {
      status: 'approved',
      data: JSON.stringify(sig),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.auditSink.log({
      service,
      action: 'sign_permit',
      who: ctx.caller,
      what: `Failed to sign permit for token ${token}`,
      why: 'Signing error',
      result: 'error',
      details: { error: msg },
    });
    return { status: 'error', reason: `Signing error: ${msg}` };
  }
}
