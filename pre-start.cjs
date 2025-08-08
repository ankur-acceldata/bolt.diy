const { execSync } = require('child_process');

// Simple logger for startup script
const logger = {
  info: (...args) => console.log('\x1b[34m[INFO]\x1b[0m \x1b[90m[PreStart]\x1b[0m', ...args),
  warn: (...args) => console.log('\x1b[33m[WARN]\x1b[0m \x1b[90m[PreStart]\x1b[0m', ...args),
  error: (...args) => console.log('\x1b[31m[ERROR]\x1b[0m \x1b[90m[PreStart]\x1b[0m', ...args),
};

// Get git hash with fallback
const getGitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'no-git-info';
  }
};

let commitJson = {
  hash: JSON.stringify(getGitHash()),
  version: JSON.stringify(process.env.npm_package_version),
};

logger.info(`
★═══════════════════════════════════════★
          B O L T . D I Y
         ⚡️  Welcome  ⚡️
★═══════════════════════════════════════★
`);
logger.info('📍 Current Version Tag:', `v${commitJson.version}`);
logger.info('📍 Current Commit Version:', commitJson.hash);
logger.info('  Please wait until the URL appears here');
logger.info('★═══════════════════════════════════════★');
