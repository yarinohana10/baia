import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { StorageModule } from './storage/storage.module';
import { UploadsModule } from './uploads/uploads.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { CouponsModule } from './coupons/coupons.module';
import { CartModule } from './cart/cart.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentModule } from './payment/payment.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SiteConfigModule } from './site-config/site-config.module';
import { EmailModule } from './email/email.module';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { AddressesModule } from './addresses/addresses.module';
import { CustomersModule } from './customers/customers.module';
import { ContactModule } from './contact/contact.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { CancellationsModule } from './cancellations/cancellations.module';
import { PickupPointsModule } from './pickup-points/pickup-points.module';
import { InventoryModule } from './inventory/inventory.module';
import { AdminNotificationsModule } from './admin-notifications/admin-notifications.module';
import { SizeGuidesModule } from './size-guides/size-guides.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    AuthModule,
    HealthModule,
    UploadsModule,
    CategoriesModule,
    ProductsModule,
    CouponsModule,
    CartModule,
    WishlistModule,
    OrdersModule,
    PaymentModule,
    AnalyticsModule,
    SiteConfigModule,
    EmailModule,
    AdminUsersModule,
    AddressesModule,
    CustomersModule,
    ContactModule,
    NewsletterModule,
    CancellationsModule,
    PickupPointsModule,
    SizeGuidesModule,
    AdminNotificationsModule,
    InventoryModule,
  ],
})
export class AppModule {}
