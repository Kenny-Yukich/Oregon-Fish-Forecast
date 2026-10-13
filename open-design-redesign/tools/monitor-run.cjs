const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const session = fs.readFileSync(path.join(os.tmpdir(), 'oregon-open-design-active-session.txt'), 'utf8').replace(/^\uFEFF/, '').trim();
const read = name => JSON.parse(fs.readFileSync(path.join(session, name), 'utf8'));
const workflow = read('result-confirmed-restarted.json').structuredContent.pluginWorkflowId;
const started = JSON.parse(read('result-generate-alternate.json').content[0].text);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  for (let index = 1; ; index++) {
    const name = `monitor-${String(index).padStart(3, '0')}`;
    const resultPath = path.join(session, `result-${name}.json`);
    const requestPath = path.join(session, `request-${name}.json`);
    if (!fs.existsSync(requestPath)) {
      fs.writeFileSync(requestPath + '.tmp', JSON.stringify({ name: 'get_run', arguments: { runId: started.runId, pluginWorkflowId: workflow } }));
      fs.renameSync(requestPath + '.tmp', requestPath);
    }
    let waits = 0;
    while (!fs.existsSync(resultPath)) {
      await sleep(1000);
      if (++waits % 30 === 0) console.log(JSON.stringify({ status: 'awaiting_same_poll', poll: name, runId: started.runId }));
    }
    const response = read(`result-${name}.json`);
    let run;
    try { run = JSON.parse(response.content[0].text); } catch { run = { status: 'poll-error', response }; }
    console.log(JSON.stringify({ status: run.status, updatedAt: run.updatedAt, error: run.error, errorCode: run.errorCode,
      previewUrl: run.previewUrl, studioUrl: run.studioUrl, artifactRef: run.artifactRef,
      agentMessage: ['succeeded', 'failed', 'canceled'].includes(run.status) ? run.agentMessage : undefined, resultPath }));
    if (['succeeded', 'failed', 'canceled'].includes(run.status)) {
      fs.writeFileSync(path.join(session, 'terminal-result.json'), JSON.stringify(run, null, 2));
      return;
    }
    await sleep(35000);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
