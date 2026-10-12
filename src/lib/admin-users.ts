import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getEmailMap(): Promise<Map<string, string>> {
  const admin = createAdminClient()
  const map = new Map<string, string>()
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    for (const u of data?.users ?? []) map.set(u.id, u.email ?? '')
    if ((data?.users.length ?? 0) < 1000) break
  }
  return map
}
