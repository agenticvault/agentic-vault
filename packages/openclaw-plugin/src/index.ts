import { type OpenClawPluginApi, type OpenClawPluginConfig } from './types.js';
import { buildContext } from './context.js';
import { registerTools } from './tools.js';

/**
 * OpenClaw plugin entry point.
 * Called by the OpenClaw host to register vault signing tools.
 */
export default function (api: OpenClawPluginApi): void {
  const config = (api.pluginConfig ?? {}) as unknown as OpenClawPluginConfig;
  const ctx = buildContext(config);
  registerTools(api, ctx, config);
}

export { type OpenClawPluginConfig } from './types.js';
export { buildContext } from './context.js';
export { registerTools } from './tools.js';
