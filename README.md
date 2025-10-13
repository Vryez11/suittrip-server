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

## 기여

이 프로젝트는 현재 비공개 개발 중입니다.

## 라이선스

이 프로젝트는 비공개 프로젝트입니다.

## 연락처

프로젝트 관련 문의: [vryez11@gmail.com]

---

**마지막 업데이트**: 2025-01-13
