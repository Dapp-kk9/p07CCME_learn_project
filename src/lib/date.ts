// วันที่/เวลาทั้งหมดใช้ Asia/Bangkok (Vercel รันเป็น UTC)
export type Locale = 'th' | 'en'

const TZ = 'Asia/Bangkok'

function bangkokParts(d: Date) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) }
}

export function bangkokToday(now: Date = new Date()): string {
  return bangkokParts(now).date
}

export function bangkokMinutes(now: Date = new Date()): number {
  return bangkokParts(now).minutes
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function isoWeekday(date: string): number {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

export function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`))
}

const intlLocale = (l: Locale) => (l === 'th' ? 'th-TH-u-ca-buddhist' : 'en-GB')

/** แสดงวันที่ ISO ตามภาษา (ไทย = พ.ศ.) */
export function formatDate(date: string, locale: Locale, style: 'long' | 'short' | 'weekday' = 'long'): string {
  const d = new Date(`${date}T12:00:00Z`)
  const opts: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : style === 'short'
        ? { day: 'numeric', month: 'short', year: 'numeric' }
        : { weekday: 'short', day: 'numeric', month: 'short' }
  return new Intl.DateTimeFormat(intlLocale(locale), { ...opts, timeZone: 'UTC' }).format(d)
}

export function weekdayName(weekday: number, locale: Locale, width: 'short' | 'long' = 'short'): string {
  // 2024-01-01 เป็นวันจันทร์
  const d = new Date(Date.UTC(2024, 0, weekday, 12))
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: width, timeZone: 'UTC' }).format(d)
}

export function formatTime(t: string): string {
  return t.slice(0, 5)
}

/** timestamptz -> วันที่และเวลาตามเวลาไทย */
export function formatTimestamp(ts: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(ts))
}

/** เวลานัด (วัน+เวลาไทย) ห่างจากตอนนี้กี่นาที */
export function minutesUntil(date: string, time: string, now: Date = new Date()): number {
  const target = new Date(`${date}T${time.slice(0, 5)}:00+07:00`).getTime()
  return Math.round((target - now.getTime()) / 60000)
}
