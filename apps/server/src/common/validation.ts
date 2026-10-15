import { ValidationPipe } from '@nestjs/common';

/**
 * Route/controller-scoped validation pipe for the orders, payment, cart and
 * wishlist controllers. Kept local so these endpoints are protected
 * regardless of whether a global pipe is registered in main.ts.
 *
 * whitelist: strips unknown properties, so client-supplied fields such as
 * `amount`, `userId` or `status` can never reach the service layer.
 */
export const strictValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  stopAtFirstError: false,
});
