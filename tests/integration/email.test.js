/**
 * 이메일 전송 통합 테스트
 *
 * 참고: 실제 이메일 발송 테스트는 SMTP 설정이 필요합니다.
 * EMAIL_HOST, EMAIL_USER, EMAIL_PASS가 설정되지 않으면 해당 테스트는 skip됩니다.
 */

import { transporter, sendVerificationEmail } from '../../src/config/email.js';

const hasEmailConfig = !!(
  process.env.EMAIL_HOST &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS
);

describe('이메일 설정 통합 테스트', () => {
  describe('Nodemailer Transporter', () => {
    test('transporter 객체가 정의되어 있어야 함', () => {
      expect(transporter).toBeDefined();
      expect(typeof transporter.sendMail).toBe('function');
    });

    test('transporter 옵션이 올바르게 설정되어야 함', () => {
      const options = transporter.options;

      expect(options).toBeDefined();

      // SMTP 설정 확인
      if (hasEmailConfig) {
        expect(options.host).toBe(process.env.EMAIL_HOST);
        expect(options.port).toBe(parseInt(process.env.EMAIL_PORT || '587'));
      }
    });

    // SMTP 연결 테스트 (이메일 설정이 있을 때만)
    (hasEmailConfig ? test : test.skip)('SMTP 서버 연결이 성공해야 함', async () => {
      await expect(transporter.verify()).resolves.toBe(true);
    }, 10000);
  });

  describe('sendVerificationEmail 함수', () => {
    test('sendVerificationEmail 함수가 정의되어 있어야 함', () => {
      expect(sendVerificationEmail).toBeDefined();
      expect(typeof sendVerificationEmail).toBe('function');
    });

    test('유효하지 않은 이메일 주소는 에러를 반환해야 함', async () => {
      const result = await sendVerificationEmail('', '123456');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('유효하지 않은 코드 형식은 에러를 반환해야 함', async () => {
      const result1 = await sendVerificationEmail('test@example.com', ''); // 빈 코드
      expect(result1.success).toBe(false);
      expect(result1.error).toBeDefined();

      const result2 = await sendVerificationEmail('test@example.com', '   '); // 공백
      expect(result2.success).toBe(false);
      expect(result2.error).toBeDefined();
    });

    // 실제 이메일 발송 테스트 (이메일 설정이 있을 때만)
    (hasEmailConfig ? test : test.skip)(
      '실제 이메일 발송이 성공해야 함',
      async () => {
        const testEmail = process.env.EMAIL_USER; // 자기 자신에게 테스트 이메일 발송
        const testCode = '123456';

        const result = await sendVerificationEmail(testEmail, testCode);

        expect(result).toBeDefined();
        expect(result.messageId).toBeDefined();
        expect(result.accepted).toContain(testEmail);
      },
      15000
    );

    // 이메일 내용 구조 테스트
    test('이메일이 올바른 구조로 생성되어야 함', async () => {
      const testEmail = 'test@example.com';
      const testCode = '123456';

      // sendMail을 가로채서 확인
      const originalSendMail = transporter.sendMail;
      let capturedMailOptions;

      transporter.sendMail = async (mailOptions) => {
        capturedMailOptions = mailOptions;
        // 실제 발송하지 않고 성공 응답 반환
        return {
          messageId: 'test-message-id',
          accepted: [testEmail],
          rejected: [],
          response: '250 OK',
        };
      };

      try {
        await sendVerificationEmail(testEmail, testCode);

        // 메일 옵션 확인
        expect(capturedMailOptions).toBeDefined();
        expect(capturedMailOptions.to).toBe(testEmail);
        expect(capturedMailOptions.subject).toContain('Suittrip');
        expect(capturedMailOptions.subject).toContain('인증');
        expect(capturedMailOptions.html).toContain(testCode);
        expect(capturedMailOptions.html).toContain('3분');

        // HTML 구조 확인
        const html = capturedMailOptions.html;
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<html>');
        expect(html).toContain('Suittrip');
        expect(html).toContain(testCode);
        expect(html).toContain('이메일 인증 코드');
      } finally {
        // 원래 함수 복원
        transporter.sendMail = originalSendMail;
      }
    });

    test('6자리 숫자 코드를 올바르게 포함해야 함', async () => {
      const testEmail = 'test@example.com';
      const testCodes = ['000000', '123456', '999999', '543210'];

      const originalSendMail = transporter.sendMail;
      transporter.sendMail = async (mailOptions) => {
        return {
          messageId: 'test-message-id',
          accepted: [testEmail],
          rejected: [],
          response: '250 OK',
        };
      };

      try {
        for (const code of testCodes) {
          let capturedHtml;

          transporter.sendMail = async (mailOptions) => {
            capturedHtml = mailOptions.html;
            return {
              messageId: 'test-message-id',
              accepted: [testEmail],
              rejected: [],
              response: '250 OK',
            };
          };

          await sendVerificationEmail(testEmail, code);

          expect(capturedHtml).toContain(code);
        }
      } finally {
        transporter.sendMail = originalSendMail;
      }
    });

    test('여러 이메일을 순차적으로 발송할 수 있어야 함', async () => {
      const originalSendMail = transporter.sendMail;
      const sentEmails = [];

      transporter.sendMail = async (mailOptions) => {
        sentEmails.push({
          to: mailOptions.to,
          code: mailOptions.html.match(/class="code">(\d{6})</)?.[1],
        });
        return {
          messageId: `test-message-id-${sentEmails.length}`,
          accepted: [mailOptions.to],
          rejected: [],
          response: '250 OK',
        };
      };

      try {
        await sendVerificationEmail('user1@example.com', '111111');
        await sendVerificationEmail('user2@example.com', '222222');
        await sendVerificationEmail('user3@example.com', '333333');

        expect(sentEmails.length).toBe(3);
        expect(sentEmails[0]).toEqual({ to: 'user1@example.com', code: '111111' });
        expect(sentEmails[1]).toEqual({ to: 'user2@example.com', code: '222222' });
        expect(sentEmails[2]).toEqual({ to: 'user3@example.com', code: '333333' });
      } finally {
        transporter.sendMail = originalSendMail;
      }
    });
  });

  describe('이메일 HTML 템플릿', () => {
    test('HTML 템플릿에 보안 경고 문구가 포함되어야 함', async () => {
      const originalSendMail = transporter.sendMail;
      let capturedHtml;

      transporter.sendMail = async (mailOptions) => {
        capturedHtml = mailOptions.html;
        return {
          messageId: 'test-message-id',
          accepted: [mailOptions.to],
          rejected: [],
          response: '250 OK',
        };
      };

      try {
        await sendVerificationEmail('test@example.com', '123456');

        expect(capturedHtml).toContain('요청하지 않았다면');
        expect(capturedHtml).toContain('무시');
      } finally {
        transporter.sendMail = originalSendMail;
      }
    });

    test('HTML 템플릿이 반응형 스타일을 포함해야 함', async () => {
      const originalSendMail = transporter.sendMail;
      let capturedHtml;

      transporter.sendMail = async (mailOptions) => {
        capturedHtml = mailOptions.html;
        return {
          messageId: 'test-message-id',
          accepted: [mailOptions.to],
          rejected: [],
          response: '250 OK',
        };
      };

      try {
        await sendVerificationEmail('test@example.com', '123456');

        // CSS 스타일 확인
        expect(capturedHtml).toContain('<style>');
        expect(capturedHtml).toContain('max-width');
        expect(capturedHtml).toContain('font-family');

        // 코드 스타일 확인
        expect(capturedHtml).toContain('class="code"');
      } finally {
        transporter.sendMail = originalSendMail;
      }
    });
  });
});

// 테스트 실행 전 안내 메시지
if (!hasEmailConfig) {
  console.log('\n⚠️  이메일 설정(EMAIL_HOST, EMAIL_USER, EMAIL_PASS)이 없어 일부 테스트를 건너뜁니다.');
  console.log('   실제 이메일 발송 테스트를 실행하려면 .env 파일에 이메일 설정을 추가하세요.\n');
}
