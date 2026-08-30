const fs = require('fs');
const path = require('path');

const projectDir = path.resolve(__dirname, '..');
const source = path.join(projectDir, 'build');
const destination = path.resolve(projectDir, '..', 'build', 'default');

if (!fs.existsSync(source)) {
  throw new Error(`React build directory does not exist: ${source}`);
}

fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.renameSync(source, destination);

// Production source maps are not required by the embedded web application and
// would more than double the repository size when the prebuilt frontend is
// committed for offline server builds.
const removeSourceMaps = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      removeSourceMaps(entryPath);
    } else if (entry.name.endsWith('.map')) {
      fs.rmSync(entryPath);
    }
  }
};
removeSourceMaps(destination);

console.log(`Published frontend build to ${destination}`);
