// Builds release/KUROGANE-<version>.zip: the single-file game + Windows/Linux launchers.
// Dependency-free zip writer (deflate via node:zlib, Unix modes kept so play-linux.sh stays executable).
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { deflateRawSync, crc32 } from 'node:zlib';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const name = `KUROGANE-${pkg.version}`;
const files = [
  ['dist/index.html', 'index.html', 0o644],
  ['packaging/play-windows.bat', 'play-windows.bat', 0o644],
  ['packaging/play-linux.sh', 'play-linux.sh', 0o755],
  ['packaging/README.txt', 'README.txt', 0o644],
];
statSync('dist/index.html'); // fails if `npm run build` wasn't run

const local = [];
const central = [];
let offset = 0;
for (const [src, dst, mode] of files) {
  const data = readFileSync(src);
  const comp = deflateRawSync(data, { level: 9 });
  const fname = Buffer.from(`${name}/${dst}`);
  const crc = crc32(data);
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0, 6); h.writeUInt16LE(8, 8);
  h.writeUInt16LE(0, 10); h.writeUInt16LE(0x21, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18);
  h.writeUInt32LE(data.length, 22); h.writeUInt16LE(fname.length, 26); h.writeUInt16LE(0, 28);
  local.push(h, fname, comp);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(0x031e, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0, 8); c.writeUInt16LE(8, 10);
  c.writeUInt16LE(0, 12); c.writeUInt16LE(0x21, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24);
  c.writeUInt16LE(fname.length, 28); c.writeUInt16LE(0, 30); c.writeUInt16LE(0, 32); c.writeUInt16LE(0, 34); c.writeUInt16LE(0, 36);
  c.writeUInt32LE(((0o100000 | mode) << 16) >>> 0, 38); c.writeUInt32LE(offset, 42);
  central.push(c, fname);
  offset += h.length + fname.length + comp.length;
}
const cd = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
mkdirSync('release', { recursive: true });
const out = `release/${name}.zip`;
writeFileSync(out, Buffer.concat([...local, cd, end]));
console.log(`${out} (${(statSync(out).size / 1024).toFixed(0)} KB)`);
