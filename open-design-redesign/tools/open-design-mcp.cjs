// Uses only the locally registered Open Design stdio transport.
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cli = 'C:/Users/kenny/.vscode/extensions/openai.chatgpt-26.1007.21434-win32-x64/bin/windows-x86_64/codex.exe';
const registration = spawnSync(cli, ['mcp', 'get', 'open-design', '--json'], { encoding: 'utf8', windowsHide: true });
if (registration.status !== 0) throw new Error('Open Design registration could not be read.');
const transport = JSON.parse(registration.stdout).transport;
const child = spawn(transport.command, transport.args, { env: { ...process.env, ...transport.env }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
const action = process.argv[2];
const args = action === 'list-tools' ? {} : JSON.parse(fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
const resultPath = path.join(os.tmpdir(), `oregon-open-design-${process.argv[3] || action}.json`);
let buffer = '', finished = false;
const send = value => child.stdin.write(JSON.stringify(value) + '\n');
const scrub = value => {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /nonce|token|signature|credential|signedConfirmation/i.test(key) ? '[stored locally]' : scrub(item)]));
  if (typeof value === 'string' && value.trim().startsWith('{')) { try { return JSON.stringify(scrub(JSON.parse(value))); } catch {} }
  return value;
};
const finish = (code, result) => {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ resultPath, result: scrub(result) }));
  child.kill();
  process.exitCode = code;
};
const timer = setTimeout(() => finish(1, { error: 'Transport response timeout; inspect this same request before retrying.' }), 110000);
child.on('error', error => finish(1, { error: error.message }));
child.stderr.on('data', () => {});
child.stdout.on('data', chunk => {
  buffer += chunk;
  let boundary;
  while ((boundary = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 1);
    let message; try { message = JSON.parse(line); } catch { continue; }
    if (message.id === 1) {
      if (message.error) return finish(1, message.error);
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      send({ jsonrpc: '2.0', id: 2, method: action === 'list-tools' ? 'tools/list' : 'tools/call', params: action === 'list-tools' ? {} : { name: action, arguments: args } });
    }
    if (message.id === 2) finish(message.error ? 1 : 0, message.error || message.result);
  }
});
child.on('exit', code => { if (!finished) finish(1, { error: 'Transport exited before result', code }); });
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'codex-open-design-redesign', version: '1.0' } } });
