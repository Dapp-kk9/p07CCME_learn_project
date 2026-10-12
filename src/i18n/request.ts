import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export const LOCALE_COOKIE = 'locale'

export default getRequestConfig(async () => {
  const store = await cookies()
  const locale = store.get(LOCALE_COOKIE)?.value === 'en' ? 'en' : 'th'
  return {
    locale,
    timeZone: 'Asia/Bangkok',
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
