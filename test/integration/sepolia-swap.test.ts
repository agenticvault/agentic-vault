import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  createPublicClient,
  http,
  formatEther,
  formatUnits,
  parseEther,
  encodeFunctionData,
  type Address,
  type PublicClient,
} from 'viem';
import { sepolia } from 'viem/chains';
import {
  createSigningProvider,
  EvmSignerAdapter,
  type SignerAdapter,
} from '@/index.js';
import { signAndBroadcast } from '../helpers/sepolia-broadcast.js';

/**
 * Sepolia testnet Uniswap V3 swap integration tests.
 *
 * Exercises the full signing → broadcast → receipt flow for DeFi operations:
 *   1. WETH wrap (ETH → WETH deposit)
 *   2. ERC-20 approve (WETH → Router)
 *   3. Uniswap V3 exactInputSingle (WETH → USDC)
 *
 * Required environment variables:
 *   SIGNER_KEY_ID      - AWS KMS key ID (secp256k1, sign-enabled)
 *   SIGNER_REGION      - AWS region (default: ap-northeast-1)
 *   AWS_PROFILE or AWS_ACCESS_KEY_ID/SECRET - AWS credentials
 *
 * Optional:
 *   SEPOLIA_RPC_URL    - Custom Sepolia RPC endpoint
 *
 * Skip: Tests are skipped automatically when SIGNER_KEY_ID is not set,
 *       when the signer address has insufficient balance, or when
 *       the Uniswap V3 WETH/USDC pool has no liquidity.
 */

// ============================================================================
// Environment
// ============================================================================

const SIGNER_KEY_ID = process.env.SIGNER_KEY_ID;
const SIGNER_REGION = process.env.SIGNER_REGION ?? 'ap-northeast-1';
const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

/** Minimum balance to run swap tests (0.0001 ETH for wrap + approve + swap + gas headroom) */
const MIN_BALANCE_WEI = parseEther('0.0001');
const SWAP_AMOUNT = parseEther('0.00001');

const describeWithTestnet = SIGNER_KEY_ID ? describe.sequential : describe.skip;

// ============================================================================
// Contract addresses (Sepolia)
// ============================================================================

const WETH_SEPOLIA = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as Address;
const USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address;
const UNISWAP_V3_ROUTER = '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E' as Address;
const UNISWAP_V3_FACTORY = '0x0227628f3F023bb0B980b67D528571c95c6DaC1c' as Address;

// ============================================================================
// ABI fragments
// ============================================================================

const wethDepositAbi = [
  {
    type: 'function' as const,
    name: 'deposit',
    inputs: [],
    outputs: [],
    stateMutability: 'payable' as const,
  },
] as const;

const erc20Abi = [
  {
    type: 'function' as const,
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
    ],
    outputs: [{ name: '', type: 'bool' as const }],
    stateMutability: 'nonpayable' as const,
  },
  {
    type: 'function' as const,
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' as const }],
    outputs: [{ name: '', type: 'uint256' as const }],
    stateMutability: 'view' as const,
  },
] as const;

const factoryGetPoolAbi = [
  {
    type: 'function' as const,
    name: 'getPool',
    inputs: [
      { name: 'tokenA', type: 'address' as const },
      { name: 'tokenB', type: 'address' as const },
      { name: 'fee', type: 'uint24' as const },
    ],
    outputs: [{ name: '', type: 'address' as const }],
    stateMutability: 'view' as const,
  },
] as const;

const poolLiquidityAbi = [
  {
    type: 'function' as const,
    name: 'liquidity',
    inputs: [],
    outputs: [{ name: '', type: 'uint128' as const }],
    stateMutability: 'view' as const,
  },
] as const;

const exactInputSingleAbi = [
  {
    type: 'function' as const,
    name: 'exactInputSingle',
    stateMutability: 'payable' as const,
    inputs: [
      {
        name: 'params',
        type: 'tuple' as const,
        components: [
          { name: 'tokenIn', type: 'address' as const },
          { name: 'tokenOut', type: 'address' as const },
          { name: 'fee', type: 'uint24' as const },
          { name: 'recipient', type: 'address' as const },
          { name: 'amountIn', type: 'uint256' as const },
          { name: 'amountOutMinimum', type: 'uint256' as const },
          { name: 'sqrtPriceLimitX96', type: 'uint160' as const },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' as const }],
  },
] as const;

// ============================================================================
// Helpers
// ============================================================================

const ETHERSCAN_BASE = 'https://sepolia.etherscan.io/tx/';

// ============================================================================
// Tests
// ============================================================================

describeWithTestnet('Sepolia Uniswap V3 Swap', () => {
  let signer: SignerAdapter;
  let publicClient: PublicClient;
  let signerAddress: Address;
  let suiteSkipped = false;
  let selectedFee: number;

  beforeAll(async () => {
    // --- Create signer via Provider Abstraction layer ---
    const provider = createSigningProvider({
      provider: 'aws-kms',
      keyId: SIGNER_KEY_ID!,
      region: SIGNER_REGION,
    });
    signer = new EvmSignerAdapter(provider);

    publicClient = createPublicClient({
      chain: sepolia,
      transport: http(SEPOLIA_RPC_URL),
    });

    // --- Safety: assert Sepolia ---
    try {
      const chainId = await publicClient.getChainId();
      if (chainId !== sepolia.id) {
        console.warn(`\n  RPC returned chainId ${chainId}, expected ${sepolia.id}. Skipping.\n`);
        suiteSkipped = true;
        return;
      }
    } catch (err: unknown) {
      console.warn(
        `\n  RPC connection failed (${err instanceof Error ? err.message : String(err)}).` +
          '\n  Set SEPOLIA_RPC_URL — skipping swap tests.\n',
      );
      suiteSkipped = true;
      return;
    }

    // --- Derive signer address ---
    try {
      signerAddress = await signer.getAddress();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/token.*expired|credentials.*expired|sso.*login/i.test(msg)) {
        console.warn(
          '\n  AWS credentials expired — skipping Sepolia swap tests.\n' +
            '  Run `aws sso login` to refresh.\n',
        );
        suiteSkipped = true;
        return;
      }
      throw err;
    }

    // --- Balance check ---
    const balance = await publicClient.getBalance({ address: signerAddress });
    if (balance < MIN_BALANCE_WEI) {
      console.warn(
        `\n  Signer ${signerAddress} has ${formatEther(balance)} ETH (need >= ${formatEther(MIN_BALANCE_WEI)}).` +
          '\n  Fund via faucet: https://sepoliafaucet.com/ — skipping swap tests.\n',
      );
      suiteSkipped = true;
      return;
    }

    // --- Check Uniswap V3 pool liquidity ---
    const FEE_TIERS = [500, 3000, 10000];
    for (const fee of FEE_TIERS) {
      try {
        const poolAddr = await publicClient.readContract({
          address: UNISWAP_V3_FACTORY,
          abi: factoryGetPoolAbi,
          functionName: 'getPool',
          args: [WETH_SEPOLIA, USDC_SEPOLIA, fee],
        });
        if (poolAddr && poolAddr !== '0x0000000000000000000000000000000000000000') {
          const liquidity = await publicClient.readContract({
            address: poolAddr as Address,
            abi: poolLiquidityAbi,
            functionName: 'liquidity',
          });
          if (liquidity > 0n) {
            selectedFee = fee;
            break;
          }
        }
      } catch {
        // Try next fee tier
      }
    }

    if (!selectedFee) {
      console.warn('\n  No WETH/USDC pool with liquidity on Sepolia — skipping swap tests.\n');
      suiteSkipped = true;
    }
  }, 60_000);

  beforeEach((ctx) => {
    if (suiteSkipped) ctx.skip();
  });

  // --------------------------------------------------------------------------
  // Step 1: Wrap ETH → WETH
  // --------------------------------------------------------------------------

  let wrapTxHash: `0x${string}`;

  it('should wrap ETH → WETH via deposit()', async () => {
    const data = encodeFunctionData({
      abi: wethDepositAbi,
      functionName: 'deposit',
    });

    const result = await signAndBroadcast(publicClient, signer, signerAddress, {
      to: WETH_SEPOLIA,
      data,
      value: SWAP_AMOUNT,
    });

    wrapTxHash = result.txHash;
    expect(result.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.blockNumber).toBeGreaterThan(0n);

    // Verify WETH balance increased
    const wethBalance = await publicClient.readContract({
      address: WETH_SEPOLIA,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [signerAddress],
    });
    expect(wethBalance).toBeGreaterThanOrEqual(SWAP_AMOUNT);

    console.log(`  WETH wrap: ${ETHERSCAN_BASE}${result.txHash}`);
  }, 240_000);

  // --------------------------------------------------------------------------
  // Step 2: Approve WETH for Uniswap V3 Router
  // --------------------------------------------------------------------------

  let approveTxHash: `0x${string}`;

  it('should approve WETH for Uniswap V3 Router', async () => {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [UNISWAP_V3_ROUTER, SWAP_AMOUNT],
    });

    const result = await signAndBroadcast(publicClient, signer, signerAddress, {
      to: WETH_SEPOLIA,
      data,
    });

    approveTxHash = result.txHash;
    expect(result.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.blockNumber).toBeGreaterThan(0n);

    console.log(`  WETH approve: ${ETHERSCAN_BASE}${result.txHash}`);
  }, 240_000);

  // --------------------------------------------------------------------------
  // Step 3: Swap WETH → USDC via exactInputSingle
  // --------------------------------------------------------------------------

  let swapTxHash: `0x${string}`;

  it('should swap WETH → USDC via Uniswap V3 exactInputSingle', async () => {
    const data = encodeFunctionData({
      abi: exactInputSingleAbi,
      functionName: 'exactInputSingle',
      args: [
        {
          tokenIn: WETH_SEPOLIA,
          tokenOut: USDC_SEPOLIA,
          fee: selectedFee,
          recipient: signerAddress,
          amountIn: SWAP_AMOUNT,
          amountOutMinimum: 0n, // Testnet — no slippage concern
          sqrtPriceLimitX96: 0n,
        },
      ],
    });

    const result = await signAndBroadcast(publicClient, signer, signerAddress, {
      to: UNISWAP_V3_ROUTER,
      data,
    });

    swapTxHash = result.txHash;
    expect(result.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.blockNumber).toBeGreaterThan(0n);

    console.log(`  WETH→USDC swap: ${ETHERSCAN_BASE}${result.txHash}`);
  }, 240_000);

  // --------------------------------------------------------------------------
  // Step 4: Verify USDC received
  // --------------------------------------------------------------------------

  it('should have received USDC after swap', async () => {
    const usdcBalance = await publicClient.readContract({
      address: USDC_SEPOLIA,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [signerAddress],
    });

    expect(usdcBalance).toBeGreaterThan(0n);
    console.log(`  USDC balance: ${formatUnits(usdcBalance, 6)}`);
  }, 10_000);

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------

  it('should print transaction summary', () => {
    console.log('\n  ========================================');
    console.log('           SWAP TRANSACTIONS');
    console.log('  ========================================');
    if (wrapTxHash) console.log(`  1. WETH Wrap:    ${ETHERSCAN_BASE}${wrapTxHash}`);
    if (approveTxHash) console.log(`  2. WETH Approve: ${ETHERSCAN_BASE}${approveTxHash}`);
    if (swapTxHash) console.log(`  3. WETH→USDC:    ${ETHERSCAN_BASE}${swapTxHash}`);
    console.log('  ========================================\n');

    expect(true).toBe(true);
  });
});
