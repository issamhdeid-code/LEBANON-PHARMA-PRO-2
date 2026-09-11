// Builds the app and packages a Windows installer via electron-builder.
// Invoked by `npm run package-exe`. The `build` config lives in package.json.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const DIST = path.join(root, 'dist');

function run(cmd, args, cwd = root, shell = false) {
  console.log(`\n> ${cmd} ${args.join(' ')}\n`);
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell });
  if (res.status !== 0) {
    console.error(`\nCommand failed (exit code ${res.status}).`);
    process.exit(res.status ?? 1);
  }
}

// ---- Pre-flight gates -----------------------------------------------------------
const gates = [];
if (!fs.existsSync(path.join(root, 'build-data-policy.json'))) {
  gates.push('build-data-policy.json is missing.');
}
if (!fs.existsSync(path.join(root, 'main.cjs'))) {
  gates.push('main.cjs is missing.');
}
try {
  require.resolve('electron-builder/out/cli/cli.js', { paths: [root] });
} catch (err) {
  gates.push('electron-builder is not installed. Run `npm install` first.');
}
if (gates.length > 0) {
  console.error('\nPackaging aborted — pre-flight checks failed:\n  - ' + gates.join('\n  - ') + '\n');
  process.exit(1);
}

run('npm.cmd', ['run', 'build'], root, true);

// Post-build verification: the auto-updating main.cjs and server bundle must exist,
// otherwise the packaged exe would ship a broken app.
const requiredArtifacts = [path.join(DIST, 'index.html'), path.join(DIST, 'server.cjs')];
const missing = requiredArtifacts.filter((f) => !fs.existsSync(f));
if (missing.length > 0) {
  console.error('\nBuild output is incomplete — missing:\n  - ' + missing.join('\n  - ') + '\n');
  process.exit(1);
}

console.log('\n----------------------------\nBuild complete. Packaging Windows installer...\n----------------------------\n');
const electronBuilderCli = require.resolve('electron-builder/out/cli/cli.js');
run(process.execPath, [electronBuilderCli, '--win']);

console.log('\nPackage complete. The installer is written under release/.');