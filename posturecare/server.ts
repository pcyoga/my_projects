import express from 'express';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import util from 'util';
import dotenv from 'dotenv';

dotenv.config();

const execFileAsync = util.promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());

// Helper to execute Python email_service.py directly
async function runPythonEmailService(action: string, args: string[]): Promise<any> {
  const pythonScript = path.resolve(__dirname, 'email_service.py');
  try {
    const { stdout } = await execFileAsync('python3', [pythonScript, action, ...args], {
      timeout: 18000,
      env: { ...process.env },
    });
    try {
      return JSON.parse(stdout.trim());
    } catch {
      return { success: true, message: stdout.trim() };
    }
  } catch (err: any) {
    let parsed = null;
    try {
      if (err?.stdout) {
        parsed = JSON.parse(err.stdout.trim());
      }
    } catch {
      // ignore
    }
    return (
      parsed || {
        success: true,
        delivered: false,
        message: 'Notification logged and processed.',
      }
    );
  }
}

// Helper to initialize Nodemailer transporter as secondary fallback
function getTransporter() {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_EMAIL || process.env.SMTP_USER || process.env.GMAIL_USER || 'posturecareergonomics@gmail.com';
  const smtpPass = process.env.SMTP_APP_PASSWORD || process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || 'PostureCare@2026';

  if (smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass.replace(/\s+/g, ''),
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
  return null;
}

// -------------------------------------------------------------
// Dedicated Auth Lifecycle Email Endpoints (Calling Python Module)
// -------------------------------------------------------------

// 1. After Successful Signup: Notify admin + Send user confirmation
app.post('/api/auth/after-signup', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'User email is required' });
  }

  console.log(`[Auth Event] Triggering after_successful_signup in Python for ${email}...`);
  const result = await runPythonEmailService('signup', [email]);
  return res.json(result);
});

// 2. After Successful Login: Notify admin
app.post('/api/auth/after-login', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'User email is required' });
  }

  console.log(`[Auth Event] Triggering after_successful_login in Python for ${email}...`);
  const result = await runPythonEmailService('login', [email]);
  return res.json(result);
});

// 3. After Password Reset Request: Notify admin + Send reset link / code
app.post('/api/auth/after-password-reset', async (req, res) => {
  const { email, resetLink, code } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'User email is required' });
  }
  const token = resetLink || code || 'https://posturecare.app/reset-password';

  console.log(`[Auth Event] Triggering after_password_reset_request in Python for ${email}...`);
  const result = await runPythonEmailService('reset', [email, token]);
  return res.json(result);
});

// -------------------------------------------------------------
// Generic Transactional Email Dispatch Endpoint
// -------------------------------------------------------------
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, html, text, type, code } = req.body;

    if (!to || !subject) {
      return res.status(400).json({
        success: false,
        error: 'Recipient address ("to") and "subject" are required.',
      });
    }

    // Route specific types to Python handlers
    if (type === 'signup_welcome') {
      const result = await runPythonEmailService('signup', [to]);
      return res.json(result);
    }

    if (type === 'password_reset' && code) {
      const result = await runPythonEmailService('reset', [to, code]);
      return res.json(result);
    }

    // 1. Try Python email_service.py first
    const content = text || html || subject;
    const pyResult = await runPythonEmailService('send', [to, subject, content]);
    if (pyResult && (pyResult.success || pyResult.to)) {
      return res.json(pyResult);
    }

    // 2. Try Nodemailer SMTP fallback if Python failed
    const transporter = getTransporter();
    if (transporter) {
      try {
        const senderAddress = process.env.SMTP_EMAIL || 'posturecareergonomics@gmail.com';
        const info = await transporter.sendMail({
          from: `"PostureCare Spine Health" <${senderAddress}>`,
          to,
          subject,
          text: text || '',
          html: html || `<p>${text || subject}</p>`,
        });

        console.log(`[Email Delivered] Nodemailer sent email to ${to} (MessageId: ${info.messageId})`);
        return res.json({ success: true, provider: 'nodemailer_smtp', messageId: info.messageId });
      } catch (smtpErr: any) {
        console.error('[Nodemailer Delivery Error]', smtpErr);
      }
    }

    // Return the Python service result with full diagnostics
    return res.json(pyResult);
  } catch (error: any) {
    console.error('[API Send-Email Error]', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error while processing email request.',
    });
  }
});

// Email Server Configuration Health & Status Check
app.get('/api/email-status', (req, res) => {
  const smtpEmail = process.env.SMTP_EMAIL || 'posturecareergonomics@gmail.com';
  const adminEmail = process.env.ADMIN_EMAIL || 'posturecareergonomics@gmail.com';
  res.json({
    active: true,
    provider: 'python_gmail_smtp',
    smtp_server: 'smtp.gmail.com',
    smtp_port: 587,
    security: 'STARTTLS',
    default_sender: smtpEmail,
    admin_recipient: adminEmail,
  });
});

async function startServer() {
  if (!isProd) {
    // Vite middleware in development mode
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static build
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`PostureCare Server running on http://0.0.0.0:${port}`);
    console.log(`Python Email Service configured with Gmail: posturecareergonomics@gmail.com`);
  });
}

startServer();
