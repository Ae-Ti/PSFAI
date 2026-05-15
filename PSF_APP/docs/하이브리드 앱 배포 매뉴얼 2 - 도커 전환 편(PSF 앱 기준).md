```text
목차

0. 개요
1. 사전 준비
2. 로컬 파일 작성
3. Docker Desktop으로 이미지 빌드
4. ECR에 이미지 Push
5. EC2 Docker 설치
6. EC2에 파일 업로드
7. 기존 프로세스 종료
8. docker-compose 실행 및 검증
9. Certbot 자동 갱신 cron 업데이트
10. 이후 배포 방법 (업데이트 시)
11. 요약 및 남은 진행상황
```

---
# 0. 개요

**목표 및 설명**
- 이전 문서에서 EC2에서 java -jar 방식으로 수동 배포를 이미 진행한 것을 전제로 하여, 백엔드가 이미 실행 중인 상태에서 Docker로 전환한다.
- (수동 배포 → Docker + docker-compose + ECR)
- 프로젝트 구조와 작업 환경은 이전과 동일하다. (Mac(Apple Silicon), EC2(Amazon Linux 2023, x86_64), Spring Boot, ECR, Nginx)

---

# 1. 사전 준비

### Docker Desktop 설치 (로컬 Mac)

- 도커 데스크탑 앱을 사용하면, 도커 빌드 진행 상황을 파악하기 편하다.

1. [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/) 에서 Mac용 설치파일 다운로드
2. `.dmg` 파일 실행 후 설치
3. 앱 실행 → Mac 상단 메뉴바에 고래 아이콘 🐳이 나타나면 정상

설치 확인 (터미널에서):
```bash
docker --version
# Docker version 25.x.x, build xxxxxxx
```

### AWS CLI 자격 증명 등록 (로컬 Mac)

ECR에 이미지를 Push하려면 AWS 인증이 필요하다.

**AWS 콘솔에서 액세스 키 발급:**
1. AWS 콘솔 우측 상단 계정 이름 클릭 → **보안 자격 증명**
2. **액세스 키** 섹션 → **액세스 키 만들기**
3. 사용 사례: **Command Line Interface(CLI)** 선택
4. 액세스 키 ID와 비밀 액세스 키 복사 및 메모(비밀 키는 이 화면에서만 확인 가능)

**로컬 터미널에서 등록:**
```bash
aws configure
```
```
AWS Access Key ID: [액세스 키 ID]
AWS Secret Access Key: [비밀 액세스 키]
Default region name: ap-northeast-2
Default output format: json
```

### ECR 리포지토리 생성 (수동 배포 편에서 생성했으면 생략.)

1. AWS 콘솔 → **ECR** → **리포지토리 생성**
2. 가시성: **프라이빗**
3. 리포지토리 이름: `psf-backend`
4. 생성 후 URI 확인 (형태: `123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/psf-backend`)

# 2. 로컬 파일 작성

`PSF_BACKEND/` 디렉토리에 아래 4개 파일을 생성해야 한다.

### 2-1. `Dockerfile`

```dockerfile
# ── Stage 1: Gradle 빌드 환경 ──────────────────────────────────
FROM gradle:8-jdk21 AS builder
WORKDIR /app

# 의존성 캐시 레이어 (소스 변경 시에도 재다운로드 방지)
COPY build.gradle settings.gradle ./
COPY gradle ./gradle
RUN gradle dependencies --no-daemon || true

# 소스 복사 후 빌드 (테스트 제외)
COPY . .
RUN gradle bootJar --no-daemon -x test

# ── Stage 2: 경량 JRE 실행 이미지 ─────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# 타임존 설정 (한국)
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Seoul /etc/localtime && \
    echo "Asia/Seoul" > /etc/timezone

COPY --from=builder /app/build/libs/psf-backend-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-Dspring.profiles.active=prod", "-jar", "app.jar"]
```

> **핵심**: Stage 1(빌드)과 Stage 2(실행)를 분리하여 최종 이미지에 Gradle, JDK 등 빌드 도구가 포함되지 않아 이미지 크기가 줄어든다.

### 2-2. `nginx.conf`

> **기존 EC2 Nginx 설정과의 핵심 차이**: `proxy_pass http://localhost:8080` → `proxy_pass http://backend:8080`
> Docker 내부 네트워크에서는 컨테이너 이름(backend)으로 다른 컨테이너에 접근한다.

```nginx
events {}

http {
    # ── HTTP: ACME 챌린지 예외 처리 후 HTTPS 리다이렉트 ──────
    server {
        listen 80;
        server_name psfapp.cloud www.psfapp.cloud api.psfapp.cloud;

        # Let's Encrypt 인증서 갱신용 경로
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        # 그 외 모든 HTTP → HTTPS 강제 리다이렉트
        location / {
            return 301 https://$host$request_uri;
        }
    }

    # ── HTTPS: api.psfapp.cloud (REST API + WebSocket) ───────
    server {
        listen 443 ssl;
        server_name api.psfapp.cloud;

        ssl_certificate     /etc/letsencrypt/live/api.psfapp.cloud/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/api.psfapp.cloud/privkey.pem;

        # REST API
        location /api/ {
            proxy_pass http://backend:8080;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket (wss://)
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

### 2-3. `docker-compose.yml`

> `<ECR_URI>` 부분은 실제 ECR URI로 교체한다. (생성한 ECR 리포지터리에서 확인)

```yaml
services:
  # ── Nginx 컨테이너 ──────────────────────────────────────────
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro       # Let's Encrypt 인증서 공유
      - /var/www/certbot:/var/www/certbot:ro        # ACME 챌린지 경로 공유
    depends_on:
      - backend
    restart: always

  # ── Spring Boot 컨테이너 ────────────────────────────────────
  backend:
    image: 123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/psf-backend:latest
    expose:
      - "8080"          # 외부 직접 접근 차단, Nginx 컨테이너에서만 접근 가능
    env_file:
      - .env.production # 환경변수 파일 로드
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m" # 로그 파일당 최대 10MB
        max-file: "3"   # 최대 3개 파일 보관
```

### 2-4. `.env.production`

> ⚠️ 이 파일은 절대 Git에 올리지 말아야 한다. `.gitignore`에 반드시 등록할 것.

```bash
# Spring 프로파일
SPRING_PROFILES_ACTIVE=prod

# AWS RDS 접속 정보
DB_URL=your-rds-endpoint.ap-northeast-2.rds.amazonaws.com
DB_USERNAME=postgres
DB_PASSWORD=your-password

# JWT 시크릿
JWT_SECRET=YourJwtSecretKey
```

### 2-5. `.gitignore`에 추가

```
### Secrets ###
.env
.env.production          ← 이 줄 추가
```

---

# 3. Docker Desktop으로 이미지 빌드

> ⚠️ **Apple Silicon(M1/M2/M3) Mac 사용자 필수**: EC2는 x86_64(AMD64) 아키텍처다.
> 플랫폼을 명시하지 않으면 ARM64 이미지가 빌드되어 EC2에서 실행되지 않는다.
> 반드시 `--platform linux/amd64`를 지정해야 한다.

로컬 터미널에서(로그인 안 되었을 경우 4-1 참고.):
```bash
cd /path/to/PSF_BACKEND

docker buildx build \
  --platform linux/amd64 \
  -t 123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/psf-backend:latest \
  --push \
  .
```

> `--push` 옵션은 빌드 완료 즉시 ECR에 Push할 것. (태그 + Push 두 단계를 한 번에 처리)
> 처음 빌드는 Gradle 의존성 다운로드로 인해 5~10분 소요됨.

**Docker Desktop GUI에서 확인**: Builds 탭 → `PSF_BACKEND` 항목에 ✓ 체크 표시가 나타나면 성공

---

# 4. ECR에 이미지 Push

> Step 3에서 `--push` 옵션을 사용했다면 이미 Push가 완료되었다. (생략 가능)
> 수동으로 Push하는 경우 아래 명령어를 사용한다. (실제 ECR URI로 변경해서)

### 4-1. ECR 로그인 
```bash
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.ap-northeast-2.amazonaws.com
```
→ `Login Succeeded` 출력되면 성공

### 4-2. 이미지 태그 (buildx --push 사용 시 불필요)
```bash
docker tag psf-backend:latest \
  123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/psf-backend:latest
```

### 4-3. Push (buildx --push 사용 시 불필요)
```bash
docker push 123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/psf-backend:latest
```

**AWS 콘솔에서 확인**: ECR → psf-backend 리포지토리 → 이미지 목록에 `latest` 태그가 보이면 성공

---

# 5. EC2 Docker 설치

EC2에 SSH로 접속한다:
```bash
ssh -i ~/path/to/key.pem ec2-user@[EC2_PUBLIC_IP]
```

아래 명령어를 **순서대로** 실행한다:

```bash
# 패키지 업데이트
sudo yum update -y

# Docker 설치
sudo yum install -y docker

# Docker 서비스 시작 + 부팅 시 자동 시작 등록
sudo systemctl start docker && sudo systemctl enable docker

# ec2-user를 docker 그룹에 추가 (sudo 없이 docker 명령어 사용 가능)
sudo usermod -aG docker ec2-user

# Docker Compose 설치
sudo curl -L \
  "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 설치 확인
docker --version && docker-compose --version
```

출력 예시:
```
Docker version 25.0.14, build 0bab007
Docker Compose version v2.x.x
```

---

# 6. EC2에 파일 업로드

EC2에 작업 디렉토리를 생성. (EC2 터미널에서):
```bash
mkdir -p ~/psf
```

**새 터미널 탭**을 열고 (로컬 Mac에서) 파일 3개를 업로드:
```bash
scp -i ~/path/to/key.pem \
  /path/to/PSF_BACKEND/docker-compose.yml \
  /path/to/PSF_BACKEND/nginx.conf \
  /path/to/PSF_BACKEND/.env.production \
  ec2-user@[EC2_PUBLIC_IP]:~/psf/
```

업로드 확인 (EC2 터미널에서):
```bash
ls ~/psf/
# 출력: docker-compose.yml  nginx.conf  .env.production
```

---

# 7. 기존 프로세스 종료

> ⚠️ 이 시점부터 서비스가 잠시 중단된다. (1~2분)

### 7-1. 기존 Spring Boot 프로세스 종료
```bash
sudo kill -9 $(pgrep -f 'java.*psf')
```
→ 아무 출력 없이 프롬프트가 돌아오면 성공

### 7-2. 기존 시스템 Nginx 종료 및 자동 시작 비활성화
```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

### 7-3. 포트 점유 확인
```bash
sudo ss -tlnp | grep -E '80|443'
```

아무것도 출력되지 않아야 한다. 만약 여전히 nginx 프로세스가 보이면 PID를 직접 종료:
```bash
# 예시: PID가 436504, 436505, 436506인 경우
sudo kill -9 436504 436505 436506
```

다시 확인:
```bash
sudo ss -tlnp | grep -E '80|443'
# 아무것도 출력되지 않아야 함
```

---

# 8. docker-compose 실행 및 검증

### 8-1. ECR 로그인 (EC2에서)
```bash
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.ap-northeast-2.amazonaws.com
```
→ `Login Succeeded` 출력되면 성공

> EC2에 IAM 역할이 연결되어 있으면 별도 자격 증명 없이 자동으로 인증된다.

### 8-2. docker-compose 실행
```bash
cd ~/psf
docker-compose up -d
```

출력 예시:
```
[+] Running 2/2
 ✔ Container psf-backend-1  Started
 ✔ Container psf-nginx-1    Started
```

### 8-3. 컨테이너 상태 확인
```bash
docker-compose ps
```

출력 예시:
```
NAME            IMAGE                            STATUS          PORTS
psf-backend-1   .../psf-backend:latest           Up 2 minutes    8080/tcp
psf-nginx-1     nginx:alpine                     Up 2 minutes    0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

### 8-4. Spring Boot 로그 확인 (DB 연결 확인)
```bash
docker-compose logs backend --tail=30
```

확인해야 할 로그:
```
HikariPool-1 - Start completed.          ← DB 연결 성공
Tomcat started on port 8080              ← 서버 시작 성공
Started PsfBackendApplication            ← 앱 기동 완료
```

### 8-5. API 동작 확인
```bash
curl https://api.psfapp.cloud/api/auth/hash?pw=1234
```
→ `$2a$10$...` 형태의 BCrypt 해시가 반환되면 완벽하게 성공

- 8-5와 같은 경우는 api 직접 접속을 허용하지 않았다면 차라리 직접 도메인에 접속하여 테스트해도 될 것 같다.

---

# 9. Certbot 자동 갱신 cron 업데이트

기존 cron이 `systemctl restart nginx`를 쓰도록 되어있었으므로, Nginx가 Docker 컨테이너로 바뀌었으므로 명령어를 업데이트해야 한다:

```bash
echo "0 12 * * * root certbot renew --quiet && docker-compose -f /home/ec2-user/psf/docker-compose.yml restart nginx" \
  | sudo tee /etc/cron.d/certbot-renew
```

---

# 10. 이후 배포 방법 (업데이트 시)

코드를 수정하고 새 버전을 배포할 때의 순서.

### 로컬 Mac에서:
```bash
cd /path/to/PSF_BACKEND

# AMD64 플랫폼으로 빌드 + ECR Push (한 번에)
docker buildx build \
  --platform linux/amd64 \
  -t 123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/psf-backend:latest \
  --push \
  .
```

### EC2에서:
```bash
cd ~/psf

# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.ap-northeast-2.amazonaws.com

# 새 이미지 Pull
docker-compose pull backend

# 백엔드 컨테이너만 교체 (Nginx는 계속 실행 유지 → 서비스 중단 없음)
docker-compose up -d --no-deps backend

# Nginx 재시작 (컨테이너 교체 시 IP 캐시 초기화)
docker-compose restart nginx
```

## 자주 사용하는 명령어

```bash
# 컨테이너 상태 확인
docker-compose ps

# 실시간 로그 보기 (Ctrl+C로 종료)
docker-compose logs -f backend
docker-compose logs -f nginx

# 컨테이너 재시작
docker-compose restart

# 컨테이너 중지
docker-compose down

# 컨테이너 중지 + 이미지까지 삭제
docker-compose down --rmi all
```

---

# 11. 요약 및 남은 진행상황

```text
[로컬 개발 PC (Mac)]
├─ 도커 환경 구축: Docker Desktop 설치 및 AWS CLI 로그인
├─ 설정 파일 작성: Dockerfile, nginx.conf, docker-compose.yml 생성
└─ 이미지 빌드 & Push
→ docker buildx build --platform linux/amd64 (EC2 호환용 빌드)
→ docker push (생성된 이미지를 AWS ECR에 업로드)
│
▼
[EC2 서버 환경 설정 (수동)]
회원님 PC (Terminal)
→ ssh -i psf-key.pem (EC2 접속)
→ sudo yum install docker (도커 설치 및 실행)
→ sudo curl (Docker Compose 설치)
→ scp -i psf-key.pem (docker-compose.yml, nginx.conf 등 핵심 설정파일 전송)
│
▼
[기존 서비스 중단 및 전환]
EC2 터미널 (SSH)
→ pkill -9 java (기존 수동 실행 중인 JAR 프로세스 종료)
→ sudo systemctl stop nginx (기존 시스템 설치형 Nginx 중단)
→ aws ecr get-login-password (EC2 서버에서 ECR 로그인)
│
▼
[도커 기반 서비스 기동]
EC2 터미널 (SSH)
→ docker-compose up -d (백엔드 & Nginx 컨테이너 동시 실행)
→ docker-compose logs -f (실시간 로그 확인 및 DB 연결 검증)
→ echo "... docker-compose restart nginx" | sudo tee (인증서 갱신용 크론탭 업데이트)

[결과]
- 백엔드 관리: 이제 파일 전송(SCP) 대신 '도커 이미지' 단위로 배포
- 인프라 격리: Nginx와 Spring Boot가 각각 독립된 컨테이너로 실행
- 무중단 배포 기반: docker-compose up -d --no-deps backend 명령으로 업데이트 가능
```

- 이제 기존의 단순 파일 전송 방식의 배포에서 컨테이너 기반 인프라로 전환되었다. 
- 다음 문서에서는 깃헙 액션을 적용하여 배포를 자동화해보자.