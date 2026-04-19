const nodemailer = require('nodemailer');

let transporter;

const ROLE_NAMES = {
  STUDENT: 'Student',
  TEACHER: 'Teacher',
  SUPER_ADMIN: 'Administrator',
};

const EMAIL_PURPOSES = {
  ACCOUNT_CREATED: 'ACCOUNT_CREATED',
  PASSWORD_RESET: 'PASSWORD_RESET',
};

const EMAIL_THEME = {
  bg: '#efe8d6',
  bgAlt: '#d7f0de',
  panel: '#fff8e8',
  panelStrong: '#fdebc8',
  border: '#3f3a2f',
  borderSoft: '#6c6354',
  ink: '#1f2937',
  inkSoft: '#4b5563',
  accent: '#16876d',
  accentPressed: '#0f6552',
  warning: '#b9782f',
  warningBg: '#fff4dd',
  danger: '#b93f3f',
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getSenderAddress = () => process.env.EMAIL_FROM || process.env.EMAIL_USER;

const renderPreheader = (text) => `
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(text)}
  </div>
`;

const renderListItemsHtml = (items = []) =>
  items
    .filter(Boolean)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');

const renderDetailRowsHtml = (rows = [], valueClass = '') =>
  rows
    .filter((row) => row && row.value)
    .map((row) => `
      <div class="detail-row">
        <span class="detail-label">${escapeHtml(row.label)}</span>
        <span class="detail-value ${valueClass}">${escapeHtml(row.value)}</span>
      </div>
    `)
    .join('');

const renderEmailShell = ({
  preheader,
  eyebrow,
  title,
  intro,
  contentHtml,
}) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>${escapeHtml(title)}</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background: ${EMAIL_THEME.bg};
          color: ${EMAIL_THEME.ink};
          font-family: Inter, 'Segoe UI', Arial, sans-serif;
        }

        .shell {
          width: 100%;
          padding: 32px 16px;
          background: ${EMAIL_THEME.bg};
        }

        .container {
          max-width: 640px;
          margin: 0 auto;
          background: linear-gradient(180deg, ${EMAIL_THEME.panel} 0%, #ffffff 100%);
          border: 3px solid ${EMAIL_THEME.border};
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 12px 28px rgba(31, 41, 55, 0.12);
        }

        .top-strip {
          height: 14px;
          background: linear-gradient(90deg, ${EMAIL_THEME.accent} 0%, ${EMAIL_THEME.accentPressed} 100%);
        }

        .header {
          padding: 24px 24px 20px;
          background: linear-gradient(180deg, ${EMAIL_THEME.panelStrong} 0%, ${EMAIL_THEME.panel} 100%);
          border-bottom: 3px solid ${EMAIL_THEME.border};
        }

        .eyebrow {
          display: inline-block;
          margin-bottom: 14px;
          padding: 7px 12px;
          border-radius: 999px;
          border: 2px solid ${EMAIL_THEME.accent};
          background: ${EMAIL_THEME.bgAlt};
          color: ${EMAIL_THEME.accentPressed};
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .title {
          margin: 0;
          color: ${EMAIL_THEME.border};
          font-size: 30px;
          line-height: 1.2;
          font-weight: 800;
        }

        .intro {
          margin: 12px 0 0;
          color: ${EMAIL_THEME.inkSoft};
          font-size: 15px;
          line-height: 1.7;
        }

        .content {
          padding: 24px;
        }

        .section-card {
          margin-bottom: 18px;
          padding: 18px;
          border-radius: 16px;
          border: 2px solid ${EMAIL_THEME.borderSoft};
          background: rgba(255, 255, 255, 0.94);
        }

        .section-card-strong {
          border-color: ${EMAIL_THEME.border};
          background: ${EMAIL_THEME.panelStrong};
        }

        .section-title {
          margin: 0 0 12px;
          color: ${EMAIL_THEME.inkSoft};
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .section-copy {
          margin: 0;
          color: ${EMAIL_THEME.ink};
          font-size: 15px;
          line-height: 1.7;
        }

        .detail-row {
          margin-top: 10px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 2px solid ${EMAIL_THEME.borderSoft};
          background: #ffffff;
        }

        .detail-label {
          display: block;
          color: ${EMAIL_THEME.inkSoft};
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .detail-value {
          display: block;
          margin-top: 6px;
          color: ${EMAIL_THEME.ink};
          font-size: 16px;
          line-height: 1.5;
          font-weight: 700;
          word-break: break-word;
        }

        .credential-value {
          font-family: 'Courier New', monospace;
          letter-spacing: 0.02em;
        }

        .otp-value {
          display: block;
          margin-top: 8px;
          padding: 16px 12px;
          border-radius: 14px;
          border: 3px solid ${EMAIL_THEME.border};
          background: #ffffff;
          color: ${EMAIL_THEME.border};
          font-size: 32px;
          font-weight: 800;
          letter-spacing: 0.22em;
          text-align: center;
        }

        .notice {
          padding: 16px 18px;
          border-radius: 14px;
          border: 2px solid ${EMAIL_THEME.borderSoft};
          font-size: 14px;
          line-height: 1.6;
        }

        .notice-success {
          border-color: ${EMAIL_THEME.accent};
          background: ${EMAIL_THEME.bgAlt};
          color: ${EMAIL_THEME.accentPressed};
        }

        .notice-warning {
          border-color: ${EMAIL_THEME.warning};
          background: ${EMAIL_THEME.warningBg};
          color: #7c4a12;
        }

        .notice-neutral {
          background: rgba(255, 255, 255, 0.92);
          color: ${EMAIL_THEME.inkSoft};
        }

        .list {
          margin: 0;
          padding-left: 20px;
          color: ${EMAIL_THEME.ink};
        }

        .list li {
          margin-bottom: 10px;
        }

        .footer-divider {
          height: 2px;
          margin: 0 24px 20px;
          background: ${EMAIL_THEME.border};
          opacity: 0.12;
        }

        .footer {
          padding: 0 24px 24px;
          color: ${EMAIL_THEME.inkSoft};
          font-size: 12px;
          line-height: 1.7;
        }

        .footer strong {
          color: ${EMAIL_THEME.ink};
        }

        @media only screen and (max-width: 640px) {
          .shell {
            padding: 18px 10px;
          }

          .header,
          .content,
          .footer {
            padding-left: 16px;
            padding-right: 16px;
          }

          .title {
            font-size: 24px;
          }

          .otp-value {
            font-size: 28px;
            letter-spacing: 0.16em;
          }
        }
      </style>
    </head>
    <body>
      ${renderPreheader(preheader)}
      <div class="shell">
        <div class="container">
          <div class="top-strip"></div>
          <div class="header">
            <div class="eyebrow">${escapeHtml(eyebrow)}</div>
            <h1 class="title">${escapeHtml(title)}</h1>
            <p class="intro">${escapeHtml(intro)}</p>
          </div>
          <div class="content">
            ${contentHtml}
          </div>
          <div class="footer-divider"></div>
          <div class="footer">
            <strong>iTECHS Learning Platform</strong><br>
            Empowering minds through interactive learning.<br><br>
            This is an automated message. Please do not reply to this email.<br>
            Copyright ${new Date().getFullYear()} iTECHS Learning Platform. All rights reserved.
          </div>
        </div>
      </div>
    </body>
  </html>
`;

const getWelcomeEmailContent = ({
  email,
  userName,
  role,
  username,
  password,
  isTemporaryPassword,
  purpose,
}) => {
  const roleName = ROLE_NAMES[role] || 'User';
  const safeUserName = userName || 'User';
  const passwordLabel = isTemporaryPassword ? 'Temporary Password' : 'Password';
  const normalizedPurpose = purpose || EMAIL_PURPOSES.ACCOUNT_CREATED;

  const purposeConfig =
    normalizedPurpose === EMAIL_PURPOSES.PASSWORD_RESET
      ? {
          subject: 'Your iTECHS Password Reset Details',
          eyebrow: 'Password Reset',
          title: 'Your new sign-in password is ready',
          intro: `A new password was generated for your ${roleName.toLowerCase()} account. Use the credentials below to sign in again.`,
          reminder: 'Change this temporary password right after you log in to keep your account secure.',
          noticeClass: 'notice-warning',
          closingNote: 'If you did not expect this password reset, contact your administrator immediately.',
          nextSteps: [
            'Sign in using the username and temporary password below.',
            'Complete the OTP or verification step if the system asks for it.',
            'Change your password after your next successful login.',
          ],
        }
      : {
          subject: `Your iTECHS ${roleName} Account Credentials`,
          eyebrow: 'Account Created',
          title: 'Your iTECHS account is ready',
          intro: `An administrator created your ${roleName.toLowerCase()} account. Your sign-in credentials are included below so you can access the platform right away.`,
          reminder: isTemporaryPassword
            ? 'Use this temporary password for your first sign-in, then update it after logging in.'
            : 'Keep these credentials secure and do not share them with anyone.',
          noticeClass: isTemporaryPassword ? 'notice-warning' : 'notice-success',
          closingNote: 'If you were not expecting this account, please contact your administrator before signing in.',
          nextSteps: [
            'Sign in using the username and password below.',
            'Complete the OTP or verification step if the system asks for it.',
            'Review your profile and update your password when needed.',
          ],
        };

  const accountRowsHtml = renderDetailRowsHtml([
    { label: 'Name', value: safeUserName },
    { label: 'Role', value: roleName },
    { label: 'Email', value: email },
  ]);

  const credentialRowsHtml = renderDetailRowsHtml(
    [
      { label: 'Username', value: username || email },
      { label: passwordLabel, value: password || '' },
    ],
    'credential-value'
  );

  const contentHtml = `
    <div class="section-card">
      <h2 class="section-title">Account Overview</h2>
      ${accountRowsHtml}
    </div>

    <div class="section-card section-card-strong">
      <h2 class="section-title">Login Credentials</h2>
      <p class="section-copy">Use these credentials exactly as shown when you log in to iTECHS.</p>
      ${credentialRowsHtml}
    </div>

    <div class="notice ${purposeConfig.noticeClass}">
      <strong>Security reminder:</strong> ${escapeHtml(purposeConfig.reminder)}
    </div>

    <div class="section-card">
      <h2 class="section-title">Next Steps</h2>
      <ul class="list">
        ${renderListItemsHtml(purposeConfig.nextSteps)}
      </ul>
    </div>

    <div class="notice notice-neutral">
      ${escapeHtml(purposeConfig.closingNote)}
    </div>
  `;

  const text = [
    purposeConfig.title,
    '',
    `Hello ${safeUserName}!`,
    purposeConfig.intro,
    '',
    'Account Overview',
    `Name: ${safeUserName}`,
    `Role: ${roleName}`,
    `Email: ${email}`,
    '',
    'Login Credentials',
    `Username: ${username || email}`,
    `${passwordLabel}: ${password || ''}`,
    '',
    `Security reminder: ${purposeConfig.reminder}`,
    '',
    'Next Steps',
    ...purposeConfig.nextSteps.map((step) => `- ${step}`),
    '',
    purposeConfig.closingNote,
    '',
    'iTECHS Learning Platform',
  ].join('\n');

  return {
    subject: purposeConfig.subject,
    html: renderEmailShell({
      preheader: `${purposeConfig.subject}. Username and password are included below.`,
      eyebrow: purposeConfig.eyebrow,
      title: purposeConfig.title,
      intro: purposeConfig.intro,
      contentHtml,
    }),
    text,
  };
};

const getOtpEmailContent = ({ userName, otpCode }) => {
  const safeUserName = userName || 'User';

  const contentHtml = `
    <div class="section-card section-card-strong">
      <h2 class="section-title">One-Time Password</h2>
      <p class="section-copy">Enter this code in the platform to continue your sign-in.</p>
      <span class="otp-value">${escapeHtml(otpCode)}</span>
    </div>

    <div class="section-card">
      <h2 class="section-title">Security Guidance</h2>
      <ul class="list">
        ${renderListItemsHtml([
          'This code is valid for 10 minutes only.',
          'This code can be used only once.',
          'Do not share this code with anyone.',
        ])}
      </ul>
    </div>

    <div class="notice notice-warning">
      <strong>Important:</strong> If you did not request this code, you can ignore this email and contact support if you are concerned about account access.
    </div>
  `;

  const text = [
    'Your iTECHS OTP Code',
    '',
    `Hello ${safeUserName}!`,
    'Use the code below to continue your sign-in.',
    '',
    `OTP Code: ${otpCode}`,
    '',
    'Security Guidance',
    '- This code is valid for 10 minutes only.',
    '- This code can be used only once.',
    '- Do not share this code with anyone.',
    '',
    'If you did not request this code, you can ignore this email.',
    '',
    'iTECHS Learning Platform',
  ].join('\n');

  return {
    subject: 'Your iTECHS OTP Code',
    html: renderEmailShell({
      preheader: 'Use your one-time password to continue signing in to iTECHS.',
      eyebrow: 'Verification Code',
      title: 'Your sign-in code is ready',
      intro: 'Use the one-time password below to continue accessing your iTECHS account securely.',
      contentHtml,
    }),
    text,
  };
};

// Initialize email transporter
const initializeEmailTransporter = () => {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  return transporter;
};

// Send OTP email
const sendOTPEmail = async (email, otpCode, userName = '') => {
  try {
    const emailTransporter = initializeEmailTransporter();

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('Email credentials not configured. OTP:', otpCode);
      return true;
    }

    const { subject, html, text } = getOtpEmailContent({ userName, otpCode });

    const mailOptions = {
      from: {
        name: 'iTECHS Learning Platform',
        address: getSenderAddress(),
      },
      to: email,
      subject,
      html,
      text,
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('OTP email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send OTP email:', error);

    if (process.env.NODE_ENV === 'development') {
      console.log('Development OTP for', email, ':', otpCode);
    }

    return false;
  }
};

// Send welcome email with account credentials
const sendWelcomeEmail = async ({
  email,
  userName,
  role,
  username,
  password = null,
  isTemporaryPassword = false,
  purpose = EMAIL_PURPOSES.ACCOUNT_CREATED,
}) => {
  try {
    const emailTransporter = initializeEmailTransporter();

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('Email credentials not configured. Welcome email not sent.');
      return true;
    }

    const { subject, html, text } = getWelcomeEmailContent({
      email,
      userName,
      role,
      username,
      password,
      isTemporaryPassword,
      purpose,
    });

    const mailOptions = {
      from: {
        name: 'iTECHS Learning Platform',
        address: getSenderAddress(),
      },
      to: email,
      subject,
      html,
      text,
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return false;
  }
};

// Test email configuration
const testEmailConfiguration = async () => {
  try {
    const emailTransporter = initializeEmailTransporter();

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return { success: false, message: 'Email credentials not configured' };
    }

    await emailTransporter.verify();
    return { success: true, message: 'Email configuration is valid' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = {
  EMAIL_PURPOSES,
  sendOTPEmail,
  sendWelcomeEmail,
  testEmailConfiguration,
};
