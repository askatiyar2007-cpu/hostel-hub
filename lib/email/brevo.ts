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
  invitationUrl
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