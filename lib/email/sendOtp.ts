import { supabase } from '@/lib/supabase/client';

/**
 * Sends a 6-digit verification OTP to the specified email.
 * Saves the OTP record in the 'email_verifications' table.
 *
 * @param email Parent's email address
 * @returns Object indicating success status, messages, and the generated OTP (for testing)
 */
export async function sendEmailOTP(email: string): Promise<{ success: boolean; message: string; otp: string }> {
  if (!email || !email.trim()) {
    throw new Error('Email address is required');
  }

  const cleanEmail = email.trim().toLowerCase();
  
  // 1. Generate 6-digit numeric OTP
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // 2. Set expiry to 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  try {
    // 3. Upsert OTP record in the database
    const { error: dbError } = await supabase
      .from('email_verifications')
      .upsert({
        email: cleanEmail,
        otp: generatedOtp,
        verified: false,
        expires_at: expiresAt
      });

    if (dbError) {
      console.error('Failed to save email OTP to database:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    // Dev logging
    console.log(`[EMAIL OTP] OTP for ${cleanEmail} is: ${generatedOtp}`);

    return {
      success: true,
      message: `Verification code generated successfully! (Dev mode testing code: ${generatedOtp})`,
      otp: generatedOtp
    };
  } catch (error) {
    console.error('sendEmailOTP helper error:', error);
    throw error;
  }
}
