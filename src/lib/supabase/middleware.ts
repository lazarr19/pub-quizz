import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes where the auth redirect logic below can never change the
// outcome (always public, never redirected away from regardless of auth
// state) - skip the Supabase auth network round-trip entirely for these,
// since it was adding ~600ms of server response time for no behavioral
// benefit. Session-cookie refresh still happens on every other route, so a
// logged-in user's session stays alive via their next app-page visit.
function isAlwaysPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/demo" ||
    pathname.startsWith("/kategorije")
  );
}

export async function updateSession(request: NextRequest) {
  if (isAlwaysPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login
  // (isAlwaysPublicPath routes - "/", "/demo", "/kategorije" - already
  // returned above, so they can't reach this check)
  const isAuthPage = request.nextUrl.pathname === "/login";
  const isAdminPage = request.nextUrl.pathname.startsWith("/admin");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
  const isResetPasswordPage = request.nextUrl.pathname === "/reset-password";
  const isAuthConfirmPage = request.nextUrl.pathname === "/auth/confirm";

  if (
    !user &&
    !isAuthPage &&
    !isApiRoute &&
    !isResetPasswordPage &&
    !isAuthConfirmPage
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/lobby";
    return NextResponse.redirect(url);
  }

  // Admin route protection
  if (user && isAdminPage) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      const url = request.nextUrl.clone();
      url.pathname = "/lobby";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
