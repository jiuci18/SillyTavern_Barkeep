const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const packageRoot = path.dirname(require.resolve('better-sqlite3/package.json'));
const outputRoot = path.join(projectRoot, 'dist', 'node_modules', 'better-sqlite3');
const runtimePaths = [
    'package.json',
    'lib',
    path.join('build', 'Release', 'better_sqlite3.node'),
];

fs.rmSync(outputRoot, { recursive: true, force: true });

for (const runtimePath of runtimePaths) {
    const source = path.join(packageRoot, runtimePath);
    const destination = path.join(outputRoot, runtimePath);

    if (!fs.existsSync(source)) {
        throw new Error(`Missing better-sqlite3 runtime file: ${source}`);
    }

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(source, destination, { recursive: true });
}

console.log(`Copied better-sqlite3 runtime for ${process.platform}-${process.arch} to dist/node_modules.`);
