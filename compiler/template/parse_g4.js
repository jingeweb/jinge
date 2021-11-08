const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const cwd = path.resolve(__dirname, './parser');
execSync('rm -f *.js *.interp *.tokens', { cwd });
execSync('java -jar /usr/local/lib/antlr-4.9-complete.jar -Dlanguage=JavaScript -no-listener -visitor *.g4', {
  cwd,
});
fs.readdirSync(cwd).forEach((file) => {
  if (!file.endsWith('.js')) return;
  let exportName = '';
  const cnt = fs
    .readFileSync(path.join(cwd, file), 'utf-8')
    .replace(/import\s+(\w+)\s+from\s+'([^']+)'/g, (m0, m1, m2) => {
      return `const ${m1} = require('${m2}')`;
    })
    .replace(/export default class\s+(\w+)/, (m0, m1) => {
      exportName = m1;
      return `class ${m1}`;
    });
  fs.writeFileSync(path.join(cwd, file), cnt + `\nmodule.exports=${exportName};\n`);
});
