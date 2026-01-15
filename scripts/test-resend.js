/**
 * Resend Email Test Script
 * Run with: node scripts/test-resend.js <your-email@example.com>
 */

const RESEND_API_KEY = 're_MgRgKdVh_BWhmM7usV9SAVJeYYccdDLo3';

async function sendTestEmail(toEmail) {
  if (!toEmail) {
    console.error('Usage: node scripts/test-resend.js <your-email@example.com>');
    process.exit(1);
  }

  console.log(`Sending test email to: ${toEmail}`);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Vorion <team@vorion.org>',
        to: [toEmail],
        subject: 'Vorion - Resend Test Email',
        html: `
          <h1>Resend Configuration Test</h1>
          <p>If you're reading this, your Resend integration is working correctly.</p>
          <hr>
          <p><strong>Sent from:</strong> Vorion Core</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        `,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Email sent successfully!');
      console.log('   Email ID:', data.id);
    } else {
      console.error('❌ Failed to send email:');
      console.error('   Status:', response.status);
      console.error('   Error:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

sendTestEmail(process.argv[2]);
