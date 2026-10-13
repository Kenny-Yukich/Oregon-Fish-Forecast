// Keep one registered local MCP session alive across brief, confirmation and run.
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const sessionDir = path.resolve(process.argv[2]);
fs.mkdirSync(sessionDir, { recursive: true });
const cli = 'C:/Users/kenny/.vscode/extensions/openai.chatgpt-26.1007.21434-win32-x64/bin/windows-x86_64/codex.exe';
const registered = spawnSync(cli, ['mcp', 'get', 'open-design', '--json'], { encoding: 'utf8', windowsHide: true });
if (registered.status !== 0) throw new Error('Cannot read local Open Design registration');
const transport = JSON.parse(registered.stdout).transport;
const child = spawn(transport.command, transport.args, { env: { ...process.env, ...transport.env }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
let buffer = '', ready = false, nextId = 2;
const queued = new Set(), pending = new Map();
const send = value => child.stdin.write(JSON.stringify(value) + '\n');
const write = (name, value) => fs.writeFileSync(path.join(sessionDir, name), JSON.stringify(value, null, 2));
write('session.json', { pid: process.pid, transportPid: child.pid, startedAt: new Date().toISOString(), status: 'initializing' });
const scan = () => {
  if (!ready) return;
  for (const filename of fs.readdirSync(sessionDir).filter(name => /^request-[a-z0-9-]+\.json$/.test(name))) {
    if (queued.has(filename)) continue;
    const job = JSON.parse(fs.readFileSync(path.join(sessionDir, filename), 'utf8').replace(/^\uFEFF/, ''));
    queued.add(filename);
    const id = nextId++;
    pending.set(id, filename.replace(/^request-/, 'result-'));
    send({ jsonrpc: '2.0', id, method: job.method || 'tools/call', params: job.method === 'tools/list' ? {} : { name: job.name, arguments: job.arguments || {} } });
  }
};
const interval = setInterval(scan, 300);
child.stderr.on('data', () => {});
child.stdout.on('data', chunk => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
    let message; try { message = JSON.parse(line); } catch { continue; }
    if (message.id === 1 && !message.error) {
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      ready = true;
      write('session.json', { pid: process.pid, transportPid: child.pid, status: 'ready' });
    } else if (pending.has(message.id)) {
      write(pending.get(message.id), message.error ? { isError: true, error: message.error } : message.result);
      pending.delete(message.id);
    }
  }
});
child.on('error', error => { write('session.json', { pid: process.pid, status: 'error', message: error.message }); clearInterval(interval); });
child.on('exit', code => { write('session.json', { pid: process.pid, status: 'exited', code }); clearInterval(interval); });
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'codex-open-design-redesign', version: '1.0' } } });
