#!/usr/bin/env node

const cmd = process.argv[2];
const repo = process.argv[3];
const rest = process.argv.slice(4);

if (!cmd || cmd === '-h' || cmd === '--help') {
  console.error(`usage: fabrick <command> <repo> [options]

commands:
  bootstrap  <repo>                    detect language/framework, derive routing rules
  fullscan   <repo>                    generate initial wiki for every app scope
  patch      <repo>                    incremental wiki update for new commits
  synthesize <out-dir> --repos=r1,r2   cross-repo synthesis on top of wikis

run 'fabrick <command>' with no args for command-specific help.
`);
  process.exit(cmd ? 0 : 1);
}

const handlers = {
  bootstrap:  () => import('../src/cli/bootstrap.js'),
  fullscan:   () => import('../src/cli/fullscan.js'),
  patch:      () => import('../src/cli/patch.js'),
  synthesize: () => import('../src/cli/synthesize.js'),
};

const loader = handlers[cmd];
if (!loader) {
  console.error(`unknown command: ${cmd}`);
  process.exit(1);
}

const mod = await loader();
await mod.run(repo, rest);
