# lit-server 작업 기록 (재록)

서버 코드를 수정할 때마다 이 파일에 기록합니다.
친구(서버 담당)가 어떤 변경이 있었는지 한눈에 파악할 수 있도록.

---

## 2026-04-16 | 결제→예약 플로우 전환 + 웹 푸시 알림

### 배경
- 기존 "예약 먼저 생성(pending) → 결제" 방식에서 **"결제 먼저 → 예약 생성(confirmed)"** 방식으로 전환
- 미결제 pending 예약이 DB에 쌓이는 문제 해결 — 결제한 사람만 예약 레코드가 생김
- Bounce, 호텔 예약 사이트 등 업계 표준 방식으로 전환
- 웹 푸시 알림으로 예약 완료 + 체크아웃 30분 전 리마인더 제공

### lit-server 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `database/migrations/007_push_subscriptions.sql` | **신규** — push_subscriptions 테이블 생성 |
| `database/migrations/008_reservation_payment_link.sql` | **신규** — reservations 테이블에 `payment_id` 컬럼 + FK 추가 |
| `src/controllers/guestReservationController.js` | 수정: `payment_key`/`order_id` 수신 → payments 테이블 검증 → `payment_status='paid'` + `payment_id` 저장. 결제 미확인 시 400 에러 반환 |
| `src/controllers/pushSubscriptionController.js` | **신규** — 웹 푸시 구독 저장 + 즉시 알림 발송 |
| `src/services/webPushService.js` | **신규** — web-push 라이브러리로 푸시 발송 (VAPID 인증) |
| `src/jobs/reminderScheduler.js` | **신규** — setInterval 1분 스케줄러, 체크아웃 30분 전 리마인더 발송 |
| `src/routes/guestPushRoutes.js` | **신규** — 푸시 구독/VAPID 키 라우트 |
| `src/app.js` | 푸시 라우트 등록 + 리마인더 스케줄러 시작 |
| `package.json` | `web-push` 의존성 추가 |

### landing (프론트엔드) 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `app/[locale]/payment/page.tsx` | **신규** — 결제 페이지 (폼 데이터를 query params + sessionStorage로 전달) |
| `app/[locale]/payment/success/page.tsx` | **신규** — 결제 완료 + 예약 확인 + 푸시 알림 동의 화면 |
| `app/api/guest/checkout/route.ts` | **신규** — 통합 Checkout 프록시 (결제 확인 → 예약 생성 순차 처리) |
| `components/ReservationBottomSheet.tsx` | 수정: `createGuestReservation()` 제거, sessionStorage에 민감정보 저장 후 결제 페이지로 바로 이동 |
| `components/SeoulMap.tsx` | 수정: ReservationFormInModal 동일 변경 |
| `components/payment/TossPaymentWidget.tsx` | 수정: 리다이렉트 → 콜백 방식 전환 (successUrl 제거, Promise resolve로 onSuccess 호출) |
| `models/payment.ts` | 수정: `CheckoutRequest`/`CheckoutResponse` 타입 추가 |
| `models/reservation.ts` | 수정: `paymentKey`/`orderId` optional 필드 추가 |
| `services/paymentService.ts` | 수정: `checkout()` 함수 추가 |
| `components/PushPermissionPrompt.tsx` | **신규** — 알림 동의 UI ("알림 딱 2번만" 명시) |
| `lib/pushSubscription.ts` | **신규** — Push 구독 유틸 (SW 등록 + VAPID 구독) |
| `public/sw.js` | **신규** — Service Worker (푸시 수신 + 클릭 시 예약 페이지 이동) |
| `app/[locale]/payment/[reservationId]/page.tsx` | **삭제** — 기존 결제 페이지 (reservationId 기반) |
| `app/[locale]/payment/[reservationId]/success/page.tsx` | **삭제** — 기존 성공 페이지 |

### 코드 리뷰 BLOCKER 수정

| 항목 | 구현 |
|------|------|
| **SQL injection 방지** | `checkCapacity` 함수 내부에서 `ALLOWED_STORAGE_TYPES` 화이트리스트 직접 검증 추가. 동적 컬럼명(`${storageType}_max_capacity`)이 외부 입력으로부터 안전하게 보호됨 |
| **트랜잭션 추가** | 결제 검증 + 예약 INSERT + payments 역참조 UPDATE를 `BEGIN/COMMIT` 트랜잭션으로 원자적 처리. 중간 크래시 시 롤백 |
| **이중 예약 방지** | `SELECT ... FOR UPDATE`로 결제 행 잠금 + `reservation_id IS NULL` 조건으로 동일 결제 재사용 차단. 이미 사용된 결제는 409 `PAYMENT_ALREADY_USED` 에러 반환 |

### 보안 수정 (Quality Gate 반영)

| 항목 | 구현 |
|------|------|
| **Mock 모드 프로덕션 가드** | `USE_MOCK_DATA`에 `NODE_ENV !== 'production'` 조건 추가 |
| **금액 무결성 검증** | `amount >= bag_count * 6000` 서버 측 검증 |
| **입력 타입/범위 검증** | bag_count 1-20, duration 1-24, phone 정규식 등 |
| **SSRF 방지** | payment_key에 `encodeURIComponent` 적용 |
| **개인정보 URL 제거** | 전화번호/이름을 URL → sessionStorage로 이동 |
| **TossPaymentWidget paymentKey 가드** | 빈 paymentKey 시 onFail 호출 |
| **결제 미확인 예약 거부** | payment_key 제공 시 결제 SUCCESS 필수, 아니면 400 에러 |
| **결제 실패 시 자동 취소** | checkout route에서 예약 실패 시 Toss 취소 API 호출 시도 |

### 새 유저 플로우

```
[QR 스캔 or 검색]
  → 매장 상세 → 예약 폼 (짐/시간/연락처)
  → "결제하기" → Toss Payments 위젯
  → 결제 성공 → checkout API (결제확인+예약생성)
  → 성공 페이지 + "알림 받으시겠어요?"
  → [허용] → 📱 알림 #1: "예약이 완료되었어요!"
  → (여행 중...)
  → 📱 알림 #2: "체크아웃 30분 전이에요!"
```

### 배포 순서 (중요!)
1. lit-server: `007_push_subscriptions.sql` + `008_reservation_payment_link.sql` 마이그레이션 실행
2. lit-server: VAPID 키 환경변수 설정 (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`)
3. lit-server: PR #2 머지 + 배포
4. Landing: 이미 main에 머지됨 (Vercel 자동 배포)

### PR 목록
- **Landing**: [PR #6](https://github.com/life-is-travel/landing/pull/6) — MERGED
- **lit-server**: [PR #2](https://github.com/life-is-travel/lit-server/pull/2) — 리뷰 대기

---

## 2026-04-16 | 비회원(게스트) 예약/결제 API 추가 — 웹 랜딩페이지 연동

### 배경
- 랜딩 페이지(lifeistravel.io)에서 앱 없이 웹으로 짐보관 예약+결제하는 플로우 필요
- 기존 예약 API는 모두 인증 필요 (`/api/reservations` → 매장주 JWT, `/api/customer/reservations` → 고객 JWT)
- 이전에 있던 `/api/t/public/` 공개 라우트는 `c9ae2b1`에서 전부 제거됨
- QR 포스터 스캔 + 검색 유입 여행자가 타겟

### 추가한 API
| Method | Endpoint | 인증 | 설명 |
|--------|----------|------|------|
| `POST` | `/api/guest/reservations` | 불요 (rate limited) | 비회원 예약 생성 |
| `GET` | `/api/guest/reservations/:id?token=xxx` | 토큰 필수 | 예약 단건 조회 (URL 토큰 기반) |
| `POST` | `/api/guest/reservations/cleanup` | 불요 | 미결제 예약 30분 TTL 자동 정리 (cron용) |
| `POST` | `/api/guest/payments/prepare` | 불요 | 비회원 결제 준비 (기존 preparePayment 재사용) |

### 추가/변경한 파일
| 파일 | 변경 내용 |
|------|----------|
| `src/controllers/guestReservationController.js` | **신규** — 비회원 예약 생성(capacity 검증, 토큰 발급), 토큰 기반 조회, TTL 정리 |
| `src/routes/guestReservationRoutes.js` | **신규** — 게스트 예약 라우트 + IP rate limiting (분당 10회) |
| `src/routes/guestPaymentRoutes.js` | **신규** — 게스트 결제 준비 라우트 (기존 preparePayment 재사용) |
| `src/app.js` | 게스트 라우트 2개 등록 (`/api/guest/reservations`, `/api/guest/payments`) |

### 보안/안정성 (엔지니어링 리뷰 반영)
| 항목 | 구현 |
|------|------|
| **URL 토큰 조회** | 예약 생성 시 `crypto.randomBytes(16)` 토큰 발급, `qr_code` 컬럼에 저장. 토큰 없으면 401 |
| **매장 capacity 검증** | `store_storage_config` 테이블의 `{type}_max_capacity` 조회, 겹치는 시간대 예약 수 체크. 초과 시 409 |
| **예약 TTL 30분** | `POST /cleanup`으로 30분 이상 pending+미결제 게스트 예약 자동 cancelled 처리 |
| **Rate limiting** | IP 기반 분당 10회 제한 (in-memory Map). MVP 단일 인스턴스 기준 |
| **매장 존재/활성 확인** | 예약 생성 전 `SELECT stores WHERE id = ?` + status 체크 |

### 가격 정책 (MVP)
- 일 단위 6,000원 고정 (시간/크기 무관)
- `totalAmount = 6000 * bagCount`
- 시간별/크기별 차등 과금은 향후 검토

### 전화번호 기반 목록 조회 제거
- 기존 `GET /api/guest/reservations?phone=` 제거 (보안 리스크: 전화번호 추측으로 타인 예약 열람 가능)
- 대신 예약 완료 시 URL에 토큰 포함 → 해당 URL로만 조회 가능

### 배포 시 꼭 해야 할 것
1. **DB 스키마 변경 없음** — `qr_code` 컬럼(기존 TEXT)을 access_token 저장에 재활용
2. **환경변수**: `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` 설정 필요 (결제 기능용)
3. **Cron 설정**: `/api/guest/reservations/cleanup`을 5분 간격으로 호출 (미결제 예약 정리)
4. **CORS**: `CORS_ORIGIN`에 `https://www.lifeistravel.io` 추가 확인

### 참고: 랜딩 페이지 쪽 변경
- `app/api/guest/payments/` API Route 3개 추가 (백엔드 프록시)
- `app/api/guest/reservations/[id]/route.ts` 추가 (토큰 기반 조회 프록시)
- `services/paymentService.ts` 경로 통일: `/api/t/payments` → `/api/guest/payments`
- `components/SeoulMap.tsx` 예약 폼을 StoreDetailModal 안에 통합
- `components/ReservationBottomSheet.tsx` 신규 (store 상세 페이지용)
- 결제 페이지 TODO 해결 (하드코딩 → 실제 데이터)

---

## 2026-04-11 | 회원가입 플로우 간소화 — PASS 인증 제거, 연락처 2개로 분리

### 배경
- 클라이언트(lit-store)에서 PASS 본인인증을 회원가입 플로우에서 제거함
  - 건당 비용 부담 + 법적으로 필수 아님(B2B 매장 관리 앱, 정보통신망법 23조의2 대상 아님)
  - 정산 본인확인은 세틀뱅크 예금주 실명조회 API로 대체 예정
- 회원가입 단계: 6단계 → 4단계 (약관 → 기본정보 → 사업자정보 → 가입완료)
- 연락처를 **매장 대표 연락처**(고객 노출) + **사장님 개인 연락처**(알림/정산) 두 개로 분리
- 사장님 휴대폰으로 SMS 알림 받을지 여부를 토글로 선택

### 요청 body 필드 변화 (POST /api/auth/register)
| 필드 | 상태 | 비고 |
|------|------|------|
| `phoneNumber` | **의미 변경** | "사장님 개인 연락처"로 재정립 (기존에는 매장 연락처였음) |
| `storePhoneNumber` | **신규** | 매장 대표 연락처 (고객 노출용), optional |
| `wantsSmsNotification` | **신규** | 사장님 SMS 알림 수신 동의, bool (default false) |
| `verifiedName` | 제거 | PASS 연동 없어서 더 이상 사용 안 함 (원래 서버에는 구현 없었음) |

### 변경한 파일
| 파일 | 변경 내용 |
|------|----------|
| `database/schema.sql` | `stores` 테이블에 `store_phone_number`, `wants_sms_notification` 컬럼 추가. `phone_number` 코멘트 "사장님 개인 연락처"로 수정 |
| `database/migrations/006_add_store_phone_and_sms_notification.sql` | **신규**: 기존 DB에 두 컬럼 멱등성 있게 추가 (`INFORMATION_SCHEMA.COLUMNS` 체크) |
| `src/controllers/authController.js` | `register()` 요청 body에서 `storePhoneNumber`, `wantsSmsNotification` 수신 → INSERT/SELECT/응답 반영. `login()` SELECT/응답에도 두 필드 추가 |
| `src/controllers/storeController.js` | `getStoreInfo()`, `updateStoreInfo()`: SELECT/동적 UPDATE/응답에 새 필드 2개 반영 |
| `src/controllers/customerStoreController.js` | ⚠️ **개인정보 이슈 수정** — 고객 노출용 `phoneNumber`를 `COALESCE(store_phone_number, phone_number)`로 변경. 신규 매장은 매장 대표 연락처만, 기존 매장은 폴백으로 보호 |

### DB 컬럼 의미 정리 (중요)
| 컬럼 | 의미 | 노출 범위 |
|------|------|----------|
| `stores.phone_number` | 사장님 개인 연락처 (알림/정산 문의) | 사장님 본인만 |
| `stores.store_phone_number` | 매장 대표 연락처 (고객이 전화할 번호) | 고객 앱에 노출 |
| `stores.wants_sms_notification` | SMS 알림 수신 동의 여부 | 내부용 |

### 배포 시 꼭 해야 할 것
1. **마이그레이션 먼저 적용**: 서버 배포 전에 운영 DB에서 `006_add_store_phone_and_sms_notification.sql` 실행. 안 그러면 `login`/`register` SELECT 쿼리가 새 컬럼을 못 찾아 500 에러.
   ```bash
   mysql -u <user> -p <db> < database/migrations/006_add_store_phone_and_sms_notification.sql
   ```
2. **기존 매장은 `store_phone_number`가 NULL**: 고객 API는 `COALESCE` 덕에 기존 `phone_number`를 대신 보여주니 당장 이슈 없음. 장기적으로 사장님들이 설정 화면에서 매장 연락처를 따로 입력하도록 유도 필요.
3. **클라이언트(lit-store) 동시 배포**: 이번 스키마 변경은 클라이언트가 이미 `ownerPhone`/`storePhone`을 분리해 보내고 있기 때문에 같이 배포돼야 맞아떨어짐.

### 참고: 클라이언트 쪽 변경 요약
- 회원가입 6 → 4단계
- PASS 인증 화면(`phone_verification_step.dart`), 계약 동의 화면(`contract_step.dart`) 삭제 — 계약 동의는 가입 완료 화면에 체크박스로 흡수
- `SignupController`에서 `nameController`, `phoneController`, `isPhoneVerified`, `authenticateWithPass()`, `canProceedFromPhoneVerification()` 전부 제거
- `storePhoneController`, `ownerPhoneController`, `wantsSmsNotification` 추가 + 사업자 정보 단계에 입력 필드 + SMS 알림 토글
- `AuthService.register()` 시그니처에서 `verifiedName` 제거, `storePhoneNumber`/`wantsSmsNotification` 추가
- `strictNameVerification`, `saveVerifiedName`/`getVerifiedName`/`verifyRepresentativeName`, `_verifiedNameKey` 전부 제거

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
