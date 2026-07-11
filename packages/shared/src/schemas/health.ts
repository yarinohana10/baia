import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  timestamp: z.string().datetime(),
  service: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
