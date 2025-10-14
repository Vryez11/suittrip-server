/**
 * 이메일 설정 및 발송
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// 환경변수
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587');
const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true';
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Suittrip <noreply@suittrip.com>';

/**
 * Nodemailer transporter 생성
 * @returns {Object} Nodemailer transporter
 */
export const createTransporter = () => {
  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_SECURE,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD,
    },
  });
};

// 기본 transporter export (테스트용)
export const transporter = createTransporter();

/**
 * 이메일 인증 코드 발송
 * @param {string} email - 수신자 이메일
 * @param {string} code - 인증 코드
 * @returns {Promise<Object>} { success: boolean, messageId?: string, error?: string }
 */
export const sendVerificationEmail = async (email, code) => {
  try {
    // 입력 검증
    if (!email || !email.trim()) {
      return {
        success: false,
        error: '이메일이 필요합니다',
      };
    }

    if (!code || !code.trim()) {
      return {
        success: false,
        error: '인증 코드가 필요합니다',
      };
    }

    const transporter = createTransporter();

    // HTML 이메일 템플릿
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #4F46E5;
            margin-bottom: 10px;
          }
          .title {
            font-size: 24px;
            font-weight: bold;
            color: #1F2937;
            margin-bottom: 20px;
          }
          .code-container {
            background-color: #F3F4F6;
            border-radius: 8px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
          }
          .code {
            font-size: 36px;
            font-weight: bold;
            color: #4F46E5;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
          }
          .description {
            color: #6B7280;
            margin-bottom: 20px;
            line-height: 1.8;
          }
          .expiry {
            color: #EF4444;
            font-weight: bold;
            margin-top: 20px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #E5E7EB;
            color: #9CA3AF;
            font-size: 14px;
            text-align: center;
          }
          .warning {
            background-color: #FEF3C7;
            border-left: 4px solid #F59E0B;
            padding: 15px;
            margin-top: 20px;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🧳 Suittrip</div>
            <div class="title">이메일 인증 코드</div>
          </div>

          <div class="description">
            안녕하세요,<br>
            Suittrip 회원가입을 위한 이메일 인증 코드입니다.<br>
            아래 코드를 입력하여 이메일 인증을 완료해주세요.
          </div>

          <div class="code-container">
            <div class="code">${code}</div>
            <div class="expiry">⏰ 이 코드는 3분 내에만 유효합니다</div>
          </div>

          <div class="warning">
            <strong>⚠️ 주의사항</strong><br>
            • 이 코드를 타인과 공유하지 마세요.<br>
            • 요청하지 않으셨다면 이 이메일을 무시하셔도 됩니다.<br>
            • 5회 이상 잘못된 코드 입력 시 새로운 코드를 요청해야 합니다.
          </div>

          <div class="footer">
            이 이메일은 발신 전용입니다. 문의사항은 고객센터를 이용해주세요.<br>
            © 2025 Suittrip. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    // 텍스트 버전
    const textContent = `
Suittrip 이메일 인증 코드

안녕하세요,
Suittrip 회원가입을 위한 이메일 인증 코드입니다.

인증 코드: ${code}

⏰ 이 코드는 3분 내에만 유효합니다.

주의사항:
• 이 코드를 타인과 공유하지 마세요.
• 요청하지 않으셨다면 이 이메일을 무시하셔도 됩니다.
• 5회 이상 잘못된 코드 입력 시 새로운 코드를 요청해야 합니다.

© 2025 Suittrip. All rights reserved.
    `;

    // 이메일 발송
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: '[Suittrip] 이메일 인증 코드',
      text: textContent,
      html: htmlContent,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('이메일 발송 중 에러:', error);
    return {
      success: false,
      error: error.message || '이메일 발송 실패',
    };
  }
};

/**
 * 일반 이메일 발송
 * @param {string} to - 수신자 이메일
 * @param {string} subject - 제목
 * @param {string} html - HTML 본문
 * @param {string} text - 텍스트 본문 (선택)
 * @returns {Promise<Object>} { success: boolean, messageId?: string, error?: string }
 */
export const sendEmail = async (to, subject, html, text = '') => {
  try {
    // 입력 검증
    if (!to || !to.trim()) {
      return {
        success: false,
        error: '수신자 이메일이 필요합니다',
      };
    }

    if (!subject || !subject.trim()) {
      return {
        success: false,
        error: '제목이 필요합니다',
      };
    }

    if (!html || !html.trim()) {
      return {
        success: false,
        error: 'HTML 본문이 필요합니다',
      };
    }

    const transporter = createTransporter();

    const mailOptions = {
      from: EMAIL_FROM,
      to,
      subject,
      html,
    };

    if (text && text.trim()) {
      mailOptions.text = text;
    }

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('이메일 발송 중 에러:', error);
    return {
      success: false,
      error: error.message || '이메일 발송 실패',
    };
  }
};
