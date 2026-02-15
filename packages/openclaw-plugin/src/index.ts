export {
  type OpenClawPluginApi,
  type OpenClawToolConfig,
  type OpenClawParameter,
  type OpenClawToolHandler,
  type OpenClawToolResult,
  type OpenClawPluginConfig,
} from './types.js';
export { buildContext } from './context.js';
export { registerTools } from './tools.js';

import { type OpenClawPluginApi, type OpenClawPluginConfig } from './types.js';
import { buildContext } from './context.js';
import { registerTools } from './tools.js';

/**
 * OpenClaw plugin entry point.
 * Called by the OpenClaw host to register vault signing tools.
 */
export function register(
  api: OpenClawPluginApi,
  config: OpenClawPluginConfig,
): void {
  const ctx = buildContext(config);
  registerTools(api, ctx, config);
}
