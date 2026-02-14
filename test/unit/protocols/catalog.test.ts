import { describe, it, expect } from 'vitest';
import { ACTION_CATALOG, listActions, erc20Abi, uniswapV3SwapRouterAbi } from '@/protocols/catalog.js';

describe('Protocol Action Catalog', () => {
  it('should export all expected action keys', () => {
    const keys = listActions();
    expect(keys).toContain('erc20:approve');
    expect(keys).toContain('erc20:transfer');
    expect(keys).toContain('uniswap_v3:exactInputSingle');
    expect(keys).toHaveLength(3);
  });

  it('erc20:approve should have correct metadata', () => {
    const action = ACTION_CATALOG['erc20:approve'];
    expect(action.protocol).toBe('erc20');
    expect(action.action).toBe('approve');
    expect(action.selector).toBe('0x095ea7b3');
    expect(action.paramNames).toEqual(['spender', 'amount']);
    expect(action.paramTypes).toEqual(['address', 'uint256']);
  });

  it('erc20:transfer should have correct metadata', () => {
    const action = ACTION_CATALOG['erc20:transfer'];
    expect(action.protocol).toBe('erc20');
    expect(action.action).toBe('transfer');
    expect(action.selector).toBe('0xa9059cbb');
    expect(action.paramNames).toEqual(['to', 'amount']);
    expect(action.paramTypes).toEqual(['address', 'uint256']);
  });

  it('uniswap_v3:exactInputSingle should have correct metadata', () => {
    const action = ACTION_CATALOG['uniswap_v3:exactInputSingle'];
    expect(action.protocol).toBe('uniswap_v3');
    expect(action.action).toBe('exactInputSingle');
    expect(action.selector).toBe('0x04e45aaf');
    expect(action.paramNames).toEqual([
      'tokenIn', 'tokenOut', 'fee', 'recipient',
      'amountIn', 'amountOutMinimum', 'sqrtPriceLimitX96',
    ]);
  });

  it('erc20Abi should contain approve and transfer', () => {
    expect(erc20Abi).toHaveLength(2);
    expect(erc20Abi[0].name).toBe('approve');
    expect(erc20Abi[1].name).toBe('transfer');
  });

  it('uniswapV3SwapRouterAbi should contain exactInputSingle', () => {
    expect(uniswapV3SwapRouterAbi).toHaveLength(1);
    expect(uniswapV3SwapRouterAbi[0].name).toBe('exactInputSingle');
  });

  it('each action abi should have exactly one function matching the action name', () => {
    for (const [key, action] of Object.entries(ACTION_CATALOG)) {
      expect(action.abi).toHaveLength(1);
      expect(action.abi[0].name).toBe(action.action);
      // Verify paramNames length matches param count
      if (action.abi[0].inputs[0]?.type === 'tuple') {
        // Tuple: params are in components
        const components = (action.abi[0].inputs[0] as { components: unknown[] }).components;
        expect(action.paramNames).toHaveLength(components.length);
      } else {
        expect(action.paramNames).toHaveLength(action.abi[0].inputs.length);
      }
      expect(action.paramTypes).toHaveLength(action.paramNames.length);
      // Key format: protocol:action
      expect(key).toBe(`${action.protocol}:${action.action}`);
    }
  });
});
