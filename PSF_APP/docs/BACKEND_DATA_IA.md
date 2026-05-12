# BACKEND_DATA_IA (라우터별 백엔드 데이터 요구사항)

본 문서는 `FRONT_MOCK_PROMPT.md` 기반으로 정의된 페이지 라우터들을 실제 백엔드와 연동할 때 각 페이지에서 요구되는 데이터 CRUD(Create, Read, Update, Delete) 작업을 정의합니다. 이 문서는 기존 IA(Information Architecture) 문서를 대체하여 API 설계 및 데이터베이스 모델링의 기초 자료로 활용됩니다.

## 1. 라우터별 데이터 CRUD 명세

### 1.1. `/` (로그인 라우터)
- **접근 권한:** Public
- **기능:** 사용자 인증 및 세션 발급
- **CRUD 요구사항:**
  - **[Read] 로그인 인증 및 정보 조회:**
    - `Request:` `username`(ID), `password`
    - `Response:` `token`(Session/JWT), 사용자 기본 정보(`id`, `name`, `role`, `team`, `emoji`)

### 1.2. `/home` (대시보드 홈)
- **접근 권한:** All Authenticated
- **기능:** 역할별 메인 화면 뷰 및 요약 정보 제공
- **CRUD 요구사항:**
  - **[Read] 내 정보 조회:** (세션/토큰 기반) 로그인한 사용자의 프로필 상태 조회
  - **[Read] 최근 공지사항 조회:**
    - `Request:` `limit=1`, `sort=recent`
    - `Response:` 가장 최근 등록된 공지사항 1건 (`id`, `title`, `isImportant`, `date`)
  - **[Read] 대시보드 요약 (선택적):** 의전/본부의 경우 현황 요약 데이터 간략 조회

### 1.3. `/notices` (공지사항 목록/상세)
- **접근 권한:** All Authenticated (조회), 본부 (생성/삭제)
- **기능:** 전체 공지사항 확인 및 본부의 관리(작성, AI 초안, 삭제) 기능
- **CRUD 요구사항:**
  - **[Read] 공지사항 목록/상세 조회:**
    - `Response:` 공지사항 리스트 (`id`, `title`, `date`, `content`, `isImportant`)
  - **[Create] 공지사항 새 글 작성 (본부 전용):**
    - `Request:` `title`, `content`, `isImportant`, 로그인한 `author_id`
  - **[Delete] 공지사항 삭제 (본부 전용):**
    - `Request:` `notice_id`
  - **[Create/Read] AI 보조 공지 초안 생성 (본부 전용):**
    - `Request:` `prompt` (주제/키워드: 식사, 교통 등)
    - `Response:` AI가 생성한 `generated_title`, `generated_content`

### 1.4. `/attendance` (QR 출석)
- **접근 권한:** 참석자 (Attendee)
- **기능:** 참석자의 QR 스캔을 통한 출석 체크
- **CRUD 요구사항:**
  - **[Read] 현재 내 출석 상태 확인:**
    - `Request:` `user_id`
    - `Response:` 당일/해당 일정 출석 여부 상태값
  - **[Create] 출석 인증 기록 추가:**
    - `Request:` `user_id`, `timestamp`, `qr_data`(스캔값)
    - `Response:` 인증 성공 여부 (`success`, 기록된 시간)

### 1.5. `/gps` (위치 공유)
- **접근 권한:** 인솔자 (Guide)
- **기능:** 인솔자의 현재 위치 송신 토글 및 좌표 전송
- **CRUD 요구사항:**
  - **[Update] 위치 송신 상태(ON/OFF) 변경:**
    - `Request:` `guide_id`, `is_transmitting`
  - **[Create/Update] 실시간 GPS 좌표 및 상태 전송:**
    - `Request:` `guide_id`, `latitude`, `longitude`, `timestamp`, `status`(이동중 등 상태 텍스트)

### 1.6. `/dashboard` (운영 현황 대시보드)
- **접근 권한:** 의전 (Escort), 본부 (HQ)
- **기능:** 출석 통계, 인솔자 GPS, 특이사항 모니터링
- **CRUD 요구사항:**
  - **[Read] 출석 통계 집계 데이터:**
    - `Request:` `team_id` (의전은 소속 팀 대상, 본부는 전체 대상 분석)
    - `Response:` `total`, `attended`, `missing` 누적 수치
  - **[Read] 조건별 인솔자 위치 리스트 조회:**
    - `Request:` `team_id` 필터
    - `Response:` 조건에 맞는 인솔자들의 최신 위치(`guide_id`, `name`, `team`, `address`, `status`)
  - **[Read] 특이사항 메모 리스트 조회:**
    - `Request:` `team_id` 또는 전체
    - `Response:` 현장 상황 노트 리스트 (`id`, `author`, `content`, `time`)
  - **[Create] 신규 특이사항 메모 등록 (의전 전용):**
    - `Request:` `author_id` (의전), `team_id`, `content`

### 1.7. `/chat` (메시징 및 채팅방)
- **접근 권한:** All Authenticated
- **기능:** 역할/팀 권한에 맞는 채팅방 접속 및 메시지 교환
- **CRUD 요구사항:**
  - **[Read] 접속 가능한 채팅방 목록 조회:**
    - `Request:` 사용자 `role`, `team`
    - `Response:` 권한에 맞는 채팅방 리스트 (`room_id`, `room_name` 등)
  - **[Read] 특정 채팅방 내 메시지 조회:**
    - `Request:` `room_id`, `page/cursor`
    - `Response:` 채팅 내역 (`message_id`, `sender_id`, `content`, `timestamp`)
  - **[Create] 새로운 텍스트 메시지 전송:**
    - `Request:` `room_id`, 로그인한 `sender_id`, `content`

### 1.8. `/chatbot` (AI 관광/안내 챗봇)
- **접근 권한:** All Authenticated
- **기능:** 행사, 관광, 교통 관련 사용자와 AI 챗봇 간의 질의응답
- **CRUD 요구사항:**
  - **[Read] 내 챗봇 대화 히스토리 로드:**
    - `Request:` `user_id`
    - `Response:` 이전 대화 내역 배열 `[{ type: 'user'|'bot', message, timestamp }]`
  - **[Create] 질문 전송 및 답변 생성:**
    - `Request:` `user_id`, `message` (질문 텍스트)
    - `Response:` 챗봇 엔진을 거친 응답 `answer_message`

### 1.9. `/profile` (개인 프로필)
- **접근 권한:** All Authenticated
- **기능:** 내 정보 확인 및 개인 연락망 업데이트
- **CRUD 요구사항:**
  - **[Read] 상세 프로필 정보 조회:**
    - `Request:` `user_id`
    - `Response:` `username`, `name`, `role`, `team`, `emoji`, `phone`, `email`
  - **[Update] 연락처 및 이메일 수정 반영:**
    - `Request:` `user_id`, 수정된 `phone`, 수정된 `email`

### 1.10. `/contacts` (연락처 조회망)
- **접근 권한:** All Authenticated
- **기능:** 권한에 따른 그룹 연락망 조회 및 이름 기반 검색
- **CRUD 요구사항:**
  - **[Read] 연락처 데이터베이스 조회:**
    - `Request:` 요청자의 `role`, `team` 조건, `search_keyword`(이름 검색 시)
    - `Response:` 권한(참석자는 팀만, 의전/본부는 전체)에 맞춰 필터링 및 이름 검색이 적용된 유저 리스트 (`id`, `name`, `role`, `team`, `phone`, `email`, `emoji`)

### 1.11. `/accounts` (관리자 계정 통합 관리)
- **접근 권한:** 본부 (HQ) 전용
- **기능:** 플랫폼에서 활동할 새로운 유저 생성 및 접근 박탈(삭제)
- **CRUD 요구사항:**
  - **[Read] 전체 시스템 회원 목록 조회:**
    - `Response:` 모든 승인된 가입자 목록 (`id`, `username`, `name`, `role`, `team`)
  - **[Create] 신규 계정 발급:**
    - `Request:` 새 `username`, `password`, `name`, `role`, `team`
    - `Response:` 성공 시 생성된 User 정보 반환, 실패 시(id 중복 등) 예외 메시지 반환
  - **[Delete] 기존 계정 삭제:**
    - `Request:` 삭제할 대상의 `user_id`

---

## 2. 요약: 백엔드 구축 시 필요 핵심 데이터베이스 엔티티 (가안)
위 라우터 요구사항을 충족하기 위한 기준 데이터베이스 모델(Table) 정리입니다.

1. **`User` (사용자)**:
   - 역할(Role), 권한, 팀(Team), 이메일, 전화번호, 접속자격(비밀번호 해시 등)
2. **`Notice` (게시판/공지)**:
   - 본문, 제목, 필독 유무, 작성일, 작성자(User 참조)
3. **`Attendance` (출석부)**:
   - 참석자 id(User 참조), 스캔된 시간, 상태 여부
4. **`GuideLocation` (GPS 트래커)**:
   - 인솔자 id, 위도, 경도, 업데이트 타임스탬프, 현재 송신 중 상태
5. **`Note` (상황 메모)**:
   - 의전 기록자 id, 대상 팀, 내용, 기록 시간
6. **`ChatRoom` & `ChatMessage` (메신저 통신망)**:
   - 채팅방의 속성(특정 팀 전용인지, 본부 전용인지), 메시지 내용 및 발송인 이력
7. **`ChatbotSession` (챗봇 로깅)**:
   - 사용자의 과거 챗봇 문답 로그 보관용
