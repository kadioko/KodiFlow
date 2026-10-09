import { spawnSync } from 'node:child_process';

const allowedAdvisories = new Set([
  // GitHub currently lists no patched braces release for this lint-only advisory.
  'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
]);

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error('Run this audit through `npm run audit`.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [npmCli, 'audit', '--json'], {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error(result.stderr || 'npm audit returned invalid JSON.');
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
if (report.error) {
  console.error(`npm audit failed: ${report.error.summary ?? report.error.message}`);
  process.exit(1);
}

const highOrCritical = Object.entries(vulnerabilities).filter(([, item]) =>
  ['high', 'critical'].includes(item.severity),
);

function isApproved(name, visiting = new Set()) {
  const item = vulnerabilities[name];
  if (!item || visiting.has(name) || item.via.length === 0) return false;

  const nextVisiting = new Set(visiting).add(name);
  return item.via.every((entry) => {
    if (typeof entry === 'string') return isApproved(entry, nextVisiting);
    return allowedAdvisories.has(entry.url);
  });
}

const unapproved = highOrCritical.filter(([name]) => !isApproved(name));
const approved = highOrCritical.filter(([name]) => isApproved(name));

for (const [name] of approved) {
  console.warn(`Known unpatched advisory (temporarily allowed): ${name}`);
}

if (unapproved.length > 0) {
  console.error('High or critical dependency vulnerabilities require attention:');
  for (const [name, item] of unapproved) {
    console.error(`- ${name}: ${item.severity}`);
  }
  process.exit(1);
}

console.log('Dependency audit passed.');
