# PSF 프로젝트 AWS 배포 기획서

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
