/**
 * PostureCare Real Email Dispatch Service
 * Handles transactional emails (password reset OTP, welcome signup, security alerts)
 * via backend API proxy (/api/send-email) supporting free Resend API and free Gmail SMTP.
 */

export interface EmailDispatchPayload {
  to: string;
  recipientName?: string;
  subject: string;
  type: 'password_reset' | 'signup_welcome' | 'password_changed';
  code?: string;
  html?: string;
  text?: string;
}

export interface EmailDispatchResponse {
  success: boolean;
  needsSetup?: boolean;
  provider?: string;
  message?: string;
  error?: string;
}

export const emailService = {
  /**
   * Send an email via the backend /api/send-email endpoint
   */
  async sendEmail(payload: EmailDispatchPayload): Promise<EmailDispatchResponse> {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData?.error || `HTTP ${response.status}: Failed to dispatch email`,
          needsSetup: errorData?.needsSetup,
        };
      }

      const data: EmailDispatchResponse = await response.json();
      return data;
    } catch (err: any) {
      console.warn('[EmailService] Backend route unreachable or network error:', err);
      return {
        success: false,
        error: err?.message || 'Unable to connect to email server.',
      };
    }
  },

  /**
   * Send Password Reset OTP Code to user's real email address
   */
  async sendPasswordResetOTP(toEmail: string, code: string, recipientName?: string): Promise<EmailDispatchResponse> {
    const name = recipientName || toEmail.split('@')[0];
    const subject = `PostureCare Security: Password Reset Code [${code}]`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FDFBF7; margin: 0; padding: 24px; color: #292524; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E7E5E4; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: #047857; padding: 28px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
          .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
          .content { padding: 28px 24px; }
          .code-box { background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
          .code-title { font-size: 11px; font-weight: 700; color: #065F46; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
          .code-val { font-size: 32px; font-family: 'Courier New', Courier, monospace; font-weight: 700; letter-spacing: 6px; color: #047857; }
          .code-sub { font-size: 11px; color: #57534E; margin-top: 8px; }
          .notice { background: #F5F5F4; border-radius: 10px; padding: 14px; font-size: 12px; color: #57534E; line-height: 1.5; margin-top: 20px; }
          .footer { padding: 20px 24px; border-top: 1px solid #F5F5F4; text-align: center; font-size: 11px; color: #78716C; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>PostureCare Spine Health</h1>
            <p>Workstation Ergonomics Security</p>
          </div>
          <div class="content">
            <p>Hello <strong>${name}</strong>,</p>
            <p>We received an official request to reset the password for your PostureCare workstation account.</p>
            <div class="code-box">
              <div class="code-title">Your 6-Digit Password Reset Code</div>
              <div class="code-val">${code}</div>
              <div class="code-sub">Valid for 15 minutes • Single-use verification token</div>
            </div>
            <p style="font-size: 13px; line-height: 1.5;">Enter this verification code on the PostureCare account recovery screen to create a new password and access your posture dashboard.</p>
            <div class="notice">
              🛡️ <strong>Security Tip:</strong> If you did not request this password reset, please disregard this email. Your current password remains secure.
            </div>
          </div>
          <div class="footer">
            PostureCare Spine Guard • Gentle Real-Time Ergonomics<br>
            Sent to ${toEmail} • Educational On-Device Spine Healthcare
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Hello ${name},\n\nYour 6-digit PostureCare password reset verification code is: ${code}\n\nThis code will expire in 15 minutes. Enter this code on the account recovery page to reset your password.\n\nIf you did not request this, you can safely ignore this email.\n\nBest regards,\nPostureCare Security Team`;

    return this.sendEmail({
      to: toEmail,
      recipientName: name,
      subject,
      type: 'password_reset',
      code,
      html,
      text,
    });
  },

  /**
   * Send Welcome Confirmation Email upon Signup
   */
  async sendWelcomeEmail(toEmail: string, recipientName: string): Promise<EmailDispatchResponse> {
    const subject = `Welcome to PostureCare, ${recipientName}! Your Ergonomic Workspace is Ready.`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FDFBF7; margin: 0; padding: 24px; color: #292524; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E7E5E4; overflow: hidden; }
          .header { background: #047857; padding: 28px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
          .content { padding: 28px 24px; font-size: 13px; line-height: 1.6; }
          .card { background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 12px; padding: 16px; margin: 16px 0; }
          .footer { padding: 16px 24px; border-top: 1px solid #F5F5F4; text-align: center; font-size: 11px; color: #78716C; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to PostureCare</h1>
            <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Spine Guard Ergonomic Platform</p>
          </div>
          <div class="content">
            <p>Hi <strong>${recipientName}</strong>,</p>
            <p>Thank you for creating your PostureCare account! Your personalized spine healthcare profile is now active.</p>
            <div class="card">
              <strong style="color: #065F46;">What's Next:</strong>
              <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #047857;">
                <li>Complete your 3-second neutral posture baseline calibration.</li>
                <li>Turn on real-time live monitoring during long desk work sessions.</li>
                <li>Track weekly alignment trends and earn milestone health badges.</li>
              </ul>
            </div>
            <p>Your video stream is processed 100% on-device in your browser. No camera feed ever leaves your computer.</p>
          </div>
          <div class="footer">
            PostureCare Team • Real-Time Computer Vision Ergonomics
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Welcome to PostureCare, ${recipientName}!\n\nYour account has been successfully created. Next step: complete your neutral posture baseline calibration and start your live posture session.\n\nAll webcam tracking runs 100% on-device for total privacy.\n\nBest regards,\nPostureCare Team`;

    return this.sendEmail({
      to: toEmail,
      recipientName,
      subject,
      type: 'signup_welcome',
      html,
      text,
    });
  },

  /**
   * Send Password Changed Security Confirmation Email
   */
  async sendPasswordChangedAlert(toEmail: string, recipientName: string): Promise<EmailDispatchResponse> {
    const subject = `PostureCare Security Alert: Password Updated`;

    const html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #047857; margin-top: 0;">Password Successfully Updated</h2>
        <p>Hello ${recipientName},</p>
        <p>This is a confirmation that your PostureCare account password for <strong>${toEmail}</strong> was recently changed.</p>
        <p>If you made this change, no further action is required.</p>
        <p style="color: #b91c1c; font-size: 12px;">If you did not authorize this change, please reset your password immediately or contact your administrator.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 11px; color: #6b7280;">PostureCare Security Team</p>
      </div>
    `;

    return this.sendEmail({
      to: toEmail,
      recipientName,
      subject,
      type: 'password_changed',
      html,
      text: `Hello ${recipientName},\n\nYour PostureCare account password was successfully updated. If you did not authorize this change, please reset your password immediately.\n\nPostureCare Security Team`,
    });
  },

  /**
   * Triggers Python backend after_successful_signup workflow
   * (notifies company admin email + sends signup confirmation to user)
   */
  async afterSuccessfulSignup(userEmail: string): Promise<any> {
    try {
      const response = await fetch('/api/auth/after-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      return await response.json();
    } catch (err: any) {
      console.warn('[EmailService] afterSuccessfulSignup error:', err);
      return { success: false, error: err?.message };
    }
  },

  /**
   * Triggers Python backend after_successful_login workflow
   * (notifies company admin email)
   */
  async afterSuccessfulLogin(userEmail: string): Promise<any> {
    try {
      const response = await fetch('/api/auth/after-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      return await response.json();
    } catch (err: any) {
      console.warn('[EmailService] afterSuccessfulLogin error:', err);
      return { success: false, error: err?.message };
    }
  },

  /**
   * Triggers Python backend after_password_reset_request workflow
   * (notifies company admin email + sends reset link / token to user)
   */
  async afterPasswordResetRequest(userEmail: string, resetLinkOrCode: string): Promise<any> {
    try {
      const response = await fetch('/api/auth/after-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, code: resetLinkOrCode }),
      });
      return await response.json();
    } catch (err: any) {
      console.warn('[EmailService] afterPasswordResetRequest error:', err);
      return { success: false, error: err?.message };
    }
  }
};
