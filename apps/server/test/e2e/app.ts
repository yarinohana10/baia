import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuthModule } from '../../src/auth/auth.module';
import { CouponsModule } from '../../src/coupons/coupons.module';
import { CartModule } from '../../src/cart/cart.module';
import { WishlistModule } from '../../src/wishlist/wishlist.module';
import { OrdersModule } from '../../src/orders/orders.module';
import { PaymentModule } from '../../src/payment/payment.module';
import { PAYMENT_PROVIDER, type PaymentProvider, type PaymentResult } from '../../src/payment/payment.interface';
import { authRouter } from '../../src/auth/auth.router';
import { RateLimitGuard } from '../../src/common/rate-limit.guard';

/** Only the modules under test (keeps storage/uploads/S3 out of the picture). */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    PrismaModule,
    AuthModule,
    CouponsModule,
    CartModule,
    WishlistModule,
    OrdersModule,
    PaymentModule,
  ],
})
class E2eModule {}

/** Controllable provider so tests can assert exactly what was charged. */
export class SpyPaymentProvider implements PaymentProvider {
  readonly name = 'spy';
  calls: Parameters<PaymentProvider['charge']>[0][] = [];
  refunds: string[] = [];
  delayMs = 0;
  nextResult: PaymentResult | null = null;

  async charge(params: Parameters<PaymentProvider['charge']>[0]): Promise<PaymentResult> {
    this.calls.push(params);
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    const result = this.nextResult ?? { success: true, transactionId: `spy_${this.calls.length}` };
    this.nextResult = null;
    return result;
  }

  async refund(transactionId: string): Promise<PaymentResult> {
    this.refunds.push(transactionId);
    return { success: true, transactionId: `refund_${transactionId}` };
  }

  reset() {
    this.calls = [];
    this.refunds = [];
    this.delayMs = 0;
    this.nextResult = null;
  }
}

export type TestApp = {
  app: NestExpressApplication;
  prisma: PrismaService;
  payments: SpyPaymentProvider;
  http: () => ReturnType<typeof request>;
  agent: () => ReturnType<typeof request.agent>;
  close: () => Promise<void>;
};

export const ORIGIN = 'http://localhost:3999';

export async function createTestApp(): Promise<TestApp> {
  const payments = new SpyPaymentProvider();
  const moduleRef = await Test.createTestingModule({ imports: [E2eModule] })
    .overrideProvider(PAYMENT_PROVIDER)
    .useValue(payments)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true, logger: false });
  app.enableCors({ origin: ORIGIN, credentials: true });
  app.use(authRouter);
  app.setGlobalPrefix('v1');
  await app.init();

  const prisma = app.get(PrismaService);
  const server = app.getHttpServer();
  return {
    app,
    prisma,
    payments,
    http: () => request(server),
    agent: () => request.agent(server),
    close: () => app.close(),
  };
}

export async function resetDb(prisma: PrismaService) {
  RateLimitGuard.reset();
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE payment_attempts, order_items, orders, cart_items, carts, wishlists, product_images, product_variants, products, categories, coupons, sessions, accounts, verifications, users RESTART IDENTITY CASCADE',
  );
}

let seq = 0;
export async function seedCatalog(prisma: PrismaService) {
  seq += 1;
  const category = await prisma.category.create({
    data: { nameHe: 'קטגוריה', nameEn: 'Category', slug: `cat-${seq}-${Date.now()}` },
  });
  const product = await prisma.product.create({
    data: {
      nameHe: 'בגד ים',
      nameEn: 'Swimsuit',
      slug: `swimsuit-${seq}-${Date.now()}`,
      basePrice: 100,
      categoryId: category.id,
    },
  });
  const inStock = await prisma.productVariant.create({
    data: { productId: product.id, color: 'Black', size: 'M', sku: `SKU-${seq}-A-${Date.now()}`, stockQuantity: 5 },
  });
  const lowStock = await prisma.productVariant.create({
    data: { productId: product.id, color: 'Black', size: 'L', sku: `SKU-${seq}-B-${Date.now()}`, stockQuantity: 2 },
  });
  const inactiveProduct = await prisma.product.create({
    data: {
      nameHe: 'לא פעיל',
      nameEn: 'Inactive',
      slug: `inactive-${seq}-${Date.now()}`,
      basePrice: 50,
      categoryId: category.id,
      isActive: false,
    },
  });
  return { category, product, inStock, lowStock, inactiveProduct };
}

let userSeq = 0;
/** Signs up a real better-auth user; the returned agent carries its session cookies. */
export async function signUp(
  t: TestApp,
  opts: { admin?: boolean; agent?: ReturnType<typeof request.agent> } = {},
) {
  userSeq += 1;
  const email = `user${userSeq}-${Date.now()}@example.test`;
  const password = 'Sup3r-secret-password!';
  const agent = opts.agent ?? t.agent();
  const res = await agent
    .post('/api/auth/sign-up/email')
    .set('Origin', ORIGIN)
    .send({ email, password, name: `User ${userSeq}` });
  if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${JSON.stringify(res.body)}`);
  const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });

  if (opts.admin) {
    await t.prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    // The session cookie cache holds the old role: sign in again for a fresh session.
    const adminAgent = t.agent();
    const signIn = await adminAgent.post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password });
    if (signIn.status !== 200) throw new Error(`sign-in failed: ${signIn.status}`);
    return { agent: adminAgent, user, email };
  }
  return { agent, user, email };
}

export const SHIPPING = {
  shippingCity: 'Tel Aviv',
  shippingStreet: 'Dizengoff',
  shippingNumber: '1',
};
