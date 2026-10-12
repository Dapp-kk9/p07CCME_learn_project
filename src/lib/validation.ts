import { z } from 'zod'
import { bangkokToday } from '@/lib/date'

export const emailSchema = z.string().trim().toLowerCase().email().max(254)
export const passwordSchema = z.string().min(8).max(72)
export const phoneSchema = z.string().trim().regex(/^[0-9+\- ]{9,15}$/)
export const nameSchema = z.string().trim().min(2).max(200)
export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => d >= '1900-01-01' && d <= bangkokToday())
export const uuidSchema = z.string().uuid()
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
