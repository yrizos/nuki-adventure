import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// docs/code-organization.md describes these lists in prose, so a change to one changes the other.
/** @type {Record<string, string[]>} */
const contexts = {
  level: ['domain', 'application', 'infrastructure', 'content', 'testing'],
  progress: ['domain', 'application', 'infrastructure', 'testing'],
};
const userInterfaceAreas = ['shell', 'screens', 'world', 'input', 'audio', 'graphics', 'testing'];
const topFiles = ['main.ts'];
const bannedFolders = ['shared', 'common', 'utils', 'helpers'];
// These suites test every authored level together, so no single source file sits beside them.
const testsWithoutSource = ['level/content/authored-levels.test.ts', 'level/content/authored-level-invariants.test.ts'];

const src = fileURLToPath(new URL('../src/', import.meta.url));
/** @type {string[]} */
const problems = [];
/** @param {string} folder */
const entries = (folder) => readdirSync(folder).filter((name) => name !== '.DS_Store');
/** @param {string} path */
const isFolder = (path) => statSync(path).isDirectory();
/** @param {string} path */
const at = (path) => `src/${relative(src, path)}`;

/** @param {string} folder */
function walk(folder) {
  for (const name of entries(folder)) {
    const path = join(folder, name);
    if (isFolder(path)) {
      if (bannedFolders.includes(name))
        problems.push(`${at(path)} is a catch-all folder. Put the code in the area that owns it.`);
      if (entries(path).length === 0) problems.push(`${at(path)} is empty.`);
      walk(path);
    } else if (/\.test\.ts$/.test(name)) {
      const source = path.replace(/(\.render)?\.test\.ts$/, '.ts');
      if (!existsSync(source) && !testsWithoutSource.includes(relative(src, path)))
        problems.push(`${at(path)} has no ${name.replace(/(\.render)?\.test\.ts$/, '.ts')} beside it.`);
    }
  }
}

/**
 * @param {string} folder
 * @param {string[]} folders
 * @param {string[]} files
 */
function allowOnly(folder, folders, files) {
  for (const name of entries(folder)) {
    const path = join(folder, name);
    if (isFolder(path) ? !folders.includes(name) : !files.includes(name))
      problems.push(`${at(path)} is not part of the layout. Allowed here: ${[...folders, ...files].join(', ')}.`);
  }
}

allowOnly(src, [...Object.keys(contexts), 'user-interface'], topFiles);
for (const [context, layers] of Object.entries(contexts)) {
  const folder = join(src, context);
  if (!existsSync(join(folder, 'index.ts'))) problems.push(`src/${context} has no index.ts.`);
  allowOnly(folder, layers, ['index.ts']);
}
const userInterface = join(src, 'user-interface');
allowOnly(userInterface, userInterfaceAreas, []);
walk(src);

if (problems.length > 0) {
  console.error(`The layout of src breaks docs/code-organization.md:\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}
