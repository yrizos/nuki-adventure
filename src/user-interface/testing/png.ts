import { crc32, deflateSync } from 'node:zlib';
import type { Picture } from '../graphics/picture';

export function png(picture: Picture): Buffer {
  const chunk = (type: string, data: Buffer): Buffer => {
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const framed = Buffer.alloc(typed.length + 8);
    framed.writeUInt32BE(data.length, 0);
    typed.copy(framed, 4);
    framed.writeUInt32BE(crc32(typed), typed.length + 4);
    return framed;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(picture.width, 0);
  header.writeUInt32BE(picture.height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = picture.width * 4;
  const rows = Buffer.alloc((stride + 1) * picture.height);
  for (let row = 0; row < picture.height; row++)
    rows.set(picture.pixels.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
