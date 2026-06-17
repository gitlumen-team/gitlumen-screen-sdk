import { SurplusProvider } from './surplus.js';
import { VeniceProvider } from './venice.js';

export function createAnalysisProvider(options = {}) {
  const provider = options.aiProvider || options.provider || 'heuristic';
  if (!provider || provider === 'heuristic' || provider === 'none' || provider === 'local') return null;
  if (provider === 'surplus') {
    return new SurplusProvider(options.surplusOptions || options);
  }
  if (provider === 'venice') {
    return new VeniceProvider(options.veniceOptions || options);
  }
  throw new Error(`Unsupported aiProvider: ${provider}`);
}

export { SurplusProvider, VeniceProvider };
