import { NextRequest, NextResponse } from "next/server";

const NOTIFY_EMAIL = "radojevic.laza@gmail.com";

export async function POST(req: NextRequest) {
  const { email, displayName } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

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
        to: [NOTIFY_EMAIL],
        subject: "Novi nalog registrovan",
        html: `<h2>Novi korisnik se registrovao 🎉</h2>
<p><strong>Nadimak:</strong> ${displayName || "-"}</p>
<p><strong>Email:</strong> ${email}</p>`,
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
      `[Signup notify] Would notify ${NOTIFY_EMAIL} about new user ${email} (${displayName}) - set RESEND_API_KEY to enable.`,
    );
  }

  return NextResponse.json({ success: true });
}
