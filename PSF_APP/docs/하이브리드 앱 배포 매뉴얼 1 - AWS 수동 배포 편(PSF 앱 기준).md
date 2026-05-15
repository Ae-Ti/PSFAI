```text
목차

0. 개요
1. AWS 배포 기획서
2. AWS 인프라 구축
3. 코드 설정 및 배포
4. 프론트엔드 배포
5. 프론트엔드 도메인 연결
6. 요약 및 남은 진행 상황

```

---

# 0. 개요

**목표 및 설명**
- 작성한 웹앱을 AWS로 배포한다. 현재 문서에서 처음 웹페이지 수동 배포를 실시한 후, 속편에서 도커를 통한 자동 배포 및 앱 패키징 등을 함으로써 웹과 하이브리드 앱 서비스를 동시 지원한다.
- 현재 문서에서는 실무에 가깝게, 그리고 저비용 최적화된 배포를 목표로 한다. (약 50달러 미만 예상)
- 주 사용 서비스: 백엔드 - EC2, ECR, RDS, 프론트엔드 - Cloudfront, S3
- AWS UI는 업데이트되면서 일부 변경되므로, 매뉴얼과 다른 점이 있다면 추가적으로 조사하기 바람.

**준비물**
- AWS 콘솔 계정 등록을 미리 해야 한다.
- 이용하고자 하는 도메인을 미리 구매해야 한다. 본 메뉴얼에서는 가비아를 통해 도메인 구매 및 설정을 진행했다.
- 작성한 웹앱은 React+Spring boot+PostgreSQL 조합이다. 프론트엔드와 백엔드, 2개의 프로젝트가 axios로 연결되어 있어야 하며, 로컬 테스트 기준 정상 작동함을 먼저 확인해야 한다. 현재 문서에서는 해당 기준으로 작성된 프로젝트인 PSF 앱 배포를 진행한다.
---

# 1. AWS 배포 기획서

*이 기획서는 초기 기획이며, 아래 2번부터의 실제 배포와는 순서 및 일부 과정 등 차이가 있음을 유의할 것. 이상적인 배포는 이러한 형식임을 참고하기 위해 배치하였음*

> **목표**: 소규모 운영 + 저비용 + Docker 실무 경험
> **선택 스택**: EC2 + Nginx + Docker(docker-compose) + ECR + RDS + S3 + CloudFront

---

## 1. 전체 아키텍처

```
사용자 (웹 브라우저 / iOS·Android 하이브리드 앱)
  │
  ├─ 웹/앱 접속 ──────→ CloudFront ──→ S3 (React 빌드물)
  │
  ├─ API 요청 ─────────→ CloudFront → EC2 Nginx(443) → Spring Boot(8080, 내부)
  │
  └─ WebSocket ────────→ wss://api.yourdomain.com
                              → EC2 Nginx(443, SSL 처리)
                              → Spring Boot(8080, 내부, ws://)

[EC2 내부 구성 - docker-compose]
┌────────────────────────────────────────┐
│ EC2 (t3.small)                         │
│  ┌──────────────────┐                  │
│  │ Nginx 컨테이너    │ ← 443포트 공개   │
│  │ - SSL 처리       │   Let's Encrypt  │
│  │ - 리버스 프록시   │                  │
│  └────────┬─────────┘                  │
│           │ 내부 통신 (ws/http)         │
│  ┌────────▼─────────┐                  │
│  │ Spring Boot 컨테 │ ← 8080, 내부만   │
│  │ - REST API       │                  │
│  │ - WebSocket      │                  │
│  └──────────────────┘                  │
└────────────────────────────────────────┘
         │
    RDS PostgreSQL (Private, EC2에서만 접근)

[배포 파이프라인]
로컬 → Docker 빌드 → ECR Push → EC2 SSH → ECR Pull → docker-compose up
```

---

## 2. 서비스 구성 및 비용

| 서비스 | 역할 | 월 비용 |
|--------|------|--------|
| **S3** | React 빌드물 정적 호스팅 | ~$1 |
| **CloudFront** | CDN, HTTPS, 캐싱 | ~$1–2 |
| **EC2** (t3.small) | Nginx + Spring Boot 컨테이너 실행 | ~$15 |
| **ECR** | Docker 이미지 저장소 | ~$0.05 |
| **RDS** (db.t3.micro) | PostgreSQL | ~$12 (첫 12개월 무료) |
| **ACM** | CloudFront용 SSL (자동 갱신) | **무료** |
| **Let's Encrypt** | EC2 Nginx용 SSL (자동 갱신) | **무료** |
| **IAM / VPC / SG** | 권한·네트워크 관리 | **무료** |
| **Route 53** | 커스텀 도메인 DNS (선택) | ~$0.5 |
| **합계** | | **약 $30/월** |

> ✅ ALB 없음 — Nginx가 SSL + 리버스 프록시 역할 대체
> ✅ SSL 인증서 2종: CloudFront용(ACM 무료) + EC2 Nginx용(Let's Encrypt 무료)

---

## 3. 서비스별 상세 구성

### 3-1. 프론트엔드 — S3 + CloudFront

| 항목 | 내용 |
|------|------|
| 빌드 | `npm run build` → `dist/` 산출물 |
| 스토리지 | S3 버킷 (퍼블릭 접근 차단, CloudFront OAC만 허용) |
| CDN | CloudFront Distribution — HTTPS + 커스텀 도메인 |
| SPA 라우팅 | CloudFront 오류 페이지: 403/404 → `/index.html` (200 반환) |
| 캐싱 | `index.html`: no-cache / JS·CSS: 1년 캐시 |

### 3-2. 백엔드 — EC2 + Nginx + Docker

| 항목 | 내용 |
|------|------|
| 인스턴스 | t3.small (0.5vCPU, 2GB RAM) |
| OS | Amazon Linux 2023 |
| 공인 IP | Elastic IP (재시작 후에도 IP 고정) |
| Nginx 역할 | SSL 종단(443), HTTP→HTTPS 리다이렉트, 리버스 프록시, WebSocket 프록시 |
| SSL 인증서 | Let's Encrypt (Certbot) — 무료, 90일 자동 갱신 |
| Spring Boot | HTTP 8080, EC2 내부 통신만, 외부 직접 접근 불가 |
| 관리 | docker-compose로 Nginx + Spring Boot 한번에 관리 |

### 3-3. 트래픽 흐름 상세

```
[프론트엔드]
클라이언트
  → https://yourdomain.com          (CloudFront → S3, 정적 파일만)

[REST API]
클라이언트
  → https://api.yourdomain.com/api/...  (EC2 직접, CloudFront 우회)
  → EC2 Nginx :443                       (SSL 처리)
  → Spring Boot :8080                    (HTTP 내부)

[WebSocket]
클라이언트
  → wss://api.yourdomain.com/ws/...      (EC2 직접, CloudFront 우회)
  → EC2 Nginx :443                       (WSS→WS, SSL 처리)
  → Spring Boot :8080                    (WS 내부)
```

> ⚠️ **CloudFront로 API를 라우팅하면 `Authorization` 헤더가 삭제됨** (CloudFront 기본 동작)
> → API + WebSocket 모두 `api.yourdomain.com`으로 EC2에 직접 연결, CloudFront는 **S3 정적 파일 전용**
> → Nginx이미 `api.yourdomain.com`에 `/api/`와 `/ws/` 경로 모두 설정

### 3-4. 이미지 저장소 — ECR

| 항목 | 내용 |
|------|------|
| 리포지토리 | `psf-backend` (Private) |
| 이미지 태그 | Git SHA 또는 `latest` |
| EC2 → ECR | 같은 리전: 데이터 전송 무료 |

### 3-5. 데이터베이스 — RDS PostgreSQL

| 항목 | 내용 |
|------|------|
| 엔진 | PostgreSQL 15+ |
| 인스턴스 | db.t3.micro (첫 12개월 무료 티어) |
| 접근 제한 | EC2 Security Group ID로만 5432 허용 |
| 초기화 | SSH 터널링으로 접속 후 schema.sql 수동 실행 |

> ⚠️ **로컬에서 RDS에 직접 접속 불가** (Private Subnet) — SSH 터널링 필수
> - DBeaver/DataGrip: **SSH Tunnel** 옵션 → EC2 IP + .pem 키 입력
> - EC2를 징검다리 삼아 RDS에 안전하게 접속
> - 이 작업 시 EC2 SG에 내 IP로 SSH(22) 임시 허용 필요 (작업 후 닫기)

---

## 4. Docker 구성 파일

### 4-1. Dockerfile (백엔드)

```dockerfile
# Stage 1: Gradle 빌드
FROM gradle:8-jdk21 AS builder
WORKDIR /app
COPY . .
RUN gradle bootJar --no-daemon

# Stage 2: 경량 JRE 실행
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/build/libs/psf-backend-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### 4-2. docker-compose.yml (EC2에 배치)

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro         # Let's Encrypt 인증서
      - /var/www/certbot:/var/www/certbot:ro         # ✅ webroot ACME 챌린지 공유 (누락 시 --webroot 갱신 실패)
    depends_on:
      - backend
    restart: always

  backend:
    image: <ECR_URI>/psf-backend:latest
    expose:
      - "8080"           # 내부 통신만, 호스트에 직접 노출 안 함
    env_file:
      - .env.production  # 환경변수 파일
    restart: always
    # ✅ 로그 로테이션 — 미설정 시 디스크 풀로 서버 다운 위험
    logging:
      driver: "json-file"
      options:
        max-size: "10m"    # 파일당 최대 10MB
        max-file: "3"      # 최대 3개 파일 보관 (총 30MB)
```

### 4-3. nginx.conf

```nginx
events {}

http {
    # HTTP 서버 — ACME 챌린지 예외 처리 후 HTTPS 리다이렉트
    server {
        listen 80;
        server_name yourdomain.com api.yourdomain.com;

        # ✅ Let's Encrypt webroot 인증 경로 예외 (없으면 301 루프로 갱신 실패)
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        # 그 외 모든 HTTP → HTTPS 리다이렉트
        location / {
            return 301 https://$host$request_uri;
        }
    }

    # api.yourdomain.com — REST API + WebSocket 직접 연결
    # ✅ CloudFront를 거치지 않으므로 Authorization 헤더 보존
    server {
        listen 443 ssl;
        server_name api.yourdomain.com;

        # ✅ 인증서 경로는 yourdomain.com — certbot이 두 도메인을 한 번에 발급하면
        #    첫 번째 도메인 이름(yourdomain.com) 폴더 하나에만 저장됨
        #    api.yourdomain.com 폴더는 생성되지 않아 Nginx 기동 실패 주의
        ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

        # REST API
        location /api/ {
            proxy_pass http://backend:8080;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # WebSocket
        location /ws/ {
            proxy_pass http://backend:8080;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "Upgrade";
            proxy_set_header Host $host;
            proxy_read_timeout 3600s;
        }
    }
}
```

---

## 5. 배포 전 필수 코드 수정 사항

### 5-1. [프론트] API URL 환경변수화

> Vite `.env` 파일 자동 분리 — `npm run dev`와 `npm run build`가 서로 다른 파일을 자동으로 읽음.
> 로컬 개발 환경은 기존과 완전히 동일하게 유지됨.

```js
// src/api/client.js
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  //       ↑ 프로덕션 URL         ↑ 비어 있으면 '/api' → Vite 프록시 → localhost:8080
});
```

```bash
# .env.development  ← npm run dev 시 자동 적용 (로컬 개발 전용)
VITE_API_BASE_URL=   # 비워두면 Vite 프록시 → localhost:8080

# .env.production   ← npm run build 시 자동 적용 (배포 전용)
# ✅ CloudFront 우회, EC2 직접 연결 (Authorization 헤더 보존)
VITE_API_BASE_URL=https://api.yourdomain.com/api
```

| 실행 명령 | 적용 파일 | API 연결 |
|----------|----------|---------|
| `npm run dev` | `.env.development` | Vite 프록시 → `localhost:8080` |
| `npm run build` | `.env.production` | `https://api.yourdomain.com/api` (EC2 직접) |

### 5-2. [프론트] WebSocket URL 환경변수화

```js
// AppContext.jsx
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
//             ↑ 프로덕션 wss://    ↑ 비어 있으면 로컬 직접 연결
```

```bash
# .env.development  ← 비워두면 로컬 백엔드 자동 사용
VITE_WS_URL=

# .env.production
VITE_WS_URL=wss://api.yourdomain.com/ws
```

### 5-3. [백엔드] CORS 도메인 추가

> 기존 `localhost:5173`은 제거하지 않고 유지 — 추가만 하므로 로컬 개발 영향 없음.

```java
config.setAllowedOriginPatterns(List.of(
    "http://localhost:5173",       // 로컬 개발 (기존 유지)
    "https://yourdomain.com",      // 프로덕션 웹 (추가)
    "https://*.cloudfront.net",    // CloudFront 직접 접근 (추가)
    "capacitor://localhost",       // Capacitor iOS (추가)
    "http://localhost"             // Capacitor Android (추가)
));
```

### 5-4. [백엔드] Health Check 엔드포인트 추가

```java
@RestController
public class HealthController {
    @GetMapping("/api/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }
}
```

### 5-5. [백엔드] JPA DDL 모드 변경

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: validate   # update → validate (프로덕션 스키마 자동 변경 방지)
```

---

## 6. EC2 초기 세팅 명령어

```bash
# 1. Docker 설치 (Amazon Linux 2023)
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# 2. Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. AWS CLI 설치 + ECR 로그인 권한 설정
sudo yum install -y awscli
# EC2 IAM Role에 ECR 읽기 권한 부여 (콘솔에서)

# 4. Let's Encrypt (Certbot) 설치 및 인증서 발급
#    ⚠️ --standalone 대신 --webroot 사용
#    --standalone은 Nginx가 점유한 80포트와 충돌 → 갱신 시 100% 실패
#    --webroot는 Nginx가 켜진 상태에서 인증파일을 서빙하므로 Nginx 재시작 불필요
sudo yum install -y certbot

# Nginx에 webroot 체인지 경로 쫐마우트 추가 (nginx.conf 수정 필요 — 아래 4-3 참고)
sudo mkdir -p /var/www/certbot

# 인증서 발급 (초첨 발급 시에는 --standalone 사용, Nginx 중지 후 실행)
docker-compose stop nginx
sudo certbot certonly --standalone -d yourdomain.com -d api.yourdomain.com
docker-compose start nginx

# 이후 갱신은 --webroot 사용 (갱신 시 Nginx 안 께도 됨)
# cron 자동 갱신 등록
echo "0 12 * * * root certbot renew --quiet --webroot -w /var/www/certbot && /usr/local/bin/docker-compose -f /home/ec2-user/psf/docker-compose.yml restart nginx" \
  | sudo tee /etc/cron.d/certbot-renew

# 5. docker-compose.yml, nginx.conf, .env.production 파일 업로드 후
docker-compose up -d
```

---

## 7. CI/CD 파이프라인 (GitHub Actions)

### 백엔드: `.github/workflows/deploy-backend.yml`

> ✅ **SSH 대신 AWS SSM Run Command 사용** — GitHub Actions Runner IP가 매번 바뀌므로
> EC2 SG에 SSH(22) 포트를 열어두면 보안 취약. SSM은 SSH 완전 불필요.
> EC2 IAM Role에 `AmazonSSMManagedInstanceCore` 정책만 부여하면 동작.

```
[Push to main]
      │
      ▼
1. Gradle 빌드 + 테스트
2. Docker 이미지 빌드
3. ECR 로그인 + Push (태그: Git SHA)
4. AWS SSM Run Command로 EC2에 명령 전송 (SSH 불필요)
   - docker-compose pull backend
   - docker-compose up -d --no-deps backend
   - docker-compose restart nginx   ← IP 쾐싱 초기화, 502 오류 예방
5. /api/health 응답으로 배포 성공 확인
```

```yaml
# .github/workflows/deploy-backend.yml 핵심 스텝
- name: Deploy via SSM
  run: |
    aws ssm send-command \
      --instance-ids ${{ secrets.EC2_INSTANCE_ID }} \
      --document-name "AWS-RunShellScript" \
      --parameters 'commands=[
        "aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin <ECR_URI>",
        "cd /home/ec2-user/psf && docker-compose pull backend",
        "cd /home/ec2-user/psf && docker-compose up -d --no-deps backend",
        "cd /home/ec2-user/psf && docker-compose restart nginx"
      ]'
# ✅ nginx restart: 백엔드 컨테이너 재생성 시 IP가 바뀌면 Nginx가 이전 IP를 캐싱하여 502 발생 → restart로 예방
```

### 프론트엔드: `.github/workflows/deploy-frontend.yml`

```
[Push to main]
      │
      ▼
1. npm ci
2. npm run build (VITE_API_BASE_URL, VITE_WS_URL 주입)
3. AWS S3 Sync (dist/ → S3 버킷)
4. CloudFront Invalidation (/* 캐시 무효화)
```

---

## 8. 보안 체크리스트

### Security Group (EC2)
- [ ] 인바운드 80: 전체 허용 (HTTP → HTTPS 리다이렉트용)
- [ ] 인바운드 443: 전체 허용 (HTTPS + WSS)
- [ ] 인바운드 22 (SSH): **개발 중 내 IP만 허용 / 운영 시 닫는 것 권장**
      → CI/CD는 SSM을 사용하므로 SSH 불필요
- [ ] 인바운드 8080: **허용 안 함** (Nginx 내부 통신만, 외부 차단)
- [ ] EC2 IAM Role: `AmazonSSMManagedInstanceCore` + `AmazonEC2ContainerRegistryReadOnly` 정책 추가

### Security Group (RDS)
- [ ] 인바운드 5432: EC2 Security Group ID만 허용 (퍼블릭 접근 차단)

### S3 + CloudFront
- [ ] S3 퍼블릭 접근 차단 → CloudFront OAC로만 허용
- [ ] CloudFront: HTTP → HTTPS 강제 리다이렉트

### 시크릿 관리
- [ ] `.env.production` Git에 커밋 금지 (`.gitignore` 확인)
- [ ] `application.yml` 하드코딩된 API 키·JWT Secret 제거
- [ ] JWT Secret 프로덕션 전용 새 문자열 생성

### WebSocket 운영
- [ ] **Heartbeat (Ping/Pong) 구현** — 모바일 통신사망(NAT)이 흘셨시간 없는 연결을 취록항 수 있음
      → 프론트 + 백엔드 양쉰에서 30초~1분 주기로 빈 메시지(Heartbeat) 주고받도록 구현 필요
      → nginx.conf `proxy_read_timeout 3600s`는 인프라 설정으로는 충분하지만, 모바일 환경에서는 앱 레벨 Heartbeat가 반드시 필요

### 하이브리드 앱
- [ ] Capacitor 설치 + `capacitor.config.json` 작성
- [ ] iOS: ATS → HTTPS 필수
- [ ] `@capacitor/geolocation` 플러그인 교체 검토

---

## 9. 비용 요약

| 서비스 | 월 비용 | 비고 |
|--------|--------|------|
| S3 | ~$1 | |
| CloudFront | ~$1–2 | |
| EC2 t3.small | ~$15 | |
| ECR | ~$0.05 | 사실상 무료 |
| RDS db.t3.micro | ~$12 | **첫 12개월 무료** |
| ACM | $0 | CloudFront SSL |
| Let's Encrypt | $0 | EC2 Nginx SSL |
| Route 53 | ~$0.5 | 커스텀 도메인 시 |
| **합계** | **약 $30/월** | RDS 무료 티어 시 **~$18/월** |

---

## 10. 순차적 배포 단계

```
Phase 1 — AWS 인프라 준비
  ├─ ECR 리포지토리 생성 (psf-backend)
  ├─ EC2 생성 (t3.small, Amazon Linux 2023, Elastic IP 할당)
  ├─ EC2 Security Group 설정 (80, 443, 22만 오픈)
  ├─ EC2 초기 세팅 (Docker, Docker Compose, AWS CLI 설치)
  ├─ RDS 생성 + Security Group 설정 + schema.sql 초기화
  └─ S3 버킷 생성 + CloudFront Distribution 설정

Phase 2 — 코드 수정
  ├─ Dockerfile 작성 (백엔드)
  ├─ docker-compose.yml 작성
  ├─ nginx.conf 작성 (SSL + WebSocket 프록시)
  ├─ Health Check 엔드포인트 추가
  ├─ API URL / WS URL .env.development / .env.production 분리
  ├─ CORS 프로덕션 도메인 추가
  └─ ddl-auto: update → validate

Phase 3 — SSL 인증서 발급
  ├─ 도메인 DNS → EC2 Elastic IP 연결 (A 레코드)
  ├─ Let's Encrypt 인증서 발급 (yourdomain.com, api.yourdomain.com)
  └─ 자동 갱신 cron 등록

Phase 4 — 최초 수동 배포
  ├─ 로컬에서 Docker 빌드 → ECR Push
  ├─ EC2 SSH → ECR Pull → docker-compose up -d
  ├─ 프론트엔드 빌드 → S3 업로드 → CloudFront 배포
  └─ 전체 기능 검증 (로그인, GPS, 채팅, CSV, WebSocket wss://)

Phase 5 — CI/CD 자동화
  ├─ GitHub Actions 워크플로우 작성 (백엔드/프론트엔드)
  └─ AWS IAM OIDC 연동 + 자동 배포 테스트

Phase 6 — 하이브리드 앱
  ├─ Capacitor 설치 + 설정
  ├─ 플러그인 교체 (@capacitor/geolocation 등)
  ├─ iOS → TestFlight → App Store
  └─ Android → 내부 테스트 → Google Play
```

---

# 2. AWS 인프라 구축

### ECR 생성

![[Pasted image 20260502171118.png]]
- **리포지토리 이름:** `psf-backend`
- **이미지 태그 설정 (Mutable / Immutable):** 지금 선택되어 있는 **Mutable(기본값)** (배포 시 태그 덮어쓰면서 업데이트할 예정)
- **푸시 시 스캔 활성화(Scan on push)**: 활성화(토글 켜기) *향상된 스캔은 켜지 말기*
- **그 외 설정:** 기본값

리포지터리 생성 버튼 누르면 완료.

### EC2 서버 생성

- **이름:** `psf-backend-server` (원하시는 다른 이름으로 해도 된다)
- **애플리케이션 및 OS 이미지 (AMI)**:
	- **Quick Start 목록에서:** **Amazon Linux** 선택
	- **Amazon Machine Image (AMI):** **Amazon Linux 2023 AMI** (기본 선택된 최신 버전) 그대로 유지
- **인스턴스 유형:** **`t3.small`**로 변경. (기획서에 명시된 스펙)

**키 페어**
- **키 페어 이름:** 오른쪽의 **[새 키 페어 생성]**을 클릭, `psf-key` (또는 원하시는 이름)
- **키 페어 유형:** **RSA**
- **프라이빗 키 파일 형식:** **.pem**   
- 설정 후 **[키 페어 생성]** 버튼을 누르면 `.pem` 파일이 다운로드된다.

> ⚠️ **매우 중요:** 이 `.pem` 파일은 나중에 RDS(데이터베이스)에 접속할 때 **반드시 필요한 마스터키**이므로, 절대 잃어버리지 않게 안전한 폴더에 잘 보관할 것!

**네트워크 설정**
- **방화벽 (보안 그룹):** '보안 그룹 생성'이 선택된 상태에서 아래 세 가지를 설정한다.
    - **SSH 트래픽 허용:** 체크하고, 옆의 드롭다운을 '위치 무관'에서 **'내 IP'**로 반드시 변경. (보안을 위해 지금 작업하시는 PC에서만 접근하게 막는다, IP 변경시 다시 해야됨.)     
    - **HTTPS 트래픽 허용:** 체크 (나중에 Nginx 443 포트로 들어올 트래픽)    
    - **HTTP 트래픽 허용:** 체크 (Nginx 80 포트로 들어올 트래픽)
        
**스토리지 (볼륨) 구성**: 기본값인 `8` GiB `gp2`  크기를 **`30`** GiB로 변경하고, `gp2`를 클릭해 **`gp3`**로 변경.
    
> 💡 Docker를 사용하면 이미지가 쌓여 용량을 꽤 차지한다. AWS 프리티어는 최대 30GB까지 무료로 제공하므로 꽉 채워서 받는 것이 유리하다. gp3는 gp2보다 저렴하고 성능이 좋다.

**그외(파일 시스템 옵션과 고급세부 정보)**: 기본값 유지

### 탄력적 IP 발급 및 연결

AWS EC2는 기본적으로 서버를 껐다 켤 때마다 IP 주소가 바뀐다. 나중에 도메인을 연결하려면 IP가 고정되어 있어야 하므로, 탄력적 IP(고정 주소)를 발급받아 서버에 연결해야 한다.

1. EC2 대시보드 화면의 왼쪽 메뉴 목록을 아래로 쭉 내리다 보면, **[네트워크 및 보안]** 탭 아래  있는[탄력적 IP]라는 메뉴 클릭
2. 화면 오른쪽 위의 주황색 **[탄력적 IP 주소 할당]** 버튼을 클릭, 다른 설정은 건드릴 필요 없이, 화면 오른쪽 아래의 **[할당]** 버튼을 바로 클릭.
3. 이제 목록에 방금 할당받은 IP 주소가 보인다. 해당 IP 주소 왼쪽의 **체크박스를 선택**,  화면 오른쪽 위 **[작업]** 버튼을 누르고, [탄력적 IP 주소 연결]을 클릭. **인스턴스** 항목의 빈칸을 클릭하면 아까 만든 `psf-backend-server`가 드롭다운 목록에 있으니 선택. 하단 주황색 연결 버튼 클릭하면 끝.

### IAM 권한 부여

방금 만든 EC2 서버에 'IAM 역할'이라는 권한 부여.(이 권한이 있어야 EC2 서버가 ECR에서 도커 이미지를 다운로드할 수 있고, 나중에 깃헙 액션이 SSH 접속 없이 안전하게 배포 명령(SSM)을 내릴 수 있다.)

1. IAM 메인화면에서 왼쪽 세로 메뉴에서 역할 탭을 클릭 후, 오른쪽 위의 주황색 역할 생성 버튼을 누른다.
2. 신뢰할 수 있는 엔티티 유형: AWS, 사용 사례: EC2를 선택 후, 화면 하단의 다음 버튼을 누른다.
3. **권한 정책 연결**: 검색창에서 두가지 정책 검색해서 체크한 후 다음 버튼을 누른다.
	- `AmazonSSMManagedInstanceCore` (SSM 원격 명령 권한)
	- `AmazonEC2ContainerRegistryReadOnly` (ECR 읽기 권한)
4. 역할 이름을 psf-ec2-role로 하고, 역할 생성 버튼을 눌러 생성한다.
5. EC2 메인 화면으로 돌아가 왼쪽 메뉴에서 인스턴스 탭 클릭, 목록에서 `psf-backend-server` 왼쪽의 **체크박스를 선택**, 화면 오른쪽 위 작업 버튼 누르고 보안의 IAM 역할 수정을 클릭한다.
6. 드롭다운 칸을 클릭해 방금 만든 `psf-ec2-role`을 선택, IAM 역할 업데이트를 클릭한다.

### EC2 접속 및 초기 세팅 명령어 실행

1. 키 파일이 있는 폴더로 이동하여 터미널을 연 후 다음 명령어 입력(접속 확인 질문 시 yes)
```bash
chmod 400 psf-key.pem #권한 범위 변경
ssh -i psf-key.pem ec2-user@<탄력적IP> #서버 접속 명령어
```
2. 서버 접속 성공하면 시스템 업데이트 및 도커를 설치한다.
```bash
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user
```
3. Docker Compose 설치
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```
4. AWS CLI 설치
```bash
sudo yum install -y awscli
```
5. 스프링 실행을 위한 자바 설치
```bash
sudo dnf install java-21-amazon-corretto-devel -y
```

### RDS 생성 및 초기화

전체 구성으로 생성을 선택하고, 표준 생성 및 PostgreSQL 항목 선택.

**데이터베이스 생성 방식 및 엔진**
- **데이터베이스 생성 방식:** 표준 생성
- **엔진 옵션:** PostgreSQL

**템플릿 (비용 관련 중요 설정)**
- **템플릿:** **프리 티어(Free tier)**, 또는 개발/테스트하고 '인스턴스 구성' 항목을 반드시 `db.t3.micro`로 직접 변경
    
**설정**
- **DB 인스턴스 식별자:** `psf-db`
- **자격 증명 설정:**
    - **마스터 사용자 이름:** `postgres` (기본값 유지)
    - **마스터 암호:** 원하시는 비밀번호를 두 번 입력 (나중에 서버 코드에 입력해야 하므로 **반드시 메모장에 따로 적어두기!**)
        
**인스턴스 구성 및 스토리지**
- **인스턴스 구성:** `db.t3.micro` (프리 티어 기본값 확인)
- **스토리지:**
    - 할당된 스토리지: `20` (기본값 유지)
    - **스토리지 자동 조정 활성화:** **체크 해제** (예기치 않은 과금을 방지)
        
**연결 (네트워크 및 보안)**
- **컴퓨팅 리소스:** EC2 컴퓨팅 리소스에 연결 안 함 (보안 그룹을 직접 연결할 예정)
- **퍼블릭 액세스:** **아니요** (외부에서 데이터베이스로 직접 찌르는 해킹 시도를 원천 차단)
- **VPC 보안 그룹 (방화벽):**
    - 기존 항목 선택 대신 **새로 생성**을 클릭.
    - 새 VPC 보안 그룹 이름: `psf-rds-sg`
- **데이터베이스 포트:** `5432` (기본값 유지)

**추가 구성 (놓치기 쉬운 필수 항목)**
- 화면 하단의 **[추가 구성]** 텍스트(또는 화살표)를 클릭해서 메뉴를 아래로 펼칩니다.
- **초기 데이터베이스 이름:** `psf` (빈칸으로 두면 초기 DB가 생성되지 않으니 꼭 입력해 주세요)
- **백업:** **자동 백업 활성화 체크 해제** (백업 스토리지 비용 절감 목적)

**요금 절약을 위해 추가적으로 봐야 할 것.**
- 자격 증명 관리: 자체 관리
- 스토리지: 범용 SSD(gp2), 20 GiB, 자동 조정 활성화 체크 해제
- 모니터링 및 추가 구성: 향상된 모니터링 체크 해제, DevOps Guru 해제, 자동백업 활성화 해제

모든 설정을 마쳤다면 화면 맨 아래의 주황색 **[데이터베이스 생성]** 버튼을 클릭.

### 방화벽(보안그룹) 설정

1. EC2 서버 방화벽 ID 확인
- EC2 메인화면 왼쪽 메뉴에서 **[인스턴스]**를 클릭하고, 아까 만든 `psf-backend-server`를 클릭.
- 화면 아래쪽 절반에 세부 정보가 뜨는데, 그중 **[보안]** 탭을 클릭.
- '보안 그룹' 항목 아래에 있는 링크(보통 `launch-wizard-1` 같은 이름이거나 `sg-0abcd...` 형태)를 확인. 이 `sg-`로 시작하는 보안 그룹 ID를 복사하거나 메모.
2. RDS 데이터베이스에 통로 열어주기 (인바운드 규칙 편집)
- EC2 메인화면 왼쪽 메뉴에서 **[네트워크 및 보안]** ➔ [보안 그룹]을 클릭.
- 목록에서 아까 DB를 만들 때 입력했던 `psf-rds-sg`를 찾아 클릭.
- 화면 아래 절반에서 **[인바운드 규칙]** 탭을 누르고, 오른쪽에 있는 **[인바운드 규칙 편집]** 버튼을 클릭.
- 왼쪽 아래 **[규칙 추가]** 버튼을 누르고 아래와 같이 설정.
    - **유형:** 드롭다운을 열어 **`PostgreSQL`**을 선택. (포트 범위가 자동으로 5432로 변환됨.) 
    - **소스:** `사용자 지정`으로 둔 상태에서, 바로 옆의 빈칸(돋보기 모양)을 클릭한 뒤 **1단계에서 복사해 둔 EC2의 보안 그룹 ID(`sg-...`)를 붙여넣기(또는 선택)**.      
- 기존에 있던 다른 규칙들(예: 모든 트래픽 허용 등)이 있다면, 보안을 위해 지워줍니다. (방금 추가한 PostgreSQL 규칙 딱 하나만 남겨두기.)
- 화면 오른쪽 아래 주황색 **[규칙 저장]** 버튼을 누르기.

### RDS 엔드포인트(주소) 확인

- RDS 메인화면 왼쪽 메뉴에서 **[데이터베이스]**를 클릭하고, 아까 만든 **`psf-db`**의 이름을 클릭.
- 중간쯤에 있는 **[연결 및 보안]** 탭을 확인.
- **'엔드포인트'** 항목에 있는 긴 주소(예: `psf-db.xxxx.ap-northeast-2.rds.amazonaws.com`)를 복사해서 메모장에 적어두세요.
    - (나중에 Spring Boot 설정 파일(`application.yml`)에 넣을 실제 데이터베이스 주소)

### S3 및 CloudFront 설정(웹 화면 저장소 및 전송망)

###### 1. S3 버킷 생성 (정적 파일 저장소)

1. 상단 검색창에 **S3**를 검색하고 [버킷 만들기]를 클릭.
2. **버킷 이름:** `<S3_BUCKET_NAME>` (전 세계에서 중복되지 않는 고유한 이름이어야 함.)
3. **AWS 리전:** `아시아 태평양(서울) ap-northeast-2` 확인.
4. **이 버킷의 퍼블릭 액세스 차단 설정:** 모든 체크박스가 **체크(차단)** 되어 있는지 확인. (보안을 위해 S3를 직접 여는 대신 CloudFront를 통해서만 접근하게 할 예정)
5. 나머지 설정은 기본값으로 두고 맨 아래 [버킷 만들기]를 클릭.

###### 2. CloudFront 배포 생성 (전송망 및 HTTPS)

1. 상단 검색창에 **CloudFront**를 검색하고 [배포 생성]을 클릭.
2. 무료 플랜 선택
3. 배포 이름: 빈칸에 `psf-frontend-distribution` 이라고 알아보기 쉽게 이름을 적고, 다른 옵션은 그대로 둔 채 Next 버튼 클릭.
4. **원본 도메인:** 방금 만든 **S3 버킷**을 선택.
5. **원본 액세스:**`Origin access control settings (recommended)`를 선택.
    - **[제어 설정 생성]** 버튼을 누르고, 설정값 그대로 [생성]을 클릭. (이 설정이 있어야 S3가 닫혀 있어도 CloudFront는 파일을 가져올 수 있음)
6. **기본 캐시 동작:**
    - **뷰어 프로토콜 정책:** `Redirect HTTP to HTTPS` 선택. 
7. **웹 애플리케이션 방화벽(WAF):** 비용 절감을 위해 `보호 비활성화`를 선택
8. **설정:**
    - **기본 루트 객체:** `index.html` 입력.    
9. 맨 아래 [배포 생성]을 클릭.

---

# 3. 코드 설정 및 배포

### 백엔드 DB 연결 설정

1. 백엔드 프로젝트에서 설정 파일(application.yml) 열고 DB 파트 제거
2. application-local.yml 파일과 application-prod.yml 파일 작성 (개발 환경과 배포 환경 분리)
- **application-local.yml**
```YAML
spring:
	datasource:
# 환경 변수가 있으면 사용하고, 없으면 기본 로컬 주소를 사용합니다.
		url: ${DATABASE_URL:jdbc:postgresql://localhost:5432/psfdb}
		username: ${DATABASE_USERNAME:psfuser}
		password: ${DATABASE_PASSWORD:psfpass123}
		driver-class-name: org.postgresql.Driver
	jpa:
		hibernate:
			ddl-auto: update
		show-sql: true
```
- **application-prod.yml**
```YAML
spring:
	datasource:
# AWS RDS 엔드포인트 주소는 환경 변수 ${DB_URL}에서 읽어옵니다.
		url: jdbc:postgresql://${DB_URL}:5432/psf
		username: ${DB_USERNAME}
		password: ${DB_PASSWORD}
		driver-class-name: org.postgresql.Driver
	jpa:
		hibernate:
# 운영 환경에서도 테이블이 없을 경우 자동으로 생성하도록 update로 설정합니다.
			ddl-auto: update
		show-sql: false
```
### EC2 보안 그룹 8080 포트 열기(백엔드 작동 테스트용)

1. EC2 콘솔에서 현재 실행 중인 인스턴스를 클릭하고 하단 메뉴에서 **[보안(Security)]** 탭을 선택.
2. **보안 그룹(Security Groups)** 아래에 있는 `sg-0f24445787d5433ef` (launch-wizard-2) 링크를 클릭.
3. 오른쪽 상단의 **[인바운드 규칙 편집(Edit inbound rules)]** 버튼을 선택.
4. [규칙 추가(Add rule)]를 눌러 아래와 같이 입력.
    - **유형:** `사용자 지정 TCP`
    - **포트 범위:** `8080`
    - **소스:** `Anywhere-IPv4` (선택하면 자동으로 `0.0.0.0/0`이 입력됨.)
5. [규칙 저장(Save rules)]을 클릭.
### 백엔드 빌드 및 EC2 배포

1. 프로젝트 빌드: 프로젝트 폴더로 이동해 명령어 입력 (맥 기준)
```bash
./gradlew clean build
```

2. EC2로 파일 전송: PEM 키가 위치한 폴더로 이동해 실행(plain이 붙지 않은 jar 파일을 전송)
```bash
scp -i "자신의키이름.pem" 파일경로/파일이름.jar ec2-user@자신의-EC2-퍼블릭-IP:~
```

3. EC2에서 서버 실행(환경 변수 주입)
```bash
# EC2 접속 후
export DB_URL="jdbc:postgresql:RDS엔드포인트주소:5432/db이름"
export DB_USERNAME="postgres"
export DB_PASSWORD="아까설정한비밀번호"

# 서버 실행 (백그라운드에서 실행되도록 nohup 사용)
nohup java -jar 파일이름.jar &
```

4. 서버 작동 확인
```bash
tail -f nohup.out
```

(백엔드 재실행 시 잔여 프로세스 종료)
```bash
pkill -9 java
```

- 브라우저로 `http://[본인의-EC2-퍼블릭-IP]:8080` 페이지 접속 시 403이 뜨면 정상 작동되고 있는 것임.

---

# 4. 프론트엔드 배포 (S3+CloudFront)

### 프론트엔드 코드 수정(API 주소 연결) 및 빌드

1. 환경변수 파일 생성
- `.env.development`: 로컬 개발용 (`localhost:8080`)
```env
VITE_API_URL=http://localhost:8080
```
- `.env.production`: AWS 운영용 (`EC2 퍼블릭 IP:8080`)
```env
VITE_API_URL= #{http://EC2 퍼블릭 IP:8080}, 추후 https 도메인 주소로 변경
```

2. API 호출 코드 수정 및 API 클라이언트 통합
```JS
// Create a custom axios instance
const apiClient = axios.create({
// 환경 변수가 있으면 해당 주소를 사용하고, 없으면 상대 경로(/api)를 사용.
baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
});
```

3. npm run build 명령어를 통해 빌드 파일 생성(일반적으로 dist 폴더 내 생성)

### S3 버킷 업로드 및 호스팅 활성화

1. 아까 생성한 S3 버킷을 클릭해 업로드 버튼을 눌러 빌드 폴더 내 모든 파일(폴더 자체가 아닌 전체 내용물) 업로드.
2. 버킷의 속성 탭 클릭, 맨 아래 정적 '웹 사이트 호스팅'의 편집 버튼 클릭
	- 활성화 선택
	- 인덱스 문서: index.html 입력
	- 오류 문서: index.html 입력
3. S3 권한 탭의 퍼블릭 액세스 차단의 편집 클릭, 모든 '퍼블릭 액세스 차단' 체크 해제 후 저장
4. 권한 탭 버킷 정책의 편집 클릭 후 아래 내용 복붙.(버킷이름만 본인의 것으로)
```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::본인의-버킷-이름/*"
        }
    ]
}
```
5. 버킷의 속성 탭 하단에 있는 버킷 웹사이트 엔드포인트 URL 주소를 확인하여 백엔드 코드 CORS 수정 (백엔드 수정 후 EC2 배포 다시)

- 예시(이 코드는 나중에 https 적용할 것도 미리 반영되었다.)
```Java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
CorsConfiguration config = new CorsConfiguration();
config.setAllowedOrigins(List.of(
	"http://localhost:5173", // 로컬 테스트용
	"http://<S3_BUCKET_NAME>.s3-website.ap-northeast-2.amazonaws.com", // S3 직접 접속용
	"https://api.psfapp.cloud", // 신규 API 도메인
	"https://psfapp.cloud" // (혹시 사용하실) 메인 도메인
));

config.setAllowedOriginPatterns(List.of(
	"https://*.cloudfront.net" // 모든 CloudFront 도메인 허용
));
config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
config.setAllowedHeaders(List.of("*"));

config.setAllowCredentials(true);
config.setExposedHeaders(List.of("Content-Disposition", "Content-Length", "Content-Type"));
UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
source.registerCorsConfiguration("/**", config);

return source;

}
```

- 이제 아까 확인한 S3 엔드포인트 주소(http)에서 프론트엔드 화면을 확인할 수 있다.

### (뜬금없지만) DB 조작 및 직접 제어

- Mac 기준 DBeaver 프로그램이 대중적이고 쓰기 편하다.
1. 공식 홈페이지 또는 터미널에서 `brew install --cask dbeaver-community` 입력하여 설치
2. AWS RDS 외부 접속 허용(내 인터넷 IP 주소가 바뀌면 다시 해야 함.)
	1. RDS 메인에서 데이터베이스 -> 내 DB 클릭.
	2. 연결 및 보안 탭의 보안 그룹 클릭.
	3. 인바운드 규칙 편집 클릭.
	4. 규칙 추가 버튼 누르기:
		1. 포트 범위:5432
		2. 소스: 내 IP 선택
		3. 설명: `Local access for DBeaver` 정도로 확인하기 쉽게
3. 연결설정
	1. DBeaver를 실행하고 왼쪽 상단의 **새 연결(플러그 모양 아이콘)**을 클릭.
	2. **PostgreSQL**을 선택하고 [Next]를 클릭.
	3. **Main 탭**에 위의 정보들을 입력:
	    - Host: RDS 엔드포인트 주소 입력
	    - Database: `psf` 입력(또는 DB 이름)
	    - Username: `postgres` 입력(또는 유저 네임)
	    - Password: 비밀번호 입력
	4. 왼쪽 하단의 [Test Connection] 클릭.

### CloudFront 연결 및 HTTPS(SSL) 적용

- 현재 HTTPS가 적용되어 있지 않아 GPS API 등 외부 API가 정상적으로 작동하지 않고(네이버 등 허용을 안함), 보안 연결이 되지 않는다. 따라서 HTTPS를 적용해야 한다.

1. 생성해놓은 Cloudfront 주소 확인(Cloudfront에서 생성해놓은 배포 클릭하면 세부 정보에 https가 적용된 배포 도메인이 있음.)
2. 해당 배포의 원본 탭 클릭하여 원본 도메인이 현재 S3 버킷을 가리키게 변경.
3. 배포의 일반 탭에서 설정 항목 우측 편집 버튼 클릭, 기본 루트 객체 칸에 `index.html ` 라고 입력 및 저장.
4. 배포의 오류 페이지 탭에서 사용자 정의 오류 응답 생성 버튼 클릭.
	1. 아래와 같이 설정
		- **HTTP 오류 코드:** `403: Forbidden`
		- **오류 응답 사용자 정의:** `예(Yes)`
		- **응답 페이지 경로:** `/index.html` _(슬래시 꼭 포함)_
		- **HTTP 응답 코드:** `200: OK`
	2. 저장 후 404 오류 코드도 똑같은 응답 경로와 응답코드로 생성.
5. 배포의 무효화 탭에서 무효화 생성 클릭 및 객체 경로에 `/*`라고 입력.

- 이제부터는 CloudFront 주소로 접속하면 된다.

### 백엔드 HTTPS 적용

- 프론트엔드만 https 적용하고, 백엔드는 http인 경우 통신이 되지 않는다. 따라서 백엔드에도 도메인을 연결하고 SSL 인증서를 씌워야 한다. (DNS 연결, Nginx 설치, Let's encrypt(SSL)적용)

- **먼저 구매한 도메인을 이용해 DNS 연결을 진행한다. - 가비아 DNS 설정 (EC2 IP 연결하기)**
1. **가비아 홈페이지**에 로그인 후 오른쪽 위 [My가비아] 클릭.
2. 가운데쯤 있는 **[DNS 관리툴]** 버튼을 클릭.
3. 방금 구매한 도메인 우측에 있는 **[설정]** 버튼을 클릭.
4. 'DNS 설정' 화면이 나오면 **[레코드 수정]** 버튼을 클릭, [레코드 추가]를 클릭합니다.
5. 아래와 같이 빈칸에 입력.
    - **타입:** `A` (IP 주소로 연결한다는 뜻)
    - **호스트:** `api` (소문자로 입력)
    - **값/위치:** `<EC2_PUBLIC_IP>` (우리 EC2의 퍼블릭 IP)
    - **TTL:** `3600` (또는 기본값 그대로)
6. 우측의 **[확인]**을 누르고, 맨 하단의 **[저장]** 버튼을 클릭.

- **Nginx (HTTPS 처리)**
1. 설치 및 기본 설정
```bash
# 패키지 목록 업데이트 
sudo yum update -y
# Nginx 설치 
sudo yum install nginx -y
# Nginx 시작 및 부팅 시 자동 실행 설정 
sudo systemctl start nginx 
sudo systemctl enable nginx
```

2. 스프링 부트와 연결(nano 에디터 열고 코드 붙여넣기)
```bash
sudo nano /etc/nginx/conf.d/api.conf
```

```Nginx
server { 
	listen 80;
	server_name api.psfapp.cloud;
	
	location / {
	proxy_pass http://localhost:8080;
	proxy_set_header X-Real-IP $remote_addr;
	proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; 
	proxy_set_header Host $http_host; 
	} 
}
```

3. Nginx 재시작 적용
```bash
# 설정 파일 문법 검사 (successful 이라는 단어가 뜨면 통과!)
sudo nginx -t
# Nginx 재시작 
sudo systemctl restart nginx
```

- **Let's Encrypt로 HTTPS 덧씌우기**
1. Certbot 설치
- 파이썬 및 필수 시스템 패키지 설치
```bash
# 파이썬 및 필수 시스템 패키지 설치
sudo yum install python3 augeas-libs -y
# Certbot 전용 가상 환경(격리 공간) 생성
sudo python3 -m venv /opt/certbot/
# Certbot 및 Nginx용 플러그인 설치
sudo /opt/certbot/bin/pip install --upgrade pip
sudo /opt/certbot/bin/pip install certbot certbot-nginx
# 어디서든 명령어를 쓸 수 있게 연결(심볼릭 링크)하기
sudo ln -s /opt/certbot/bin/certbot /usr/bin/certbot
```
2. HTTPS 인증서 발급 및 자동 적용
```bash
sudo certbot --nginx -d api.psfapp.cloud
```
명령어를 실행 후 나오는 질문
- **이메일 주소 입력:** 인증서 갱신 안내를 받을 이메일 (본인 이메일 입력)
- **이용 약관 동의:** `A` (Agree) 입력 후 엔터
- **이메일 수집 동의 (광고):** `N` (No) 입력 후 엔터
- _(중요)_ **HTTP 트래픽을 HTTPS로 리다이렉트 할까요?:** `2` (Redirect) 입력 후 엔터! (이렇게 하면 누군가 http로 들어와도 강제로 https로 연결.)

- **크론 도구 설치 및 갱신 등록 (인증서 자동 갱신 위해 필요. EC2에서 실행)**
```bash
# 크론 패키지 설치
sudo dnf install -y cronie
# 크론 서비스 시작 및 자동 실행 등록
sudo systemctl enable --now crond
# 자동 갱신 명령어 등록
echo "0 12 * * * root certbot renew --quiet && systemctl restart nginx" | sudo tee /etc/cron.d/certbot-renew
```

### 백엔드 HTTPS 적용 이후 FE와 BE 연결

1. 프론트엔드 API 주소 변경(`.env.production`)
```
VITE_API_URL= https://api.psfapp.cloud
# 아까 가비아에서 DNS를 설정한 대로 api.도메인주소 로 변경
```
2. 프론트엔드 재빌드 후 빌드 파일이 담긴 폴더의 내용물을 다시 S3 버킷에 덮어씌운다.
3. CloudFront 캐시 무효화(처음 무효화 생성한 것과 같이 무효화 탭에서 `/*` 무효화 생성)
4. 아까 확인했던 CloudFront 주소로 다시 접속하면 정상적으로 접속이 됨을 확인할 수 있다.

- 이제 HTTPS 적용은 끝났다.
- 참고로, 앞으로 프론트엔드 배포마다 S3에 내용물 재업로드, CloudFront 무효화 생성을 잊지 말고, 백엔드 배포마다 EC2에 jar 파일 전송 및 프로세스 재시작하는 것을 잊지 말아야 한다.
- 외부 API 서비스에도 바뀐 HTTPS 주소를 적용해줘야 한다.

---

# 5.  프론트엔드 커스텀 도메인 연결 매뉴얼

### 개요 (S3 + CloudFront + Route 53 + ACM + 가비아)

> **목표**: `https://psfapp.cloud` (또는 `https://www.psfapp.cloud`)로 접속 시 S3에 올라간 React 앱이 뜨도록 설정한다.

- ⚠️ 핵심 원칙 (먼저 읽기)
- 작업 순서가 매우 중요하다. 많이 헤매게 되니 순서대로 진행할 것.

```
Route 53 호스팅 영역 생성
↓
가비아 네임서버 변경
↓
ACM 인증서 발급 (us-east-1 리전!)
↓
CloudFront 대체 도메인 + 인증서 등록
↓
Route 53 레코드 생성
```

### Step 1. Route 53 호스팅 영역 생성

1. AWS 콘솔 검색창에 **Route 53** 입력 후 접속
2. 왼쪽 메뉴 **[호스팅 영역]** > **[호스팅 영역 생성]** 클릭
3. 입력:
- **도메인 이름**: `psfapp.cloud` (본인 도메인)
- **유형**: 퍼블릭 호스팅 영역
1. **[호스팅 영역 생성]** 클릭

- 생성 후 레코드 목록에 **NS**, **SOA** 두 개가 자동으로 생긴다.

### Step 2. 가비아 네임서버 변경

> 이 단계가 없으면 이후의 모든 DNS 설정이 아무런 의미가 없다고 한다.

1. Route 53에서 방금 만든 `psfapp.cloud` 호스팅 영역 클릭
2. **NS 레코드**의 값(우측)에 있는 **4개 주소**를 메모합니다:

```
ns-xxxx.awsdns-xx.com.
ns-xxxx.awsdns-xx.org.
ns-xxxx.awsdns-xx.net.
ns-xxxx.awsdns-xx.co.uk.
```

> ⚠️ 각 주소 끝의 마침표(`.`)는 가비아 입력 시 제거할것.

3. **가비아 홈페이지** 로그인
4. **My 가비아** > **도메인 관리** > `psfapp.cloud`(서비스를 위해 사놓은 도메인) 선택
5. **[네임서버 설정]** 클릭
6. 1차~4차 네임서버에 위의 4개 주소를 하나씩 입력 후 저장

> ⏳ 변경 후 최대 1~2시간 전파 시간이 필요하다. 전파 전에도 이후 Step 3, 4는 미리 진행할 수 있다.

### Step 3. ACM SSL 인증서 발급

> 🚨 **반드시 `us-east-1 (미국 동부 버지니아 북부)` 리전에서 진행해야 한다!**

> CloudFront는 이 리전의 인증서만 인식한다.

1. AWS 콘솔 **우측 상단 리전**을 **미국 동부(버지니아 북부)** 로 변경
2. 검색창에 **Certificate Manager** 입력 후 접속
3. **[인증서 요청]** 클릭
4. **퍼블릭 인증서 요청** 선택 > [다음]
5. 도메인 이름 입력 (두 개 모두 등록):

- `psfapp.cloud`
- `*.psfapp.cloud` (www 등 서브도메인 전체 커버)

> [다른 이름 추가] 버튼으로 두 번째 도메인 추가

6. **검증 방법**: DNS 검증 선택
7. **[요청]** 클릭

### Step 4. ACM 인증서 DNS 검증

1. 방금 요청한 인증서의 ID를 클릭하여 상세 페이지로 이동
2. 상태가 **'검증 대기 중'** 으로 표시됨
3. **[Route 53에서 레코드 생성]** 버튼 클릭
4. 체크박스 선택 후 **[레코드 생성]** 클릭

> ✅ 이 버튼이 활성화되려면 Step 1의 Route 53 호스팅 영역이 먼저 있어야 한다.

5. 약 1~5분 후 인증서 상태가 **'발급됨(Issued)'** 으로 변경됨

> ⏳ '발급됨'이 될 때까지 다음 단계를 진행하지 말 것.

### Step 5. CloudFront 대체 도메인 + 인증서 등록

1. AWS 콘솔 검색창에 **CloudFront** 입력 후 접속
2. 연결할 배포(Distribution) ID 클릭
3. **[일반(General)]** 탭 > 우측 상단 **[편집(Edit)]** 클릭
4. **대체 도메인 이름(CNAME)** 에 도메인 추가:

- `psfapp.cloud`
- `www.psfapp.cloud` (www도 원한다면)

5. **사용자 정의 SSL 인증서** 드롭다운에서 Step 3~4에서 **발급받은 인증서** 선택

> ⚠️ 인증서 상태가 '발급됨'이 아니면 이 드롭다운에 표시되지 않는다.

6. **[변경 사항 저장]** 클릭
7. 배포 상태가 **'배포 중(Deploying)'** → **'배포됨(Deployed)'** 이 될 때까지 대기 (1~3분)

### Step 6. Route 53 레코드 생성

CloudFront 준비가 완료되었으면, Route 53에 "이 도메인으로 오면 CloudFront로 보내라"는 길을 만듭니다.

### 6-1. 루트 도메인 레코드 (`psfapp.cloud`)

1. Route 53 > `psfapp.cloud` 호스팅 영역 > **[레코드 생성]**
2. 입력:

- **레코드 이름**: **비워두기** (= 루트 도메인)
- **레코드 유형**: `A`
- **별칭(Alias)**: **ON** (토글 활성화)
- **트래픽 라우팅 대상**: `CloudFront 배포에 대한 별칭`
- **배포 선택**: 드롭다운에서 본인의 CloudFront 주소 선택

3. **[레코드 생성]** 클릭

### 6-2. www 서브도메인 레코드 (`www.psfapp.cloud`) — 선택사항

1. Route 53 > **[레코드 생성]**
2. 입력:
- **레코드 이름**: `www`
- **레코드 유형**: `A`
- **별칭(Alias)**: **ON**
- **트래픽 라우팅 대상**: `CloudFront 배포에 대한 별칭`
- **배포 선택**: 동일한 CloudFront 주소 선택

3. **[레코드 생성]** 클릭

## Step 7. 최종 확인

- 최종 Route 53 레코드 완성 목록

| 이름                        | 유형     | 값                                   | 용도           |
| ------------------------- | ------ | ----------------------------------- | ------------ |
| `psfapp.cloud`            | NS     | AWS 네임서버 4개                         | 가비아에 입력한 값   |
| `psfapp.cloud`            | SOA    | (자동 생성)                             | 도메인 권한 정보    |
| `_62f95b....psfapp.cloud` | CNAME  | `_cfbc71fb....acm-validations.aws.` | ACM 인증서 검증용  |
| `psfapp.cloud`            | A (별칭) | CloudFront 주소                       | 프론트엔드 루트 도메인 |
| `www.psfapp.cloud`        | A (별칭) | CloudFront 주소                       | www 서브도메인    |
| `api.psfapp.cloud`        | A      | `<EC2_PUBLIC_IP>`                    | 백엔드 EC2 서버   |

1. 테스트 URL: `https://psfapp.cloud` | ✅ React 앱 화면 표시
2. 테스트 URL: `https://www.psfapp.cloud` | ✅ React 앱 화면 표시 (Step 6-2 했을 경우)
3. 테스트 URL:`http://psfapp.cloud` | ✅ 자동으로 https로 리다이렉트

- 이제 기존 복잡한 CloudFront 주소 대신 우리가 가진 도메인으로 접속할 수 있다. 기본적인 서비스 배포가 완성되었다!

---


# 6. 요약 및 남은 진행 상황

```text
[로컬 개발 PC]
  ├─ 백엔드: ./gradlew build (JAR 생성)
  └─ 프론트엔드: npm run build (dist 폴더 생성)
       │
       ▼
[백엔드 배포 과정 (수동)]
  회원님 PC (Terminal)
  → scp -i psf-key.pem build/libs/*.jar ec2-user@EC2-IP:~ (파일 전송)
  → ssh -i psf-key.pem (EC2 접속)
       └─ EC2: export DB_URL/USERNAME/PASSWORD (환경변수 주입)
       └─ EC2: pkill -9 java (기존 서버 종료)
       └─ EC2: nohup java -jar *.jar & (서버 백그라운드 수동 실행)
       └─ EC2: certbot --nginx -d api.psfapp.cloud (Nginx 기반 SSL 수동 적용)

[프론트엔드 배포 과정 (수동)]
  회원님 PC (Web Browser)
  → AWS S3 Console: dist/ 폴더 내 파일 수동 업로드 (Drag & Drop)
  → AWS S3 Console: 정적 웹 사이트 호스팅 활성화 (index.html 설정)
  → AWS CloudFront Console: 무효화(Invalidation) 생성 (/* 입력하여 즉시 반영)

[도메인 & 네트워크 설정 (수동)]
  가비아(Gabia) / Route 53 / ACM
  → 가비아: 네임서버를 Route 53 주소로 변경
  → 가비아: api.psfapp.cloud를 EC2 고정 IP에 A 레코드로 연결
  → ACM (Virginia 리전): psfapp.cloud용 SSL 인증서 수동 발급
  → CloudFront: 발급된 ACM 인증서 및 대체 도메인 연결 설정

[결과]
  - 최종 접속 주소: https://psfapp.cloud
  - API 통신 주소: https://api.psfapp.cloud/api

```

- 5번까지 진행을 통해 수동으로 배포하는 과정을 완수했다. 이것으로도 서비스를 완성했다고 말할 수 있지만, 좀 더 실무에 가깝게 프로젝트를 관리하고 기존 목표였던 웹, 하이브리드 앱 동시 제공을 위해서는 다음과 같은 과정이 필요하다.

- Docker + ECR 조합 적용을 통한 애플리케이션 컨테이너화 및 관리
- Github Actions 활용 CI/CD 자동화
- 앱 패키징(Capacitor 설정)

- 현재 문서에서는 수동 배포까지만을 다루고, 다음 문서에서 남은 목표를 진행해보자.