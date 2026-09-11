const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Extract build config
if (pkg.build) {
  fs.writeFileSync('electron-builder.json', JSON.stringify(pkg.build, null, 2));
  delete pkg.build;
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
  console.log("Moved build config to electron-builder.json");
} else {
  console.log("No build config found in package.json");
}
