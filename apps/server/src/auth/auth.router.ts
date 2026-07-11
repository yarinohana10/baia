import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth';

const authRouter: RouterType = Router();
const handler = toNodeHandler(auth);

authRouter.all('/api/auth/*path', (req: Request, res: Response) => {
  return handler(req, res);
});

export { authRouter };
