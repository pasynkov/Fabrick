import { existsSync, readdirSync } from 'fs';
import { PassThrough } from 'stream';
import archiver from 'archiver';
import { readConfig } from '../config.js';

const CONTEXT_DIR = '.fabrick/context';

function zipToBuffer(directory) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const pass = new PassThrough();
    pass.on('data', chunk => chunks.push(chunk));
    pass.on('end', () => resolve(Buffer.concat(chunks)));
    pass.on('error', reject);

    const archive = archiver('zip');
    archive.on('error', reject);
    archive.pipe(pass);
    archive.directory(directory, false);
    archive.finalize();
  });
}

export async function push() {
  let config;
  try {
    config = readConfig();
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }

  const { repo, backendUrl } = config;

  if (!existsSync(CONTEXT_DIR) || readdirSync(CONTEXT_DIR).length === 0) {
    console.error(`✗ ${CONTEXT_DIR} not found or empty.`);
    console.error('  Run /fabrick-analyze in Claude Code first.');
    process.exit(1);
  }

  let buffer;
  try {
    buffer = await zipToBuffer(CONTEXT_DIR);
  } catch (err) {
    console.error(`✗ Failed to zip context: ${err.message}`);
    process.exit(1);
  }

  const url = `${backendUrl}/context/${repo}`;
  const formData = new FormData();
  formData.append('file', new Blob([buffer]), 'context.zip');

  let response;
  try {
    response = await fetch(url, { method: 'POST', body: formData });
  } catch (err) {
    console.error(`✗ Could not connect to backend at ${backendUrl}`);
    console.error(`  ${err.message}`);
    process.exit(1);
  }

  if (response.ok) {
    console.log(`✓ Context pushed successfully`);
    console.log(`  Repo:    ${repo}`);
    console.log(`  Backend: ${backendUrl}`);
    console.log(`  HTTP:    ${response.status}`);
  } else {
    const body = await response.text().catch(() => '');
    console.error(`✗ Upload failed — HTTP ${response.status}`);
    if (body) console.error(`  ${body}`);
    process.exit(1);
  }
}
