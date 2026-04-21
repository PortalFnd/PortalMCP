/**
 * Stdio smoke test for PortalMCP.
 *
 * Spawns the built server on stdio, exchanges an initialize handshake, then
 * verifies tools, resources, and resource templates are registered as
 * expected. Exits non-zero on any regression.
 *
 * Run: `npm run build && npm run smoke`
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

interface Expectation {
  tools: string[];
  resources: string[];
  resourceTemplates: string[];
  prompts: string[];
}

const EXPECTED: Expectation = {
  tools: [
    'eth_get_balance',
    'eth_call_contract',
    'eth_send_transaction',
    'eth_generate_contract',
    'eth_compile_contract',
    'eth_deploy_contract',
    'eth_deploy_contract_with_signer',
    'eth_create_staking_contract',
    'eth_stake_tokens',
    'eth_swap_tokens',
    'eth_swap_eth_to_usdt',
    'eth_create_token',
    'eth_get_token_balance',
    'eth_transfer_token',
    'eth_create_nft_collection',
    'eth_mint_nft',
    'eth_get_nft_owner'
  ],
  resources: ['eth://wallet'],
  resourceTemplates: ['eth://balance/{address}', 'eth://tx/{hash}', 'eth://token/{address}'],
  prompts: ['swap_tokens', 'deploy_erc20']
};

function rpc(id: number, method: string, params: any = {}) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
}

async function runSmoke(): Promise<number> {
  const entry = path.resolve(__dirname, 'index.js');
  const child = spawn(process.execPath, [entry], { stdio: ['pipe', 'pipe', 'inherit'] });

  const responses = new Map<number, any>();
  let buffer = '';
  child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (typeof msg.id === 'number') responses.set(msg.id, msg);
      } catch {
        // ignore non-JSON
      }
    }
  });

  const waitFor = (id: number, timeoutMs = 5000) => new Promise<any>((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (responses.has(id)) return resolve(responses.get(id));
      if (Date.now() - start > timeoutMs) return reject(new Error(`timeout waiting for response id ${id}`));
      setTimeout(tick, 25);
    };
    tick();
  });

  // Handshake
  child.stdin.write(rpc(1, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'portalmcp-smoke', version: '1.0.0' }
  }));
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  child.stdin.write(rpc(2, 'tools/list'));
  child.stdin.write(rpc(3, 'resources/list'));
  child.stdin.write(rpc(4, 'resources/templates/list'));
  child.stdin.write(rpc(5, 'prompts/list'));

  await waitFor(1);
  const tools = (await waitFor(2)).result.tools.map((t: any) => t.name);
  const resources = (await waitFor(3)).result.resources.map((r: any) => r.uri);
  const templates = (await waitFor(4)).result.resourceTemplates.map((r: any) => r.uriTemplate);
  const prompts = (await waitFor(5)).result.prompts.map((p: any) => p.name);

  child.stdin.end();
  child.kill();

  let failed = 0;
  const check = (label: string, expected: string[], actual: string[]) => {
    const missing = expected.filter(e => !actual.includes(e));
    if (missing.length === 0) {
      console.log(`  ✓ ${label}: ${actual.length} registered`);
    } else {
      console.error(`  ✗ ${label}: missing [${missing.join(', ')}]`);
      failed++;
    }
  };

  console.log('PortalMCP smoke test');
  check('tools', EXPECTED.tools, tools);
  check('resources', EXPECTED.resources, resources);
  check('resource templates', EXPECTED.resourceTemplates, templates);
  check('prompts', EXPECTED.prompts, prompts);

  if (failed > 0) {
    console.error(`\nFAILED: ${failed} check(s) failed.`);
    return 1;
  }
  console.log('\nOK: all MCP surfaces registered correctly.');
  return 0;
}

runSmoke()
  .then(code => process.exit(code))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
