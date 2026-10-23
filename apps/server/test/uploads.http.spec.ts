/**
 * Regression: the generic admin upload route must check the file's real
 * content (magic bytes), not trust the client's filename or Content-Type.
 */
jest.mock('../src/auth/auth', () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock('better-auth/node', () => ({ fromNodeHeaders: jest.fn() }));

import { INestApplication } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { UploadsController } from '../src/uploads/uploads.controller';
import { UploadsService } from '../src/uploads/uploads.service';
import { AuthGuard } from '../src/auth/auth.guard';
import { UploadsModule } from '../src/uploads/uploads.module';
import { imageUploadOptions } from '../src/storage/image-upload.guard';
import { configureGlobalPipeline } from '../src/common/app-setup';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('POST /admin/uploads content check', () => {
  let app: INestApplication;
  let baseUrl: string;
  const upload = jest.fn(async () => ({ id: 'u1', url: 'http://storage.test/x.png' }));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MulterModule.register(imageUploadOptions)],
      controllers: [UploadsController],
      providers: [{ provide: UploadsService, useValue: { upload } }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('v1');
    configureGlobalPipeline(app);
    await app.listen(0);
    baseUrl = `${await app.getUrl()}/v1`.replace('[::1]', 'localhost');
  });

  afterAll(() => app.close());
  beforeEach(() => upload.mockClear());

  const send = (content: BlobPart, type: string, name: string) => {
    const form = new FormData();
    form.append('file', new Blob([content], { type }), name);
    return fetch(`${baseUrl}/admin/uploads`, { method: 'POST', body: form });
  };

  it('accepts a real image', async () => {
    const res = await send(PNG_HEADER, 'image/png', 'ok.png');
    expect(res.status).toBe(201);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('rejects HTML sent as a .jpg with an image Content-Type', async () => {
    const res = await send('<script>alert(1)</script>', 'image/jpeg', 'evil.jpg');
    expect(res.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it('registers the shared image options in the real UploadsModule', () => {
    const imports = Reflect.getMetadata('imports', UploadsModule) as { providers?: { useFactory?: () => unknown }[] }[];
    const registered = imports.flatMap((m) => m?.providers ?? []).map((p) => p.useFactory?.());
    expect(registered).toContain(imageUploadOptions);
  });
});
