'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function setLocale(locale: 'th' | 'en') {
  const store = await cookies()
  store.set('locale', locale === 'en' ? 'en' : 'th', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  revalidatePath('/', 'layout')
}
