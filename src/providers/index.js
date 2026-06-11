import { SurplusProvider } from './surplus.js';

export function createAnalysisProvider(options = {}) {
  const provider = options.aiProvider || options.provider || 'heuristic';
  if (!provider || provider === 'heuristic' || provider === 'none' || provider === 'local') return null;
  if (provider === 'surplus') {
    return new SurplusProvider(options.surplusOptions || options);
  }
  throw new Error(`Unsupported aiProvider: ${provider}`);
}

export { SurplusProvider };
