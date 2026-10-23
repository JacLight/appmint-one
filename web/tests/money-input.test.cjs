const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/modules/money/lib/format.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
vm.runInNewContext(compiled, { exports: mod.exports, module: mod, require, Intl, Date }, { filename });
const { parseAmount, ACCOUNT_TYPE_LABEL } = mod.exports;

test('banking amounts retain exact cents for supported dollar formatting', () => {
  for (const [input, cents] of [['0', 0], ['10', 1000], ['10.1', 1010], ['10.01', 1001], ['$1,250.50', 125050], [' 25.00 ', 2500]]) {
    assert.equal(parseAmount(input), cents, input);
  }
});

test('invalid money is rejected instead of changing sign, rounding or dropping characters', () => {
  for (const input of ['-10', '+10', 'abc10', '10abc', '1.234', '1,2', '1 2', '$$10', '1e3', 'Infinity', '', '900719925474099.99']) {
    assert.equal(parseAmount(input), null, input);
  }
});

test('every engine account kind has a customer-readable label', () => {
  for (const kind of ['checking', 'savings', 'money_market', 'certificate', 'loan']) {
    assert.equal(typeof ACCOUNT_TYPE_LABEL[kind], 'string');
    assert.ok(ACCOUNT_TYPE_LABEL[kind].length > 0);
  }
});
