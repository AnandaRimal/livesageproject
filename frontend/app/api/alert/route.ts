import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, message } = body;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in .env.local' },
        { status: 500 }
      );
    }

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, message' },
        { status: 400 }
      );
    }

    // Call Twilio REST API directly (no SDK needed)
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append('To', to);
    formData.append('From', fromNumber);
    formData.append('Body', message);

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error('[Twilio] Error:', twilioData);
      return NextResponse.json(
        { error: twilioData.message || 'Failed to send SMS via Twilio' },
        { status: twilioRes.status }
      );
    }

    console.log('[Twilio] SMS sent successfully. SID:', twilioData.sid);

    return NextResponse.json({
      success: true,
      sid: twilioData.sid,
      status: twilioData.status,
      to: twilioData.to,
      message: 'Alert sent successfully!',
    });
  } catch (err: unknown) {
    console.error('[Alert API] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
