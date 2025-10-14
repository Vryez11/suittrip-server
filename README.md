# 🧳 수뜨립(Suittrip) 백엔드 서버

> 여행객을 위한 짐 보관소 관리 플랫폼 RESTful API 서버

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-blue.svg)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg)](https://www.mysql.com/)
[![License](https://img.shields.io/badge/License-Private-red.svg)]()

---

## 📋 목차

- [프로젝트 소개](#-프로젝트-소개)
- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [시작하기](#-시작하기)
- [API 문서](#-api-문서)
- [프로젝트 구조](#-프로젝트-구조)
- [개발 현황](#-개발-현황)

---

## 🎯 프로젝트 소개

수뜨립(Suittrip)은 여행객들이 짐을 안전하게 보관할 수 있도록 돕는 **멀티 스토어 짐 보관소 관리 플랫폼**입니다.

### 핵심 특징
- 🏪 **멀티 스토어 시스템** - 각 점포는 독립적으로 운영
- 🔒 **완벽한 데이터 격리** - 점포별 데이터 완전 분리
- 🧪 **TDD 개발 방식** - 높은 코드 품질 보장
- 📱 **Flutter 앱 연동** - 모바일 앱과 완벽한 호환

---

## ✨ 주요 기능

### 🔐 인증 및 회원 관리
- JWT 기반 인증 시스템
- 이메일 인증을 통한 회원가입
- 사업자 등록번호 검증
- 토큰 갱신 (Refresh Token)

### 🏪 점포 관리
- 점포 정보 CRUD
- 영업시간 설정 (요일별)
- 실시간 점포 상태 관리
- 가격 설정 (사이즈별, 시간/일 단위)

### 📦 예약 관리
- 예약 조회 (대기/진행중/완료)
- 예약 승인/거부
- QR 코드 생성 및 검증
- 짐 사진 업로드

### 🗄️ 보관함 관리
- 사이즈별 분류 (소형/중형/대형)
- 상태 관리 (사용가능/사용중/점검중)
- 냉장 보관 지원
- 실시간 보관함 점유율

### 📊 대시보드 및 통계
- 실시간 예약 현황
- 일별/주별/월별 매출 통계
- 사용 시간대 분석

### ⭐ 리뷰 관리
- 보관소 & 점포 리뷰
- 평점 시스템 (1-5점)
- 리뷰 응답 기능

### 💰 정산 관리
- Toss Payments 연동
- 계좌 등록 및 검증
- 정산 요청 및 내역 조회

---

## 🛠 기술 스택

### Backend
- **Runtime**: Node.js 18.x
- **Framework**: Express.js 5.x
- **Language**: JavaScript (ES6+ Modules)

### Database
- **RDBMS**: MySQL 8.0
- **Driver**: mysql2

### 인증 및 보안
- **JWT**: jsonwebtoken
- **Password**: bcryptjs
- **Validation**: express-validator

### 테스트
- **Framework**: Jest 30.x
- **Integration**: Supertest 7.x
- **Coverage**: 100% (핵심 로직)

### 개발 도구
- **Process Manager**: nodemon
- **Code Quality**: ESLint, Prettier
- **Version Control**: Git

---

## 🚀 시작하기

### 사전 요구사항
- Node.js 18.x 이상
- MySQL 8.0 이상
- npm 또는 yarn

### 1️⃣ 저장소 클론
```bash
git clone https://github.com/Vryez11/suittrip-server.git
cd suittrip-server
```

### 2️⃣ 의존성 설치
```bash
npm install
```

### 3️⃣ 환경변수 설정
`.env.example`을 복사하여 `.env` 파일 생성:
```bash
cp .env.example .env
```

`.env` 파일 수정:
```env
# 서버
PORT=3000
NODE_ENV=development

# 데이터베이스
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=suittrip

# JWT
JWT_SECRET=your_jwt_secret_key
REFRESH_TOKEN_SECRET=your_refresh_token_secret
```

### 4️⃣ 데이터베이스 설정
MySQL에 데이터베이스 생성:
```sql
CREATE DATABASE suittrip CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

스키마 적용:
```bash
npm run db:schema
```

### 5️⃣ 서버 실행

**개발 모드** (자동 재시작):
```bash
npm run dev
```

**프로덕션 모드**:
```bash
npm start
```

서버 실행 후 `http://localhost:3000/health` 에서 확인 가능합니다.

---

## 📡 API 문서

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

#### 🔐 인증
```
POST   /api/store/auth/register    - 회원가입
POST   /api/store/auth/login       - 로그인
POST   /api/auth/refresh           - 토큰 갱신
POST   /api/auth/email/verify      - 이메일 인증
```

#### 🏪 점포 관리
```
GET    /api/store                  - 점포 정보 조회
PUT    /api/store/settings         - 점포 설정 수정
PUT    /api/store/status           - 점포 상태 변경
```

#### 📦 예약 관리
```
GET    /api/reservations           - 예약 목록
POST   /api/reservations/approve   - 예약 승인
POST   /api/reservations/reject    - 예약 거부
```

#### 🗄️ 보관함 관리
```
GET    /api/storages               - 보관함 목록
POST   /api/storages               - 보관함 생성
PUT    /api/storages/:id           - 보관함 수정
```

### 표준 응답 형식

**성공 응답:**
```json
{
  "success": true,
  "data": { /* 응답 데이터 */ }
}
```

**에러 응답:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지",
    "timestamp": "2025-01-14T12:00:00Z"
  }
}
```

---

## 📁 프로젝트 구조

```
suittrip-server/
├── src/
│   ├── config/              # 설정 파일
│   │   └── database.js      # DB 연결
│   ├── middleware/          # 미들웨어
│   ├── routes/              # API 라우트
│   ├── controllers/         # 컨트롤러
│   ├── services/            # 서비스 레이어
│   ├── models/              # 데이터 모델
│   ├── utils/               # 유틸리티
│   │   ├── response.js      # 응답 포맷터
│   │   ├── generateId.js    # ID 생성기
│   │   └── validation.js    # 유효성 검증
│   └── app.js               # Express 앱
├── database/
│   ├── schema.sql           # DB 스키마
│   ├── apply-schema.js      # 스키마 적용
│   └── reset-database.js    # DB 초기화
├── tests/
│   ├── unit/                # 단위 테스트
│   ├── integration/         # 통합 테스트
│   └── setup.js             # 테스트 설정
├── server.js                # 서버 진입점
├── .env.example             # 환경변수 템플릿
└── package.json
```

---

## 🧪 테스트

### 모든 테스트 실행
```bash
npm test
```

### 단위 테스트만 실행
```bash
npm run test:unit
```

### 통합 테스트만 실행
```bash
npm run test:integration
```

### 테스트 커버리지 확인
```bash
npm run test:coverage
```

### 현재 테스트 현황
```
✅ 단위 테스트: 35개 통과
✅ 통합 테스트: 8개 통과
✅ 전체: 43개 테스트 (100% 통과)
```

---

## 🗄️ 데이터베이스

### 테이블 구조 (13개)
1. **stores** - 점포 기본 정보
2. **store_status** - 점포 실시간 상태
3. **store_operating_hours** - 영업시간
4. **store_settings** - 점포 설정
5. **storages** - 보관함
6. **reservations** - 예약
7. **reviews** - 리뷰
8. **notifications** - 알림
9. **toss_payments_accounts** - 결제 계좌
10. **settlements** - 정산
11. **daily_statistics** - 통계
12. **refresh_tokens** - 리프레시 토큰
13. **email_verifications** - 이메일 인증

### 데이터베이스 명령어
```bash
# 스키마 적용
npm run db:schema

# 데이터베이스 초기화 (주의!)
npm run db:reset
```

---

## 🔒 보안

### 구현된 보안 기능
- ✅ JWT 기반 인증 (1시간 만료)
- ✅ Refresh Token (30일 만료)
- ✅ 비밀번호 해싱 (bcrypt)
- ✅ 점포별 데이터 격리
- ✅ SQL Injection 방지
- ✅ XSS 공격 방지
- ✅ CORS 설정

---

## 📈 개발 현황

### ✅ Phase 1: 기본 인프라 (완료)
- [x] 프로젝트 초기 설정
- [x] TDD 환경 구축
- [x] 데이터베이스 연결 및 스키마
- [x] Express 서버 설정
- [x] 유틸리티 함수

### 🔄 Phase 2: 인증 시스템 (진행 예정)
- [ ] JWT 인증
- [ ] 회원가입/로그인
- [ ] 이메일 인증
- [ ] 토큰 갱신

### 📋 Phase 3: 핵심 기능 (예정)
- [ ] 예약 관리 API
- [ ] 보관함 관리 API
- [ ] 대시보드 API

### 🎯 Phase 4-6 (예정)
- [ ] 리뷰 시스템
- [ ] 통계 분석
- [ ] Toss Payments 연동
- [ ] 외부 API 연동

---

## 🤝 기여

이 프로젝트는 현재 비공개 개발 중입니다.

---

## 📄 라이선스

이 프로젝트는 비공개 프로젝트입니다.

---

## 📞 연락처

프로젝트 관련 문의: [GitHub Issues](https://github.com/Vryez11/suittrip-server/issues)

---

**마지막 업데이트**: 2025-01-14
**버전**: 1.0.0 (Phase 1 완료)

---

<div align="center">
  <sub>Built with ❤️ using Node.js, Express, and MySQL</sub>
</div>
