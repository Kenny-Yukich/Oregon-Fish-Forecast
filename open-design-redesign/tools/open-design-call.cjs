const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const session = fs.readFileSync(path.join(os.tmpdir(), 'oregon-open-design-active-session.txt'), 'utf8').replace(/^\uFEFF/, '').trim();
const action = process.argv[2], name = process.argv[3];
if (!/^[a-z0-9-]+$/.test(name)) throw new Error('A stable request filename is required');
const requestPath = path.join(session, `request-${name}.json`);
const resultPath = path.join(session, `result-${name}.json`);
if (action !== 'read') {
  let args = JSON.parse(fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
  if (args.$workflowFrom) {
    const prior = JSON.parse(fs.readFileSync(path.join(session, `result-${args.$workflowFrom}.json`), 'utf8'));
    delete args.$workflowFrom;
    args.pluginWorkflowId = prior.structuredContent.pluginWorkflowId;
    if (!args.pluginWorkflowId) throw new Error('The exact workflow id was not returned');
  }
  if (args.$confirmationFrom) {
    const brief = JSON.parse(fs.readFileSync(path.join(session, `result-${args.$confirmationFrom}.json`), 'utf8')).structuredContent;
    delete args.$confirmationFrom;
    args.briefDraftId = brief.briefDraftId; args.nonce = brief.nonce;
  }
  const encoded = JSON.stringify({ name: action, arguments: args });
  if (fs.existsSync(requestPath)) {
    if (fs.readFileSync(requestPath, 'utf8') !== encoded) throw new Error('Cannot change an existing request');
  } else {
    fs.writeFileSync(requestPath + '.tmp', encoded);
    fs.renameSync(requestPath + '.tmp', requestPath);
  }
}
const scrub = value => {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'questionFormsByLocale').map(([key, item]) => [key, /nonce|token|signature|credential|signedConfirmation/i.test(key) ? '[stored locally]' : scrub(item)]));
  if (typeof value === 'string' && value.trim().startsWith('{')) { try { return JSON.stringify(scrub(JSON.parse(value))); } catch {} }
  return value;
};
(async () => {
  const deadline = Date.now() + 45000;
  while (!fs.existsSync(resultPath) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 300));
  if (!fs.existsSync(resultPath)) { console.log(JSON.stringify({ status: 'waiting', resultPath })); return; }
  console.log(JSON.stringify({ resultPath, result: scrub(JSON.parse(fs.readFileSync(resultPath, 'utf8'))) }));
})();
