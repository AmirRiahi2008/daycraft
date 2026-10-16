import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
const target = new URL('../dist/assets/vendor/', import.meta.url);
await mkdir(target, { recursive: true });
for (const [source, name] of [
  ['alpinejs/dist/cdn.min.js', 'alpine.js'],
  ['@alpinejs/focus/dist/cdn.min.js', 'focus.js'],
  ['chart.js/dist/chart.umd.js', 'chart.js'],
  ['motion/dist/motion.js', 'motion.js']
]) {
  await copyFile(new URL('../node_modules/' + source, import.meta.url), new URL(name, target));
}
let licenses = 'Daycraft third-party software notices\n\n';
for (const name of ['alpinejs', '@alpinejs/focus', 'chart.js', 'motion']) {
  for (const filename of ['LICENSE', 'LICENSE.md']) {
    try { licenses += name + '\n' + await readFile(new URL('../node_modules/' + name + '/' + filename, import.meta.url), 'utf8') + '\n\n'; break; } catch {}
  }
}
await writeFile(new URL('LICENSES.txt', target), licenses);
console.log('Vendored Alpine.js, Focus, Motion and Chart.js.');
