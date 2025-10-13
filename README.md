# 수뜨립(Suittrip) 백엔드 서버

> 짐 보관소 관리 플랫폼을 위한 RESTful API 서버

## 프로젝트 개요

수뜨립(Suittrip)은 여행객들이 짐을 안전하게 보관할 수 있도록 돕는 멀티 스토어 짐 보관소 관리 플랫폼입니다. 각 점포(보관소)는 독립적으로 운영되며, 예약 관리, 보관함 관리, 정산 등의 기능을 제공합니다.

## 주요 기능

### 인증 및 회원 관리
- JWT 기반 인증 시스템
- 이메일 인증을 통한 회원가입
- 다단계 회원가입 프로세스 (사업자 정보, 점포 정보, 계약 서명)
- 사업자 등록번호 검증
- 토큰 갱신 (Refresh Token)

### 점포 관리
- 점포 기본 정보 CRUD
- 영업시간 설정 (요일별)
- 실시간 점포 상태 관리 (영업중/종료/임시휴무)
- 가격 설정 (사이즈별, 시간/일 단위)
- 알림 설정

### 예약 관리
- 예약 조회 (대기/진행중/완료)
- 예약 승인/거부
- 예약 상태 업데이트
- QR 코드 생성 및 검증
- 짐 사진 업로드

### 보관함 관리
- 보관함 CRUD
- 사이즈별 분류 (소형/중형/대형)
- 상태 관리 (사용가능/사용중/점검중)
- 냉장 보관 지원
- 실시간 보관함 점유율 확인

### 대시보드 및 통계
- 실시간 예약 현황
- 일별/주별/월별 매출 통계
- 보관함 점유율
- 사용 시간대 분석

### 리뷰 관리
- 보관소 리뷰 및 점포 리뷰
- 평점 시스템 (1-5점)
- 리뷰 응답 기능
- 리뷰 통계

### 정산 관리
- Toss Payments 연동
- 계좌 등록 및 검증
- 판매자 등록
- 정산 요청 및 내역 조회

### 알림
- 신규 예약 알림
- 체크아웃 알림
- 연체 알림
- 시스템 알림

## 기술 스택

### Backend
- **Runtime**: Node.js 18.x 이상
- **Framework**: Express.js 4.x
- **Language**: JavaScript (ES6+)

### Database
- **RDBMS**: MySQL 8.0
- **ORM/Query Builder**: mysql2 (Native Driver)

### 인증 및 보안
- **Authentication**: JSON Web Token (JWT)
- **Password Hashing**: bcryptjs
- **Validation**: express-validator

### 외부 연동
- **결제/정산**: Toss Payments API
- **주소 검색**: Kakao Address API
- **사업자 검증**: 국세청 사업자 등록번호 조회 API

### 기타
- **Environment Variables**: dotenv
- **CORS**: cors
- **File Upload**: multer
- **QR Code**: qrcode
- **Email**: nodemailer
- **HTTP Client**: axios

### Development Tools
- **Process Manager**: nodemon
- **Version Control**: Git

## 시스템 아키텍처

```
┌─────────────────┐
│  Flutter App    │
│  (Mobile/Web)   │
└────────┬────────┘
         │ HTTPS/REST API
         ▼
┌─────────────────────────────┐
│   Express.js API Server     │
│                             │
│  ┌──────────────────────┐  │
│  │  Middleware Layer    │  │
│  │  - CORS              │  │
│  │  - JWT Auth          │  │
│  │  - Store Isolation   │  │
│  │  - Validation        │  │
│  │  - Error Handler     │  │
│  └──────────────────────┘  │
│                             │
│  ┌──────────────────────┐  │
│  │   Routes Layer       │  │
│  │  - Auth              │  │
│  │  - Store             │  │
│  │  - Reservation       │  │
│  │  - Storage           │  │
│  │  - Review            │  │
│  │  - Statistics        │  │
│  │  - Settlement        │  │
│  └──────────────────────┘  │
│                             │
│  ┌──────────────────────┐  │
│  │ Controllers Layer    │  │
│  └──────────────────────┘  │
│                             │
│  ┌──────────────────────┐  │
│  │  Services Layer      │  │
│  └──────────────────────┘  │
│                             │
│  ┌──────────────────────┐  │
│  │   Models Layer       │  │
│  └──────────────────────┘  │
└─────────────┬───────────────┘
              │
              ▼
    ┌──────────────────┐
    │   MySQL Database │
    │   - 13 Tables    │
    └──────────────────┘
              │
              ▼
    ┌──────────────────────┐
    │  External Services   │
    │  - Toss Payments     │
    │  - Kakao API         │
    │  - Email Service     │
    └──────────────────────┘
```

## 프로젝트 구조

```
suittrip-server/
├── src/
│   ├── config/              # 설정 파일
│   │   ├── database.js      # DB 연결 설정
│   │   └── jwt.js           # JWT 설정
│   ├── middleware/          # 미들웨어
│   │   ├── auth.js          # JWT 인증 미들웨어
│   │   ├── storeIsolation.js # 점포 데이터 격리
│   │   ├── validator.js     # 입력 검증
│   │   └── errorHandler.js  # 에러 핸들러
│   ├── routes/              # API 라우트
│   │   ├── auth.routes.js
│   │   ├── store.routes.js
│   │   ├── reservation.routes.js
│   │   ├── storage.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── review.routes.js
│   │   ├── statistics.routes.js
│   │   ├── notification.routes.js
│   │   └── settlement.routes.js
│   ├── controllers/         # 컨트롤러 (비즈니스 로직)
│   │   ├── auth.controller.js
│   │   ├── store.controller.js
│   │   ├── reservation.controller.js
│   │   ├── storage.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── review.controller.js
│   │   ├── statistics.controller.js
│   │   ├── notification.controller.js
│   │   └── settlement.controller.js
│   ├── services/            # 서비스 레이어
│   │   ├── auth.service.js
│   │   ├── email.service.js
│   │   ├── toss.service.js
│   │   └── qrcode.service.js
│   ├── models/              # 데이터 모델
│   │   ├── store.model.js
│   │   ├── reservation.model.js
│   │   ├── storage.model.js
│   │   ├── review.model.js
│   │   └── ...
│   ├── utils/               # 유틸리티 함수
│   │   ├── generateId.js
│   │   ├── response.js
│   │   └── validation.js
│   └── app.js               # Express 앱 설정
├── database/
│   ├── schema.sql           # 전체 DB 스키마
│   └── migrations/          # DB 마이그레이션
├── uploads/                 # 업로드된 파일 (개발용)
├── .env                     # 환경변수 (git 제외)
├── .env.example             # 환경변수 템플릿
├── .gitignore
├── package.json
├── server.js                # 서버 진입점
└── README.md
```

## 설치 및 실행

### 사전 요구사항
- Node.js 18.x 이상
- MySQL 8.0 이상
- npm 또는 yarn

### 1. 저장소 클론
```bash
git clone <repository-url>
cd suittrip-server
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경변수 설정
`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 필요한 값을 설정합니다.

```bash
cp .env.example .env
```

`.env` 파일 예시:
```env
# Server
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=suittrip

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=your_refresh_token_secret
REFRESH_TOKEN_EXPIRES_IN=30d

# Toss Payments
TOSS_CLIENT_KEY=your_toss_client_key
TOSS_SECRET_KEY=your_toss_secret_key

# Kakao API
KAKAO_REST_API_KEY=your_kakao_api_key

# Email
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_email_password

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

### 4. 데이터베이스 설정
MySQL에 데이터베이스를 생성하고 스키마를 적용합니다.

```bash
# MySQL 접속
mysql -u root -p

# 데이터베이스 생성
CREATE DATABASE suittrip CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 스키마 적용
mysql -u root -p suittrip < database/schema.sql
```

### 5. 서버 실행

#### 개발 모드 (nodemon - 자동 재시작)
```bash
npm run dev
```

#### 프로덕션 모드
```bash
npm start
```

서버가 정상적으로 실행되면 `http://localhost:3000` 에서 접근 가능합니다.

## API 문서

### Base URL
```
Development: http://localhost:3000
Production: https://api.suittrip.com
```

### 인증 헤더
대부분의 API 요청에는 JWT 토큰이 필요합니다.

```http
Authorization: Bearer {access_token}
Content-Type: application/json
X-Store-ID: {store_id}
```

### 주요 엔드포인트

#### 인증
- `POST /api/store/auth/register` - 회원가입
- `POST /api/store/auth/login` - 로그인
- `POST /api/auth/refresh` - 토큰 갱신
- `POST /api/auth/email/send-verification` - 인증 코드 전송
- `POST /api/auth/email/verify-code` - 인증 코드 확인

#### 점포 관리
- `GET /api/store` - 점포 정보 조회
- `PUT /api/store/settings` - 점포 설정 수정
- `PUT /api/store/operating-hours` - 영업시간 수정
- `PUT /api/store/status` - 점포 상태 변경

#### 예약 관리
- `GET /api/reservations` - 예약 목록 조회
- `GET /api/reservations/{id}` - 예약 상세 조회
- `POST /api/reservations/approve/{id}` - 예약 승인
- `POST /api/reservations/reject/{id}` - 예약 거부
- `PUT /api/reservations/{id}/status` - 예약 상태 변경

#### 보관함 관리
- `GET /api/storages` - 보관함 목록 조회
- `GET /api/storages/{id}` - 보관함 상세 조회
- `POST /api/storages` - 보관함 생성
- `PUT /api/storages/{id}` - 보관함 수정
- `DELETE /api/storages/{id}` - 보관함 삭제

#### 대시보드
- `GET /api/dashboard/summary` - 대시보드 요약
- `GET /api/dashboard/stats` - 통계 데이터

#### 리뷰
- `GET /api/reviews` - 리뷰 목록 조회
- `GET /api/reviews/{id}` - 리뷰 상세 조회
- `POST /api/reviews/{id}/response` - 리뷰 응답

#### 통계
- `GET /api/statistics?period={daily|weekly|monthly}` - 통계 조회

#### 알림
- `GET /api/notifications` - 알림 목록 조회
- `PUT /api/notifications/read/{id}` - 알림 읽음 처리

#### 정산
- `POST /api/settlement/account/register` - 계좌 등록
- `GET /api/settlement/account/info` - 계좌 정보 조회
- `POST /api/settlement/payout/request` - 정산 요청
- `GET /api/settlement/history` - 정산 내역 조회

## 데이터베이스

### 주요 테이블
- `stores` - 점포 정보
- `store_status` - 점포 상태
- `store_operating_hours` - 영업시간
- `store_settings` - 점포 설정
- `storages` - 보관함
- `reservations` - 예약
- `reviews` - 리뷰
- `notifications` - 알림
- `toss_payments_accounts` - 결제 계좌
- `settlements` - 정산
- `daily_statistics` - 통계
- `refresh_tokens` - 리프레시 토큰
- `email_verifications` - 이메일 인증

## 보안

### 데이터 격리
- 모든 API는 점포별로 데이터를 완전히 격리
- `X-Store-ID` 헤더를 통한 점포 컨텍스트 검증
- JWT 토큰에 점포 ID 포함

### 인증 및 권한
- JWT 기반 인증 (Access Token: 1시간, Refresh Token: 30일)
- 비밀번호 해싱 (bcrypt, salt rounds: 10)
- 민감한 API는 추가 권한 검증

### 입력 검증
- express-validator를 통한 입력 데이터 검증
- SQL Injection 방지
- XSS 공격 방지

### HTTPS
- 프로덕션 환경에서는 HTTPS 필수
- 민감한 정보는 암호화 전송

## 테스트

### 단위 테스트 (예정)
```bash
npm test
```

### API 테스트 (예정)
```bash
npm run test:api
```

## 배포

### 환경 설정
프로덕션 환경에서는 다음 사항을 확인하세요:
- `NODE_ENV=production` 설정
- 강력한 JWT_SECRET 사용
- 데이터베이스 연결 보안 설정
- HTTPS 사용
- CORS 설정 제한
- Rate Limiting 적용

### PM2를 사용한 배포 (권장)
```bash
npm install -g pm2

# 서버 시작
pm2 start server.js --name suittrip-server

# 서버 상태 확인
pm2 status

# 로그 확인
pm2 logs suittrip-server

# 서버 재시작
pm2 restart suittrip-server

# 서버 중지
pm2 stop suittrip-server
```

## 개발 로드맵

### Phase 1: 기본 인프라 (완료 예정)
- [x] 프로젝트 초기 설정
- [ ] Express 서버 구성
- [ ] MySQL 연결
- [ ] 기본 미들웨어

### Phase 2: 인증 시스템 (진행 예정)
- [ ] JWT 인증
- [ ] 회원가입/로그인
- [ ] 이메일 인증
- [ ] 토큰 갱신

### Phase 3: 핵심 기능 (진행 예정)
- [ ] 예약 관리 API
- [ ] 보관함 관리 API
- [ ] 대시보드 API

### Phase 4: 추가 기능 (진행 예정)
- [ ] 리뷰 시스템
- [ ] 통계 분석
- [ ] 알림 시스템

### Phase 5: 결제 연동 (진행 예정)
- [ ] Toss Payments 연동
- [ ] 정산 시스템

### Phase 6: 최적화 (진행 예정)
- [ ] 캐싱 (Redis)
- [ ] 성능 최적화
- [ ] 모니터링

## 기여

이 프로젝트는 현재 비공개 개발 중입니다.

## 라이선스

이 프로젝트는 비공개 프로젝트입니다.

## 연락처

프로젝트 관련 문의: [vryez11@gmail.com]

---

**마지막 업데이트**: 2025-01-13
