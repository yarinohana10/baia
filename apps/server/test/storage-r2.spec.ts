import { buildPublicUrl, buildS3ClientConfig } from '../src/storage/s3-client-options';
import { SniffingMemoryStorage, detectImageMime } from '../src/storage/image-upload.guard';
import { PassThrough } from 'stream';

const sendMock = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: (...a: unknown[]) => sendMock(...a) })),
  PutObjectCommand: jest.fn().mockImplementation((i) => ({ __t: 'Put', ...i })),
  DeleteObjectCommand: jest.fn(),
  CreateBucketCommand: jest.fn().mockImplementation((i) => ({ __t: 'Create', ...i })),
  HeadBucketCommand: jest.fn().mockImplementation((i) => ({ __t: 'Head', ...i })),
}));

import { S3StorageService } from '../src/storage/s3-storage.service';

describe('buildS3ClientConfig', () => {
  const r2 = { S3_ENDPOINT: 'https://0123abcd.r2.cloudflarestorage.com', S3_REGION: 'auto', S3_ACCESS_KEY: 'k', S3_SECRET_KEY: 's' };

  it('Cloudflare R2: region auto, path style, checksums only when required', () => {
    const c = buildS3ClientConfig(r2);
    expect(c.endpoint).toBe(r2.S3_ENDPOINT);
    expect(c.region).toBe('auto');
    expect(c.forcePathStyle).toBe(true);
    expect(c.requestChecksumCalculation).toBe('WHEN_REQUIRED');
    expect(c.responseChecksumValidation).toBe('WHEN_REQUIRED');
  });

  it('real AWS S3 (no endpoint): virtual-hosted style, SDK defaults', () => {
    const c = buildS3ClientConfig({ S3_REGION: 'eu-central-1' });
    expect(c.endpoint).toBeUndefined();
    expect(c.forcePathStyle).toBe(false);
    expect(c.requestChecksumCalculation).toBeUndefined();
  });

  it('LocalStack / docker hostnames use path style; S3_FORCE_PATH_STYLE overrides', () => {
    expect(buildS3ClientConfig({ S3_ENDPOINT: 'http://localhost:4566' }).forcePathStyle).toBe(true);
    expect(buildS3ClientConfig({ S3_ENDPOINT: 'http://s3:4566' }).forcePathStyle).toBe(true);
    expect(buildS3ClientConfig({ ...r2, S3_FORCE_PATH_STYLE: 'false' }).forcePathStyle).toBe(false);
  });
});

describe('buildPublicUrl', () => {
  it('R2 custom domain without the bucket in the path', () => {
    expect(buildPublicUrl('products/a/b.jpg', { S3_PUBLIC_URL: 'https://images.baia.co.il/', S3_PUBLIC_URL_INCLUDES_BUCKET: 'false', S3_BUCKET: 'baia-assets' })).toBe(
      'https://images.baia.co.il/products/a/b.jpg',
    );
  });
  it('default includes the bucket; CDN_URL wins', () => {
    expect(buildPublicUrl('k.png', { S3_PUBLIC_URL: 'http://x:4566', S3_BUCKET: 'b' })).toBe('http://x:4566/b/k.png');
    expect(buildPublicUrl('k.png', { CDN_URL: 'https://cdn.x', S3_PUBLIC_URL: 'http://x:4566', S3_PUBLIC_URL_INCLUDES_BUCKET: 'false' })).toBe('https://cdn.x/k.png');
  });
});

describe('S3StorageService.onModuleInit', () => {
  const env = { ...process.env };
  beforeEach(() => {
    sendMock.mockReset();
    process.env.S3_BUCKET = 'baia-assets';
    process.env.S3_ENDPOINT = 'https://0123abcd.r2.cloudflarestorage.com';
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('does nothing more when the bucket exists', async () => {
    sendMock.mockResolvedValue({});
    await new S3StorageService().onModuleInit();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('production: a failing HeadBucket never throws and never tries CreateBucket', async () => {
    process.env.NODE_ENV = 'production';
    sendMock.mockRejectedValue(Object.assign(new Error('denied'), { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } }));
    await expect(new S3StorageService().onModuleInit()).resolves.toBeUndefined();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('development: creates a missing bucket, and a failing create does not throw', async () => {
    process.env.NODE_ENV = 'development';
    sendMock.mockRejectedValue(Object.assign(new Error('nf'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } }));
    await expect(new S3StorageService().onModuleInit()).resolves.toBeUndefined();
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('uploads still fail loudly', async () => {
    sendMock.mockRejectedValue(new Error('SignatureDoesNotMatch'));
    await expect(new S3StorageService().upload(Buffer.from('x'), 'k', 'image/png')).rejects.toThrow('SignatureDoesNotMatch');
  });
});

describe('detectImageMime', () => {
  const pad = (b: number[]) => Buffer.concat([Buffer.from(b), Buffer.alloc(32)]);
  it('recognises jpeg, png, gif, webp and avif by content', () => {
    expect(detectImageMime(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectImageMime(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(detectImageMime(Buffer.from('GIF89a' + '\0'.repeat(20), 'latin1'))).toBe('image/gif');
    expect(detectImageMime(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(8)]))).toBe('image/webp');
    const ftyp = Buffer.alloc(24);
    ftyp.writeUInt32BE(24, 0);
    ftyp.write('ftypavif', 4, 'latin1');
    expect(detectImageMime(ftyp)).toBe('image/avif');
  });
  it('rejects html, svg, text, mp4 and tiny buffers even if named .jpg', () => {
    expect(detectImageMime(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(detectImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    const mp4 = Buffer.alloc(24);
    mp4.writeUInt32BE(24, 0);
    mp4.write('ftypisom', 4, 'latin1');
    expect(detectImageMime(mp4)).toBeNull();
    expect(detectImageMime(Buffer.alloc(0))).toBeNull();
    expect(detectImageMime(Buffer.from([0xff]))).toBeNull();
  });
});

describe('SniffingMemoryStorage', () => {
  const run = (content: Buffer) =>
    new Promise<{ err?: unknown; info?: any }>((resolve) => {
      const stream = new PassThrough();
      new SniffingMemoryStorage()._handleFile({} as any, { stream } as any, (err, info) => resolve({ err, info }));
      stream.end(content);
    });

  it('accepts a real PNG and reports the detected mimetype', async () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
    const { err, info } = await run(png);
    expect(err).toBeNull();
    expect(info.mimetype).toBe('image/png');
    expect(info.buffer.equals(png)).toBe(true);
    expect(info.size).toBe(png.length);
  });

  it('rejects content that is not an image with a 400', async () => {
    const { err } = await run(Buffer.from('<?php echo 1; ?>'));
    expect((err as any).getStatus()).toBe(400);
  });
});
