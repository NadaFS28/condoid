import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCode, lintPythonOrPyId } from './pythonFormatter';

test('formats PyID code by normalizing tabs and trailing whitespace', () => {
  const messy = 'fungsi halo():   \n\ttampilkan("Hi")   \n\n\n\n';
  const clean = formatCode(messy, 'pyid');
  assert.equal(clean, 'fungsi halo():\n    tampilkan("Hi")\n');
});

test('formats JSON cleanly', () => {
  const messy = '{"a":1,"b":[2,3]}';
  const clean = formatCode(messy, 'json');
  assert.equal(clean, '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}\n');
});

test('detects missing colons, unclosed brackets, and unused imports', () => {
  const buggy = [
    'impor math',
    'jika x > 5',
    '    tampilkan("ok"',
  ].join('\n');
  const diags = lintPythonOrPyId(buggy, 'test.cdo', 'pyid');
  assert.ok(diags.some((d) => d.message.includes("Expected ':'")));
  assert.ok(diags.some((d) => d.message.includes("Unclosed '('")));
  assert.ok(diags.some((d) => d.message.includes("'math' imported but unused")));
});
