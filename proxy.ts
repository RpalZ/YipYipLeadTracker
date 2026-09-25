import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";
import { isSessionlessPublicRoute } from "@/lib/supabase/public-routes";

export async function proxy(request: NextRequest) {
  if (isSessionlessPublicRoute(request.nextUrl)) {
    return NextResponse.next({ request });
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
