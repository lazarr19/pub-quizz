import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();

  // Verify the caller is an admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, questionContent } = await req.json();
  if (!userId || !questionContent) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Look up user email from auth.users — use service role if available
  let email: string | null = null;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      },
    );
    if (res.ok) {
      const userData = await res.json();
      email = userData.email;
    }
  }

  if (!email) {
    console.log(
      `[Thank-you] Could not resolve email for user ${userId} — set SUPABASE_SERVICE_ROLE_KEY to enable.`,
    );
    return NextResponse.json({
      success: true,
      note: "Email not sent — no service role key",
    });
  }

  // Send thank-you email via Resend if configured
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Kviz Trener <noreply@resend.dev>",
        to: [email],
        subject: "Vaše pitanje je prihvaćeno!",
        html: `<h2>Hvala vam! 🎉</h2>
<p>Vaše predloženo pitanje je prihvaćeno i dodato u kviz:</p>
<blockquote style="border-left:3px solid #6366f1;padding-left:12px;color:#666;">${questionContent}</blockquote>
<p>Nastavite sa predlozima!</p>
<p>— Tim Kviz Trenera</p>`,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 },
      );
    }
  } else {
    console.log(
      `[Thank-you email] Would send to ${email} for question: "${questionContent}" — set RESEND_API_KEY to enable.`,
    );
  }

  return NextResponse.json({ success: true });
}
