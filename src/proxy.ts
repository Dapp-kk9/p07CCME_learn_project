import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type Role = 'patient' | 'doctor' | 'nurse' | 'admin'

const HOME: Record<Role, string> = { patient: '/', doctor: '/doctor', nurse: '/staff', admin: '/admin' }
const PUBLIC = ['/login', '/register', '/forgot-password']
const PATIENT_PATHS = ['/book', '/appointments', '/profile']

function startsWith(path: string, prefix: string) {
  return path === prefix || path.startsWith(prefix + '/')
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of list) response.cookies.set(name, value, options)
        },
      },
    },
  )

  const path = request.nextUrl.pathname
  const redirect = (to: string) => {
    const res = NextResponse.redirect(new URL(to, request.url))
    for (const c of response.cookies.getAll()) res.cookies.set(c)
    return res
  }

  const { data } = await supabase.auth.getUser()
  const user = data.user
  const isPublic = PUBLIC.some((p) => startsWith(path, p))

  if (!user) return isPublic ? response : redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, must_change_password')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    // มีบัญชี auth แต่ไม่มี profile: ออกจากระบบเพื่อไม่ให้วนลูป
    await supabase.auth.signOut()
    return redirect('/login?error=NO_PROFILE')
  }

  const role = profile.role as Role
  const home = HOME[role]

  if (profile.must_change_password) {
    return startsWith(path, '/change-password') ? response : redirect('/change-password')
  }

  if (startsWith(path, '/change-password')) return response
  if (isPublic) return redirect(home)

  const allowed =
    (startsWith(path, '/doctor') && role === 'doctor') ||
    (startsWith(path, '/staff') && (role === 'nurse' || role === 'admin')) ||
    (startsWith(path, '/admin') && role === 'admin') ||
    ((path === '/' || PATIENT_PATHS.some((p) => startsWith(path, p))) && role === 'patient')

  return allowed ? response : redirect(home)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
