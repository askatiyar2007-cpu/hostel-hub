/**
 * Brevo (Sendinblue) Transactional Email Service
 * Server-side only - Never expose API keys to client
 */

interface SendStudentInvitationEmailParams {
  email: string;
  studentName: string;
  hostelName: string;
  roomName: string;
  invitationUrl: string;
  bookingType?: 'shared_bed' | 'entire_room';
}

interface SendPasswordResetOtpEmailParams {
  email: string;
  otp: string;
}

interface SendSignupOtpEmailParams {
  email: string;
  otp: string;
}

interface SendRoomRequestOtpEmailParams {
  email: string;
  studentName: string;
  otp: string;
}

interface BrevoEmailResponse {
  success: boolean;
  error?: string;
  messageId?: string;
}

export async function sendStudentInvitationEmail({
  email,
  studentName,
  hostelName,
  roomName,
  invitationUrl,
  bookingType = 'shared_bed'
}: SendStudentInvitationEmailParams): Promise<BrevoEmailResponse> {
  const apiKey = process.env.BREVO_API_KEY;
  
  if (!apiKey) {
    console.error('BREVO_API_KEY not configured in environment variables');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You're invited to join HostelHub</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: #f8fafc;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .content {
            padding: 30px;
          }
          .greeting {
            font-size: 18px;
            color: #1e293b;
            margin-bottom: 20px;
          }
          .message {
            color: #475569;
            margin-bottom: 20px;
          }
          .details {
            background-color: #f1f5f9;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .detail-item {
            margin-bottom: 12px;
          }
          .detail-label {
            font-weight: 600;
            color: #64748b;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .detail-value {
            color: #1e293b;
            font-size: 16px;
            font-weight: 500;
          }
          .button-container {
            text-align: center;
            margin: 30px 0;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            color: #ffffff;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s;
          }
          .button:hover {
            transform: translateY(-2px);
          }
          .fallback-link {
            text-align: center;
            margin: 20px 0;
            color: #64748b;
            font-size: 14px;
          }
          .fallback-link a {
            color: #f97316;
            word-break: break-all;
          }
          .footer {
            background-color: #f8fafc;
            padding: 20px;
            text-align: center;
            color: #64748b;
            font-size: 14px;
            border-top: 1px solid #e2e8f0;
          }
          .important-note {
            background-color: #fff7ed;
            border-left: 4px solid #f97316;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .important-note p {
            margin: 0;
            color: #9a3412;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏠 HostelHub</h1>
          </div>
          <div class="content">
            <p class="greeting">Dear ${studentName},</p>
            <p class="message">
              Great news! The hostel owner has assigned you a room and you're invited to join HostelHub to complete your registration.
            </p>
            
            <div class="details">
              <div class="detail-item">
                <div class="detail-label">Hostel</div>
                <div class="detail-value">${hostelName}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Room</div>
                <div class="detail-value">${roomName}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Booking Type</div>
                <div class="detail-value">${bookingType === 'entire_room' ? 'Entire Room' : 'Shared Bed'}</div>
              </div>
            </div>

            <div class="important-note">
              <p>⚠️ Important: This invitation is linked to the email address <strong>${email}</strong>. You must use this same email to complete your signup.</p>
            </div>

            <div class="button-container">
              <a href="${invitationUrl}" class="button">Complete Your Signup</a>
            </div>

            <div class="fallback-link">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${invitationUrl}">${invitationUrl}</a>
            </div>

            <p class="message">
              This invitation will expire in 7 days. Please complete your registration before then to secure your room assignment.
            </p>
          </div>
          <div class="footer">
            <p>If you have any questions, please contact your hostel owner directly.</p>
            <p>&copy; ${new Date().getFullYear()} HostelHub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        sender: {
          name: 'HostelHub',
          email: 'askatiyar2007@gmail.com'
        },
        to: [{
          email: email,
          name: studentName
        }],
        subject: "You're invited to join HostelHub",
        htmlContent: htmlContent,
        textContent: `Dear ${studentName},\n\nGreat news! The hostel owner has assigned you a room and you're invited to join HostelHub.\n\nHostel: ${hostelName}\nRoom: ${roomName}\n\nComplete your signup here: ${invitationUrl}\n\nImportant: This invitation is linked to the email address ${email}. You must use this same email to complete your signup.\n\nThis invitation will expire in 7 days.\n\nIf you have any questions, please contact your hostel owner directly.\n\n© ${new Date().getFullYear()} HostelHub. All rights reserved.`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Brevo API error:', data);
      return { 
        success: false, 
        error: data.message || 'Failed to send email via Brevo' 
      };
    }

    console.log('Brevo email sent successfully:', data);
    return { 
      success: true, 
      messageId: data.messageId 
    };

  } catch (error) {
    console.error('Error sending Brevo email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

export async function sendSignupOtpEmail({
  email,
  otp
}: SendSignupOtpEmailParams): Promise<BrevoEmailResponse> {
  const apiKey = process.env.BREVO_API_KEY;
  const normalizedEmail = email.trim().toLowerCase();

  if (!apiKey) {
    console.error('BREVO_API_KEY not configured in environment variables');
    return { success: false, error: 'Email service not configured' };
  }

  if (!/^\d{6}$/.test(otp)) {
    console.error('Invalid signup OTP delivery request');
    return { success: false, error: 'Unable to send verification email' };
  }

  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HostelHub Signup Verification Code</title>
      </head>
      <body>
        <p>Hello,</p>
        <p>Use this code to verify signup for <strong>${normalizedEmail}</strong>:</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px;">${otp}</p>
        <p>This code expires in 10 minutes. Do not share it with anyone.</p>
      </body>
      </html>
    `;

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        sender: {
          name: 'HostelHub',
          email: 'askatiyar2007@gmail.com'
        },
        to: [{ email: normalizedEmail }],
        subject: 'HostelHub Signup Verification Code',
        htmlContent,
        textContent: `Use this code to verify signup for ${normalizedEmail}: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      console.error('Brevo API error sending signup OTP:', data);
      return { success: false, error: 'Unable to send verification email' };
    }

    const data = await response.json().catch(() => null);

    if (data?.messageId) {
      console.log('Signup OTP email sent successfully', { messageId: data.messageId });
    } else {
      console.warn('Signup OTP email accepted by Brevo but no messageId was returned', { hasResponseBody: !!data });
    }

    return { success: true, messageId: data?.messageId };
  } catch (error) {
    console.error('Error sending signup OTP email:', error);
    return { success: false, error: 'Unable to send verification email' };
  }
}

export async function sendPasswordResetOtpEmail({
  email,
  otp
}: SendPasswordResetOtpEmailParams): Promise<BrevoEmailResponse> {
  const apiKey = process.env.BREVO_API_KEY;
  
  if (!apiKey) {
    console.error('BREVO_API_KEY not configured in environment variables');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Code</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: #f8fafc;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .content {
            padding: 30px;
          }
          .greeting {
            font-size: 18px;
            color: #1e293b;
            margin-bottom: 20px;
          }
          .message {
            color: #475569;
            margin-bottom: 20px;
          }
          .otp-container {
            background-color: #f1f5f9;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
          }
          .otp-code {
            font-size: 32px;
            font-weight: 700;
            color: #f97316;
            letter-spacing: 8px;
            margin: 10px 0;
          }
          .footer {
            background-color: #f8fafc;
            padding: 20px;
            text-align: center;
            color: #64748b;
            font-size: 14px;
            border-top: 1px solid #e2e8f0;
          }
          .warning {
            background-color: #fff7ed;
            border-left: 4px solid #f97316;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .warning p {
            margin: 0;
            color: #9a3412;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏠 HostelHub</h1>
          </div>
          <div class="content">
            <p class="greeting">Hello,</p>
            <p class="message">
              We received a request to reset your HostelHub password.
            </p>
            
            <div class="otp-container">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">Your verification code is:</p>
              <div class="otp-code">${otp}</div>
            </div>

            <div class="warning">
              <p>⚠️ This code expires in 10 minutes. Do not share this code with anyone.</p>
            </div>

            <p class="message">
              If you did not request a password reset, you can safely ignore this email.
            </p>
          </div>
          <div class="footer">
            <p>If you have any questions, please contact our support team.</p>
            <p>&copy; ${new Date().getFullYear()} HostelHub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        sender: {
          name: 'HostelHub',
          email: 'askatiyar2007@gmail.com'
        },
        to: [{
          email: email
        }],
        subject: "HostelHub Password Reset Code",
        htmlContent: htmlContent,
        textContent: `Hello,\n\nWe received a request to reset your HostelHub password.\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request a password reset, you can safely ignore this email.\n\nDo not share this code with anyone.\n\nRegards,\nHostelHub Team\n\n© ${new Date().getFullYear()} HostelHub. All rights reserved.`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Brevo API error:', data);
      return { 
        success: false, 
        error: data.message || 'Failed to send email via Brevo' 
      };
    }

    console.log('Password reset OTP email sent successfully');
    return { 
      success: true, 
      messageId: data.messageId 
    };

  } catch (error) {
    console.error('Error sending password reset OTP email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

export async function sendRoomRequestOtpEmail({
  email,
  studentName,
  otp
}: SendRoomRequestOtpEmailParams): Promise<BrevoEmailResponse> {
  const apiKey = process.env.BREVO_API_KEY;
  
  if (!apiKey) {
    console.error('BREVO_API_KEY not configured in environment variables');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Room Request Verification Code</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: #f8fafc;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .content {
            padding: 30px;
          }
          .greeting {
            font-size: 18px;
            color: #1e293b;
            margin-bottom: 20px;
          }
          .message {
            color: #475569;
            margin-bottom: 20px;
          }
          .otp-container {
            background-color: #f1f5f9;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
          }
          .otp-code {
            font-size: 32px;
            font-weight: 700;
            color: #f97316;
            letter-spacing: 8px;
            margin: 10px 0;
          }
          .footer {
            background-color: #f8fafc;
            padding: 20px;
            text-align: center;
            color: #64748b;
            font-size: 14px;
            border-top: 1px solid #e2e8f0;
          }
          .warning {
            background-color: #fff7ed;
            border-left: 4px solid #f97316;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .warning p {
            margin: 0;
            color: #9a3412;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏠 HostelHub</h1>
          </div>
          <div class="content">
            <p class="greeting">Hello ${studentName},</p>
            <p class="message">
              You are requesting a room through HostelHub.
            </p>
            
            <div class="otp-container">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">Your verification code is:</p>
              <div class="otp-code">${otp}</div>
            </div>

            <div class="warning">
              <p>⚠️ This code expires in 10 minutes. Enter this code in HostelHub to verify and submit your room request.</p>
            </div>

            <p class="message">
              If you did not request a room, please ignore this email.
            </p>
          </div>
          <div class="footer">
            <p>If you have any questions, please contact your hostel owner directly.</p>
            <p>&copy; ${new Date().getFullYear()} HostelHub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        sender: {
          name: 'HostelHub',
          email: 'askatiyar2007@gmail.com'
        },
        to: [{
          email: email,
          name: studentName
        }],
        subject: "HostelHub Room Request Verification Code",
        htmlContent: htmlContent,
        textContent: `Hello ${studentName},\n\nYou are requesting a room through HostelHub.\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nEnter this code in HostelHub to verify and submit your room request.\n\nIf you did not request a room, please ignore this email.\n\nRegards,\nHostelHub Team\n\n© ${new Date().getFullYear()} HostelHub. All rights reserved.`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Brevo API error:', data);
      return { 
        success: false, 
        error: data.message || 'Failed to send email via Brevo' 
      };
    }

    console.log('Room request OTP email sent successfully');
    return { 
      success: true, 
      messageId: data.messageId 
    };

  } catch (error) {
    console.error('Error sending room request OTP email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}