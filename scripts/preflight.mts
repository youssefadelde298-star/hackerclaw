// Pre-flight connectivity check for a live demo.
//
// Probes every backend you have credentials for and prints PASS/FAIL per
// backend, using hackerclaw's OWN client code (so it tests the real paths).
// A backend with no key/host configured is SKIPPED, not failed.
//
//   npm run preflight
//
// Reads from the environment:
//   OLLAMA_HOST (default http://localhost:11434), OLLAMA_MODEL (default qwen2.5-coder:14b)
//   ANTHROPIC_API_KEY [, ANTHROPIC_MODEL]
//   MOONSHOT_API_KEY | KIMI_API_KEY [, MOONSHOT_BASE_URL | KIMI_BASE_URL, KIMI_MODEL]
//   ZHIPU_API_KEY | GLM_API_KEY [, ZHIPU_BASE_URL | GLM_BASE_URL, GLM_MODEL]
import { newFromConfig } from '../src/llm/factory.js';
import { listModels } from '../src/llm/models.js';
import {
  ANTHROPIC_DEFAULT_MODEL,
  GLM_DEFAULT_MODEL,
  KIMI_DEFAULT_MODEL,
} from '../src/llm/providers.js';
import { defaultConfig, type Backend, type Config } from '../src/config/config.js';

const env = process.env;
const first = (...keys: string[]) => keys.map((k) => env[k]).find((v) => v && v.length) ?? '';

type Probe = { backend: Backend; label: string; model: string; base_url: string; api_key: string; enabled: boolean; note?: string };

const probes: Probe[] = [
  {
    backend: 'ollama', label: 'Ollama (local)',
    model: env.OLLAMA_MODEL || 'qwen2.5-coder:14b',
    base_url: env.OLLAMA_HOST || 'http://localhost:11434',
    api_key: '', enabled: true, note: 'always attempted; needs `ollama serve`',
  },
  {
    backend: 'anthropic', label: 'Claude (Anthropic API)',
    model: env.ANTHROPIC_MODEL || ANTHROPIC_DEFAULT_MODEL,
    base_url: '', api_key: first('ANTHROPIC_API_KEY'),
    enabled: !!first('ANTHROPIC_API_KEY'),
  },
  {
    backend: 'kimi', label: 'Kimi / Moonshot',
    model: env.KIMI_MODEL || KIMI_DEFAULT_MODEL,
    base_url: first('MOONSHOT_BASE_URL', 'KIMI_BASE_URL'),
    api_key: first('MOONSHOT_API_KEY', 'KIMI_API_KEY'),
    enabled: !!first('MOONSHOT_API_KEY', 'KIMI_API_KEY'),
  },
  {
    backend: 'glm', label: 'GLM-4.6 (Zhipu / Z.ai)',
    model: env.GLM_MODEL || GLM_DEFAULT_MODEL,
    base_url: first('ZHIPU_BASE_URL', 'GLM_BASE_URL'),
    api_key: first('ZHIPU_API_KEY', 'GLM_API_KEY'),
    enabled: !!first('ZHIPU_API_KEY', 'GLM_API_KEY'),
  },
];

function cfgFor(p: Probe): Config {
  return { ...defaultConfig(), backend: p.backend, model: p.model, base_url: p.base_url, api_key: p.api_key, max_tokens: 64 };
}

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}

const NOOP_TOOL = {
  type: 'function' as const,
  function: { name: 'noop', description: 'reply hook', parameters: { type: 'object', properties: {} } },
};

let failed = 0, ran = 0;
console.log('\nhackerclaw pre-flight — backend connectivity\n' + '='.repeat(44));

for (const p of probes) {
  if (!p.enabled) { console.log(`\n• ${p.label}\n  SKIP  (no key configured)`); continue; }
  ran++;
  console.log(`\n• ${p.label}`);
  console.log(`  model: ${p.model}${p.base_url ? `   base: ${p.base_url}` : ''}`);

  // Step 1: auth + reachability via the model-list endpoint.
  let models: string[] = [];
  try {
    const t = withTimeout(8000);
    try { models = await listModels(p.backend, p.base_url, p.api_key, t.signal); }
    finally { t.done(); }
    console.log(`  ✓ reachable + authenticated — ${models.length} models${models.length ? ` (e.g. ${models.slice(0, 3).join(', ')})` : ''}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ FAIL at model-list: ${(e as Error).message}`);
    if (p.backend === 'kimi') console.log('    hint: wrong region? a platform.moonshot.cn key needs MOONSHOT_BASE_URL=https://api.moonshot.cn/v1');
    continue;
  }

  // Step 2: the chat endpoint actually responds.
  try {
    const client = newFromConfig(cfgFor(p));
    const t = withTimeout(30000);
    let resp;
    try { resp = await client.chat({ messages: [{ role: 'user', content: 'Reply with the single word READY.' }], tools: [NOOP_TOOL] }, t.signal); }
    finally { t.done(); }
    const text = (resp.message.content || '').trim().slice(0, 40);
    const tool = resp.message.toolCalls?.length ? ` +tool_call(${resp.message.toolCalls[0].function.name})` : '';
    console.log(`  ✓ chat responded: "${text}"${tool}  [finish: ${resp.finishReason}]`);
    console.log('  PASS');
  } catch (e) {
    failed++;
    console.log(`  ✗ FAIL at chat: ${(e as Error).message}`);
  }
}

console.log('\n' + '='.repeat(44));
console.log(`attempted: ${ran}   failed: ${failed}   skipped: ${probes.length - ran}`);
console.log(failed ? 'SOME BACKENDS FAILED — fix before the demo.\n' : ran ? 'All attempted backends are connected. ✓\n' : 'Nothing configured — set at least one key or start Ollama.\n');
process.exit(failed ? 1 : 0);
