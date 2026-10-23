import { Test } from '@nestjs/testing';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EmailModule } from '../../src/email/email.module';
import { EmailService } from '../../src/email/email.service';
import { InventoryModule } from '../../src/inventory/inventory.module';
import { StockAlertsService } from '../../src/inventory/stock-alerts.service';
import { AuthModule } from '../../src/auth/auth.module';
import { MemoryEmailTransport } from '../../src/email/transports/console.transport';
import { resetDb, seedCatalog } from './app';
import { settledEmails } from './mail';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule, EmailModule, AuthModule, InventoryModule],
})
class AlertsModule {}

const INBOX = 'store@example.test';

describe('StockAlertsService (e2e)', () => {
  let prisma: PrismaService;
  let alerts: StockAlertsService;
  let mail: MemoryEmailTransport;
  let close: () => Promise<void>;
  let variantId: string;
  const savedEnv = process.env.ADMIN_NOTIFY_EMAIL;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AlertsModule] }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);
    alerts = app.get(StockAlertsService);
    mail = new MemoryEmailTransport();
    app.get(EmailService).setTransport(mail);
    close = () => app.close();
  });
  afterAll(async () => {
    process.env.ADMIN_NOTIFY_EMAIL = savedEnv;
    if (savedEnv === undefined) delete process.env.ADMIN_NOTIFY_EMAIL;
    await prisma.siteConfig.deleteMany();
    await close();
  });
  beforeEach(async () => {
    await resetDb(prisma);
    await prisma.siteConfig.deleteMany();
    await prisma.siteConfig.create({ data: { id: 'default', lowStockThreshold: 5, contactEmail: INBOX } });
    delete process.env.ADMIN_NOTIFY_EMAIL;
    mail.sent.length = 0;
    const catalog = await seedCatalog(prisma);
    variantId = catalog.inStock.id;
  });

  const setStock = (stockQuantity: number, extra: object = {}) =>
    prisma.productVariant.update({ where: { id: variantId }, data: { stockQuantity, ...extra } });
  const variant = () => prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });

  it('stays quiet above the threshold', async () => {
    await setStock(6);
    await alerts.notifyAfterStockChange([variantId]);
    expect(await settledEmails(mail)).toHaveLength(0);
  });

  it('emails once when stock crosses to the threshold, naming product, color, size and remaining', async () => {
    await setStock(5);
    await alerts.notifyAfterStockChange([variantId]);
    await alerts.notifyAfterStockChange([variantId]);
    const sent = await settledEmails(mail);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(INBOX);
    expect(sent[0].subject).toContain('מלאי נמוך');
    expect(sent[0].html).toContain('בגד ים');
    expect(sent[0].html).toContain('Black');
    expect(sent[0].html).toContain('M');
    expect((await variant()).lowStockNotifiedAt).not.toBeNull();
  });

  it('sends a second, sold-out email at zero and not again', async () => {
    await setStock(3);
    await alerts.notifyAfterStockChange([variantId]);
    await setStock(0);
    await alerts.notifyAfterStockChange([variantId]);
    await alerts.notifyAfterStockChange([variantId]);
    const sent = await settledEmails(mail);
    expect(sent.map((m) => m.subject.includes('אזל'))).toEqual([false, true]);
  });

  it('a jump straight to zero sends only the sold-out email', async () => {
    await setStock(0);
    await alerts.notifyAfterStockChange([variantId]);
    const sent = await settledEmails(mail);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain('אזל');
  });

  it('restocking above the threshold re-arms both alerts', async () => {
    await setStock(0);
    await alerts.notifyAfterStockChange([variantId]);
    await setStock(20);
    await alerts.notifyAfterStockChange([variantId]);
    const cleared = await variant();
    expect(cleared.lowStockNotifiedAt).toBeNull();
    expect(cleared.soldOutNotifiedAt).toBeNull();
    await setStock(4);
    await alerts.notifyAfterStockChange([variantId]);
    const sent = await settledEmails(mail);
    expect(sent.map((m) => m.subject.includes('אזל'))).toEqual([true, false]);
  });

  it('restocking from zero to a low count re-arms only the sold-out alert', async () => {
    await setStock(0);
    await alerts.notifyAfterStockChange([variantId]);
    await setStock(2);
    await alerts.notifyAfterStockChange([variantId]);
    await setStock(0);
    await alerts.notifyAfterStockChange([variantId]);
    const sent = await settledEmails(mail);
    expect(sent.map((m) => m.subject.includes('אזל'))).toEqual([true, true]);
  });

  it('follows threshold changes in both directions', async () => {
    await setStock(8);
    await alerts.notifyAfterStockChange([variantId]);
    expect(await settledEmails(mail)).toHaveLength(0);

    await prisma.siteConfig.update({ where: { id: 'default' }, data: { lowStockThreshold: 10 } });
    await alerts.notifyAfterStockChange([variantId]);
    expect(await settledEmails(mail)).toHaveLength(1);

    await prisma.siteConfig.update({ where: { id: 'default' }, data: { lowStockThreshold: 2 } });
    await alerts.notifyAfterStockChange([variantId]);
    expect((await variant()).lowStockNotifiedAt).toBeNull();
  });

  it('emails once when called concurrently', async () => {
    await setStock(3);
    await Promise.all(Array.from({ length: 8 }, () => alerts.notifyAfterStockChange([variantId, variantId])));
    expect(await settledEmails(mail, 300)).toHaveLength(1);
  });

  it('ignores unlimited-stock variants and clears their markers', async () => {
    await setStock(0, { trackInventory: false, soldOutNotifiedAt: new Date() });
    await alerts.notifyAfterStockChange([variantId]);
    expect(await settledEmails(mail)).toHaveLength(0);
    expect((await variant()).soldOutNotifiedAt).toBeNull();
  });

  it('prefers ADMIN_NOTIFY_EMAIL over the site contact email', async () => {
    process.env.ADMIN_NOTIFY_EMAIL = 'ops@example.test';
    await setStock(1);
    await alerts.notifyAfterStockChange([variantId]);
    expect((await settledEmails(mail))[0].to).toBe('ops@example.test');
  });

  it('never throws when the database or mail fails', async () => {
    await expect(alerts.notifyAfterStockChange(['does-not-exist'])).resolves.toBeUndefined();
    const failing = new StockAlertsService(
      { siteConfig: { findUnique: () => Promise.reject(new Error('db down')) } } as never,
      { dispatch: () => Promise.reject(new Error('smtp down')) } as never,
    );
    await expect(failing.notifyAfterStockChange([variantId])).resolves.toBeUndefined();
    await setStock(1);
    const mailFails = new StockAlertsService(prisma, { dispatch: () => Promise.reject(new Error('smtp down')) } as never);
    await expect(mailFails.notifyAfterStockChange([variantId])).resolves.toBeUndefined();
  });

  it('skips the email but stays safe with no inbox configured', async () => {
    await prisma.siteConfig.update({ where: { id: 'default' }, data: { contactEmail: '' } });
    await setStock(1);
    await expect(alerts.notifyAfterStockChange([variantId])).resolves.toBeUndefined();
    expect(await settledEmails(mail)).toHaveLength(0);
  });
});
