// Runs before commands that need Node 22+. Dependencies call APIs added in 22
// (undici's markAsUncloneable), and on an older runtime they fail at import
// time with a stack trace that says nothing about the Node version.
const required = 22;
const actual = Number(process.versions.node.split('.')[0]);

if (actual < required) {
  console.error(
    `\nNode ${process.versions.node} is too old; this project needs ${required}+.\n` +
      `Run 'nvm use' in the repo root to pick up the version in .nvmrc.\n`,
  );
  process.exit(1);
}
