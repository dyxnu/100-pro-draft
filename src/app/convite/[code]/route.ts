import { NextResponse, type NextRequest } from 'next/server';
import { isValidReferralCode } from '@/lib/store/rules';

/** Link de convite: guarda o código no cookie nx_ref (lido no cadastro) e leva para /cadastro. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const res = NextResponse.redirect(new URL('/cadastro', request.url));
  if (isValidReferralCode(code)) {
    res.cookies.set('nx_ref', code, {
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
    });
  }
  return res;
}
