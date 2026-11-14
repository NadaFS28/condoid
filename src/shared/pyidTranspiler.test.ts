import test from 'node:test';
import assert from 'node:assert/strict';
import {
  transpilePyIdToPython,
  transpilePythonToPyId,
  remapTracebackToOriginal,
} from './pyidTranspiler';

test('transpiles core PyID control flow and builtins accurately', () => {
  const pyid = [
    'jika nilai >= 75:',
    '    tampilkan("Lulus")',
    'lain_jika nilai >= 50:',
    '    tampilkan("Remedial")',
    'lainnya:',
    '    tampilkan("Tidak lulus")',
  ].join('\n');

  const res = transpilePyIdToPython(pyid);
  const expected = [
    'if nilai >= 75:',
    '    print("Lulus")',
    'elif nilai >= 50:',
    '    print("Remedial")',
    'else:',
    '    print("Tidak lulus")',
  ].join('\n');

  assert.equal(res.code, expected);
  assert.equal(res.lineMap[1], 1);
  assert.equal(res.lineMap[6], 6);
});

test('preserves strings, triple-quoted strings, comments, and identifiers', () => {
  const pyid = [
    '# jika komentar ini punya tampilkan dan fungsi',
    'jika_nilai = 10',
    'pesan_jika = "jika nilai >= 75 tampilkan Benar"',
    'doc = """',
    'fungsi bukan kode',
    'kembalikan Salah',
    '"""',
    'jika jika_nilai == 10 dan Benar:',
    '    tampilkan(pesan_jika)',
  ].join('\n');

  const res = transpilePyIdToPython(pyid);
  assert.ok(res.code.includes('# jika komentar ini punya tampilkan dan fungsi'));
  assert.ok(res.code.includes('jika_nilai = 10'));
  assert.ok(res.code.includes('pesan_jika = "jika nilai >= 75 tampilkan Benar"'));
  assert.ok(res.code.includes('fungsi bukan kode\nkembalikan Salah'));
  assert.ok(res.code.includes('if jika_nilai == 10 and True:'));
  assert.ok(res.code.includes('    print(pesan_jika)'));
});

test('does not translate object attribute names after dot', () => {
  const pyid = 'obj.tampilkan()\nhasil = data.untuk_semua';
  const res = transpilePyIdToPython(pyid);
  assert.equal(res.code, pyid);
});

test('translates expressions inside f-strings safely', () => {
  const pyid = 'tampilkan(f"Status: {Benar jika x > 0 lainnya Salah}")';
  const res = transpilePyIdToPython(pyid);
  assert.equal(res.code, 'print(f"Status: {True if x > 0 else False}")');
});

test('supports round-trip Python -> PyID -> Python', () => {
  const py = [
    'def tambah(a, b):',
    '    if a is None:',
    '        return 0',
    '    return a + b',
  ].join('\n');
  const toId = transpilePythonToPyId(py);
  assert.ok(toId.code.includes('fungsi tambah(a, b):'));
  assert.ok(toId.code.includes('jika a adalah Kosong:'));
  assert.ok(toId.code.includes('kembalikan 0'));
  const backToPy = transpilePyIdToPython(toId.code);
  assert.equal(backToPy.code, py);
});

test('remaps traceback line numbers back to original .cdo file', () => {
  const stderr =
    'Traceback (most recent call last):\n  File "/tmp/condo_run_123.py", line 4, in <module>\n    print(1/0)\nZeroDivisionError: division by zero';
  const remapped = remapTracebackToOriginal(stderr, '/tmp/condo_run_123.py', 'main.cdo', {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
  });
  assert.ok(remapped.includes('File "main.cdo", line 4'));
});
