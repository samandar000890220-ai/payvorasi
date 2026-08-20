import fs from 'fs/promises';
import { stderr } from 'process';

async function main() {
  try {
    // remove lock files if present
    await Promise.all([
      fs.rm('package-lock.json').catch(() => {}),
      fs.rm('yarn.lock').catch(() => {}),
    ]);
  } catch (err) {
    // ignore
  }

  const ua = process.env['npm_config_user_agent'] ?? '';
  if (!ua.startsWith('pnpm/')) {
    stderr.write('Use pnpm instead\n');
    process.exit(1);
  }
}

main();
