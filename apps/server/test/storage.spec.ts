import { S3StorageService } from '../src/storage/s3-storage.service';
import { LocalStorageService } from '../src/storage/local-storage.service';
import * as fs from 'fs';
import * as path from 'path';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => {
  const sendMock = jest.fn().mockResolvedValue({});
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
    PutObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    CreateBucketCommand: jest.fn(),
    HeadBucketCommand: jest.fn(),
    __sendMock: sendMock,
  };
});

describe('S3StorageService', () => {
  let service: S3StorageService;

  beforeEach(() => {
    process.env.S3_ENDPOINT = 'http://localhost:4566';
    process.env.S3_PUBLIC_URL = 'http://localhost:4566';
    process.env.S3_REGION = 'us-east-1';
    process.env.S3_ACCESS_KEY = 'test';
    process.env.S3_SECRET_KEY = 'test';
    process.env.S3_BUCKET = 'baia-assets';
    service = new S3StorageService();
  });

  describe('upload', () => {
    it('should upload a file and return the public URL', async () => {
      const file = Buffer.from('test image data');
      const result = await service.upload(file, 'products/p1/img.jpg', 'image/jpeg');

      expect(result).toBe('http://localhost:4566/baia-assets/products/p1/img.jpg');
    });

    it('should call S3 PutObjectCommand with correct params', async () => {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const file = Buffer.from('test');

      await service.upload(file, 'test/key.png', 'image/png');

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'baia-assets',
        Key: 'test/key.png',
        Body: file,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000, immutable',
      });
    });
  });

  describe('delete', () => {
    it('should call S3 DeleteObjectCommand', async () => {
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');

      await service.delete('products/p1/img.jpg');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'baia-assets',
        Key: 'products/p1/img.jpg',
      });
    });
  });

  describe('getUrl', () => {
    it('should return the correct public URL', () => {
      const url = service.getUrl('products/p1/img.jpg');
      expect(url).toBe('http://localhost:4566/baia-assets/products/p1/img.jpg');
    });
  });

  describe('getBucket', () => {
    it('should return the configured bucket name', () => {
      expect(service.getBucket()).toBe('baia-assets');
    });
  });

  describe('onModuleInit', () => {
    it('should check if bucket exists', async () => {
      const { HeadBucketCommand } = require('@aws-sdk/client-s3');
      await service.onModuleInit();
      expect(HeadBucketCommand).toHaveBeenCalledWith({ Bucket: 'baia-assets' });
    });
  });
});

describe('LocalStorageService', () => {
  let service: LocalStorageService;
  const testDir = path.join(__dirname, '.test-uploads');

  beforeEach(() => {
    process.env.UPLOADS_DIR = testDir;
    process.env.BETTER_AUTH_URL = 'http://localhost:8000';
    service = new LocalStorageService();
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('upload', () => {
    it('should write file to disk and return URL', async () => {
      const file = Buffer.from('test image data');
      const url = await service.upload(file, 'test/image.jpg', 'image/jpeg');

      expect(url).toBe('http://localhost:8000/uploads/test/image.jpg');
      expect(fs.existsSync(path.join(testDir, 'test/image.jpg'))).toBe(true);
    });

    it('should create nested directories', async () => {
      const file = Buffer.from('nested data');
      await service.upload(file, 'a/b/c/file.png', 'image/png');

      expect(fs.existsSync(path.join(testDir, 'a/b/c/file.png'))).toBe(true);
    });
  });

  describe('delete', () => {
    it('should remove the file from disk', async () => {
      const file = Buffer.from('delete me');
      await service.upload(file, 'del/file.jpg', 'image/jpeg');
      expect(fs.existsSync(path.join(testDir, 'del/file.jpg'))).toBe(true);

      await service.delete('del/file.jpg');
      expect(fs.existsSync(path.join(testDir, 'del/file.jpg'))).toBe(false);
    });

    it('should not throw if file does not exist', async () => {
      await expect(service.delete('nonexistent.jpg')).resolves.not.toThrow();
    });
  });

  describe('getUrl', () => {
    it('should return the correct URL', () => {
      const url = service.getUrl('products/abc/img.jpg');
      expect(url).toBe('http://localhost:8000/uploads/products/abc/img.jpg');
    });
  });
});
