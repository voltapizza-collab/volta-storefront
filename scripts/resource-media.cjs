const fs = require('node:fs');
const path = require('node:path');

// Byte ranges let PDF viewers and HTML video seek without fetching the whole file again.
function serveResourceMedia(req, res, file, type) {
  const size = fs.statSync(file).size;
  const headers = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=300',
    'x-content-type-options': 'nosniff' };
  if (type === 'application/pdf' && new URL(req.url, 'http://localhost').searchParams.get('download') === '1')
    headers['content-disposition'] = `attachment; filename="${path.basename(file).replace(/[^a-zA-Z0-9._-]/g, '_')}"`;
  let start = 0, end = size - 1, status = 200;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (match && (match[1] || match[2])) {
      start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    }
    if (!match || !(match[1] || match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
        start < 0 || start > end || start >= size) {
      res.writeHead(416, { ...headers, 'content-range': `bytes */${size}`, 'content-length': 0 }); res.end(); return;
    }
    status = 206; headers['content-range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['content-length'] = Math.max(0, end - start + 1);
  res.writeHead(status, headers);
  if (req.method === 'HEAD' || size === 0) { res.end(); return; }
  fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
}
module.exports = { serveResourceMedia };
