# lit-server 작업 기록 (재록)

서버 코드를 수정할 때마다 이 파일에 기록합니다.
친구(서버 담당)가 어떤 변경이 있었는지 한눈에 파악할 수 있도록.

---

## 2026-04-08 | 고객 알림 설정 API 추가

### 배경
- 고객 앱(lit-customer) 설정 화면에 푸시/이메일/SMS/마케팅 알림 토글이 있음
- 현재는 mock 데이터만 사용 중 (서버 API 없음)
- 유저별 알림 설정을 저장/조회하는 API가 필요

### 변경한 파일
| 파일 | 변경 내용 |
|------|----------|
| `src/routes/customerAuthRoutes.js` | 알림 설정 GET/PUT 라우트 추가 |
| `src/controllers/customerAuthController.js` | getNotificationSettings, updateNotificationSettings 함수 추가 |

### 추가한 API
| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/auth/notification-settings` | 고객 알림 설정 조회 (Bearer 토큰) |
| `PUT` | `/api/auth/notification-settings` | 고객 알림 설정 수정 (Bearer 토큰) |

### 요청/응답 형식

**GET /api/auth/notification-settings**
```json
// Response
{
  "success": true,
  "data": {
    "pushEnabled": true,
    "emailEnabled": false,
    "smsEnabled": true,
    "marketingEnabled": false
  }
}
```

**PUT /api/auth/notification-settings**
```json
// Request Body
{
  "pushEnabled": true,
  "emailEnabled": true,
  "smsEnabled": false,
  "marketingEnabled": false
}

// Response
{
  "success": true,
  "data": {
    "pushEnabled": true,
    "emailEnabled": true,
    "smsEnabled": false,
    "marketingEnabled": false
  }
}
```

### DB 마이그레이션 (필수!)
아래 SQL을 MySQL에서 실행해야 API가 동작합니다:

```sql
ALTER TABLE customers
  ADD COLUMN push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN marketing_enabled BOOLEAN NOT NULL DEFAULT FALSE;
```

> 컬럼이 없어도 GET은 기본값을 반환하지만, PUT은 에러 발생합니다.

### 참고
- 매장주용 알림 설정은 `storeController.js`에 이미 있음 (store_settings 테이블 사용)
- 고객용은 customers 테이블에 직접 넣었음 (별도 테이블 불필요)
- `authenticateCustomer` 미들웨어로 Bearer 토큰 인증
- `marketing_agreed`(회원가입 시 동의 여부)와 `marketing_enabled`(알림 수신 설정)는 별개 컬럼

---
