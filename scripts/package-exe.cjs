// Builds the app and packages a Windows installer via electron-builder.
// Invoked by `npm run package-exe`. The `build` config lives in package.json.
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

function run(cmd, args, cwd = root, shell = false) {
  console.log(`\n> ${cmd} ${args.join(' ')}\n`);
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell });
  if (res.status !== 0) {
    console.error(`\nCommand failed (exit code ${res.status}).`);
    process.exit(res.status ?? 1);
  }
}

run('npm.cmd', ['run', 'build'], root, true);

console.log('\n----------------------------\nBuild complete. Packaging Windows installer...\n----------------------------\n');
const electronBuilderCli = require.resolve('electron-builder/out/cli/cli.js');
run(process.execPath, [electronBuilderCli, '--win']);

console.log('\nPackage complete. The installer is written under release/.');