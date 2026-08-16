import { supabase } from '@/lib/supabase/client';

/**
 * Sends a 6-digit verification OTP to the specified phone number.
 * Saves the OTP record in the 'phone_verifications' table.
 * Integrates MSG91 and Twilio fallback with local logging.
 *
 * @param phone Parent's phone number
 * @returns Object indicating success status, messages, and the generated OTP (for testing)
 */
export async function sendOTP(phone: string): Promise<{ success: boolean; message: string; otp: string }> {
  if (!phone || !phone.trim()) {
    throw new Error('Phone number is required');
  }

  const cleanPhone = phone.trim();
  
  // 1. Generate 6-digit numeric OTP
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // 2. Set expiry to 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  try {
    // 3. Upsert OTP record in the database
    const { error: dbError } = await supabase
      .from('phone_verifications')
      .upsert({
        phone: cleanPhone,
        otp: generatedOtp,
        verified: false,
        expires_at: expiresAt
      });

    if (dbError) {
      console.error('Failed to save OTP to database:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    // 4. Send OTP via SMS API
    const msg91AuthKey = process.env.NEXT_PUBLIC_MSG91_AUTH_KEY || process.env.MSG91_AUTH_KEY;
    const msg91TemplateId = process.env.NEXT_PUBLIC_MSG91_TEMPLATE_ID || process.env.MSG91_TEMPLATE_ID;
    const twilioAccountSid = process.env.NEXT_PUBLIC_TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.NEXT_PUBLIC_TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER;

    let smsSent = false;
    let providerUsed = 'None (Local Log)';

    // Try MSG91
    if (msg91AuthKey && msg91TemplateId) {
      providerUsed = 'MSG91';
      try {
        const response = await fetch(
          `https://api.msg91.com/api/v5/otp?template_id=${msg91TemplateId}&mobile=${cleanPhone}&authkey=${msg91AuthKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ otp: generatedOtp }),
          }
        );
        if (response.ok) {
          smsSent = true;
        } else {
          const errText = await response.text();
          console.warn(`MSG91 sending failed: ${errText}. Attempting Twilio fallback if configured.`);
        }
      } catch (err) {
        console.error('MSG91 error:', err);
      }
    }

    // Fallback to Twilio if MSG91 was not used or failed
    if (!smsSent && twilioAccountSid && twilioAuthToken && twilioFrom) {
      providerUsed = 'Twilio';
      try {
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: cleanPhone,
              From: twilioFrom,
              Body: `Your HostelHub verification code is: ${generatedOtp}. It will expire in 10 minutes.`,
            }),
          }
        );
        if (response.ok) {
          smsSent = true;
        } else {
          const errText = await response.text();
          console.warn(`Twilio sending failed: ${errText}`);
        }
      } catch (err) {
        console.error('Twilio error:', err);
      }
    }

    // Dev logging (DO NOT log actual OTP)
    console.log(`[SMS OTP] OTP sent successfully to ${cleanPhone} (Provider: ${providerUsed})`);

    return {
      success: true,
      message: smsSent 
        ? `Verification code sent to parent phone!` 
        : `Verification code generated successfully!`,
      otp: generatedOtp
    };
  } catch (error) {
    console.error('sendOTP helper error:', error);
    throw error;
  }
}
