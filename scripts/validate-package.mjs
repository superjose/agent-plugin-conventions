import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';
const root = process.cwd();
const temp = mkdtempSync(join(tmpdir(), 'conventions-package-'));
try {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', temp], { encoding: 'utf8' }))[0];
  assert(!packed.files.some(({ path }) => /test|node_modules|scripts\/|\.github/.test(path)), 'Unexpected published files');
  writeFileSync(join(temp, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', join(temp, packed.filename)], { cwd: temp, stdio: 'pipe' });
  const installed = join(temp, 'node_modules/@superjose/agent-plugin-conventions');
  const { default: plugin, rules, configs } = await import(pathToFileURL(join(installed, 'index.js')));
  assert.equal(Object.keys(rules).length, 10);
  assert.equal(plugin.meta.version, JSON.parse(readFileSync(join(installed, 'package.json'))).version);
  const all = JSON.parse(readFileSync(join(installed, 'oxlint/all.json')));
  assert.deepEqual(configs.all.rules, all.rules);
  for (const name of Object.keys(configs)) {
    const preset = JSON.parse(readFileSync(join(installed, `oxlint/${name}.json`)));
    assert.deepEqual(configs[name].rules, preset.rules);
    assert.equal(configs[name].plugins.conventions, plugin);
  }
  const valid = join(temp, 'src/server/middleware/auth.middleware.ts');
  const invalid = join(temp, 'src/server/middleware/auth.ts');
  mkdirSync(join(temp, 'src/server/middleware'), { recursive: true });
  for (const file of [valid, invalid]) writeFileSync(file, 'export {};\n');
  writeFileSync(join(temp, '.oxlintrc.json'), JSON.stringify({
    jsPlugins: [{ name: 'conventions', specifier: '@superjose/agent-plugin-conventions' }],
    extends: ['./node_modules/@superjose/agent-plugin-conventions/oxlint/tanstack.json']
  }));
  const oxlint = resolve(root, 'node_modules/.bin/oxlint');
  for (const [file, status] of [[valid, 0], [invalid, 1]]) {
    const result = spawnSync(oxlint, ['-c', join(temp, '.oxlintrc.json'), file], { cwd: temp, encoding: 'utf8' });
    assert.equal(result.status, status, result.stdout + result.stderr);
    if (status) assert.match(result.stdout + result.stderr, /tanstack-middleware-file/);
  }
  const eslint = new ESLint({ cwd: temp, overrideConfigFile: true, overrideConfig: [{ files: ['**/*.ts'], ...configs.tanstack }] });
  const results = await eslint.lintFiles([valid, invalid]);
  assert.equal(results.find(r => r.filePath === valid).errorCount, 0);
  assert.equal(results.find(r => r.filePath === invalid).messages[0].ruleId, 'conventions/tanstack-middleware-file');
  console.log('Packed consumer validated: exports, all presets, Oxlint and ESLint valid/invalid files.');
} finally { rmSync(temp, { recursive: true, force: true }); }
