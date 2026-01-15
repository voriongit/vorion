import { NextRequest, NextResponse } from 'next/server';

const RESEND_API_KEY = 're_MgRgKdVh_BWhmM7usV9SAVJeYYccdDLo3';
const TO_EMAIL = 'racas@vorion.org'; // Where contact submissions go
const FROM_EMAIL = 'team@vorion.org'; // Friendly from address

export async function POST(request: NextRequest) {
  try {
    const { name, email, company, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Vorion <${FROM_EMAIL}>`,
        to: [TO_EMAIL],
        reply_to: email,
        subject: `[ATSF Pitch] Contact from ${name}${company ? ` at ${company}` : ''}`,
        html: `
          <h2>New Contact from ATSF Pitch Page</h2>
          <hr>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
          <hr>
          <h3>Message:</h3>
          <p>${message.replace(/\n/g, '<br>')}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Sent from ATSF Enterprise Pitch Page at ${new Date().toISOString()}
          </p>
        `,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return NextResponse.json({ success: true, id: data.id });
    } else {
      console.error('Resend error:', data);
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Contact API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
