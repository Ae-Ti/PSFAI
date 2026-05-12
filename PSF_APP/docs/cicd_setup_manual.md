# PSF 프로젝트 GitHub Actions CI/CD 자동 배포 매뉴얼

> **목표**: `git push origin main` 한 번으로 프론트엔드(S3+CloudFront)와 백엔드(ECR+EC2)가 자동으로 배포되도록 설정합니다.
>
> **전제 조건**: Docker 기반 배포가 EC2에서 이미 작동 중인 상태 (`docker-compose`로 nginx + backend 컨테이너 실행 중)

---

## 목차

1. [전체 아키텍처 이해](#1-전체-아키텍처-이해)
2. [보안 사전 점검 — 시크릿 파일 필터링](#2-보안-사전-점검--시크릿-파일-필터링)
3. [Git 히스토리에 노출된 시크릿 제거 (선택)](#3-git-히스토리에-노출된-시크릿-제거-선택)
4. [AWS 준비: EC2 IAM 역할 설정](#4-aws-준비-ec2-iam-역할-설정)
5. [AWS 준비: GitHub Actions용 IAM 사용자 생성](#5-aws-준비-github-actions용-iam-사용자-생성)
6. [GitHub Secrets 등록](#6-github-secrets-등록)
7. [GitHub Actions 워크플로우 파일 작성](#7-github-actions-워크플로우-파일-작성)
8. [워크플로우 Push 및 첫 자동 배포 확인](#8-워크플로우-push-및-첫-자동-배포-확인)
9. [앞으로의 배포 방법](#9-앞으로의-배포-방법)
10. [트러블슈팅 모음](#10-트러블슈팅-모음)

---

## 1. 전체 아키텍처 이해

```
[로컬 개발]
  git push origin main
       │
       ▼
[GitHub Repository]
  ├─ PSF_APP/** 변경 감지  →  Deploy Frontend 워크플로우 실행
  └─ PSF_BACKEND/** 변경 감지  →  Deploy Backend 워크플로우 실행

[Deploy Frontend 파이프라인]
  GitHub Actions Runner
  → npm ci + npm run build (VITE 환경변수 주입)
  → aws s3 sync (S3 버킷에 업로드)
  → aws cloudfront create-invalidation (캐시 초기화)

[Deploy Backend 파이프라인]
  GitHub Actions Runner
  → docker build --platform linux/amd64 (x86_64 이미지 빌드)
  → docker push (ECR에 이미지 업로드)
  → aws ssm send-command (EC2에 명령 전달 — SSH 불필요!)
       └─ EC2: docker-compose pull backend
       └─ EC2: docker-compose up -d --no-deps backend
       └─ EC2: docker-compose restart nginx
```

**핵심 설계 원칙**
- `paths` 필터를 통해 변경된 영역만 배포 (불필요한 빌드 방지)
- EC2에 SSH 포트(22)를 열지 않고 **AWS SSM**으로 안전하게 원격 명령 실행
- 민감 정보(API 키, 비밀번호)는 모두 **GitHub Secrets**에 저장하고 코드에는 포함하지 않음

---

## 2. 보안 사전 점검 — 시크릿 파일 필터링

GitHub에 올리기 전 `.gitignore`에 민감한 파일들이 등록되어 있는지 반드시 확인합니다.

### 루트 `.gitignore` 확인 사항
```gitignore
# 환경변수 파일
**/.env
**/.env.production
**/.env.local
**/.env.*.local

# 인증서 및 키 파일
*.pem
*.key
*.p12
*.jks
```

### 백엔드 `.gitignore` 확인 사항
```gitignore
# 빌드 산출물
build/
.gradle/

# 환경변수
.env
.env.production

# 로컬 설정 (DB 접속 정보 포함)
src/main/resources/application-local.yml

# 컴파일 파일 및 로그
*.class
*.log
```

### 프론트엔드 `.gitignore` 확인 사항
```gitignore
node_modules/
dist/
.env.local
.env.production
*.log
```

> ⚠️ **주의**: `application.yml`처럼 실제로 Git에 커밋되는 파일 안에 시크릿 값을 **기본값(default)** 형태로 하드코딩하는 것도 위험합니다.
>
> **위험한 예시** (절대 하지 말 것):
> ```yaml
> jwt:
>   secret: ${JWT_SECRET:ThisIsMyRealSecret123}  # ← ThisIsMyRealSecret123이 Git에 노출됨!
> ```
>
> **올바른 예시**:
> ```yaml
> jwt:
>   secret: ${JWT_SECRET}  # 환경변수만 참조, 기본값 없음
> ```

---

## 3. Git 히스토리에 노출된 시크릿 제거 (선택)

> 이미 시크릿이 커밋된 적 없다면 이 섹션을 건너뜁니다.
> GitHub에서 "Secret scanning alert" 알림 메일을 받았다면 반드시 진행합니다.

### Step 1. 노출된 시크릿(키) 즉시 폐기
노출된 API 키나 비밀번호는 **새 값으로 교체**하는 것이 최우선입니다.
- Gemini API 키: [Google AI Studio](https://aistudio.google.com/app/apikey) → 해당 키 삭제 → 새 키 생성
- JWT Secret: 새 랜덤 문자열 생성: `openssl rand -base64 64`

### Step 2. 코드 파일에서 하드코딩 제거
```yaml
# application.yml 수정
spring:
  ai:
    google:
      genai:
        api-key: "${GEMINI_API_KEY}"  # 기본값 없이 환경변수만 참조

jwt:
  secret: ${JWT_SECRET}  # 기본값 없이 환경변수만 참조
```

### Step 3. git-filter-repo로 히스토리 정리
```bash
# git-filter-repo 설치
pip install git-filter-repo

# 히스토리에서 노출된 값들을 일괄 치환 (여러 값을 한 번에 처리)
git filter-repo --force --replace-text <(printf \
  "노출된_API_키_값==>REMOVED_API_KEY\n노출된_JWT_SECRET_값==>REMOVED_JWT_SECRET\n")
```

> ⚠️ `git filter-repo`는 히스토리를 재작성하므로 remote가 자동으로 제거됩니다.
> 다음 단계에서 remote를 다시 등록해야 합니다.

### Step 4. Remote 재등록 및 강제 Push
```bash
git remote add origin https://github.com/<조직명>/<리포지토리명>.git
git push origin main --force
```

### Step 5. GitHub Secret Scanning 알림 닫기
GitHub 리포지토리 → **Security** 탭 → **Secret scanning** → 해당 알림 클릭
→ 우측 **"Close as"** → **"Revoked"** 선택하여 알림 수동 종료

### Step 6. EC2 `.env.production` 및 로컬 설정 업데이트
```bash
# EC2 접속
ssh -i ~/downloads/psf-key.pem ec2-user@<EC2_IP>
nano ~/psf/.env.production
```
파일에 새 키 추가/수정:
```
GEMINI_API_KEY=새로_발급받은_키
JWT_SECRET=openssl_rand로_생성한_새_시크릿
```
저장 후 **완전 재시작** (restart가 아닌 down/up):
```bash
# ⚠️ docker-compose restart는 env_file 변경을 반영하지 못하는 경우가 있음
# 환경변수 변경 시 반드시 아래 명령어 사용!
cd ~/psf && docker-compose down && docker-compose up -d
```

로컬 개발 환경도 업데이트:
```yaml
# PSF_BACKEND/src/main/resources/application-local.yml (gitignore 처리되어 있음)
spring:
  ai:
    google:
      genai:
        api-key: "새로_발급받은_키"
jwt:
  secret: 새_JWT_SECRET_값
```

---

## 4. AWS 준비: EC2 IAM 역할 설정

GitHub Actions가 SSH 없이 EC2에 명령을 전달하려면 EC2 인스턴스에 SSM 권한이 필요합니다.

### Step 1. EC2 인스턴스에 IAM 역할 연결
1. AWS 콘솔 → **EC2** → 인스턴스 선택
2. **[보안]** 탭 → **IAM 역할** 확인
   - 역할이 없으면: **[작업]** → **[보안]** → **[IAM 역할 수정]** → 새 역할 생성 후 연결

### Step 2. IAM 역할에 정책 추가
해당 역할 클릭 → **[권한 추가]** → 아래 2개 정책 연결:
- `AmazonSSMManagedInstanceCore` — SSM을 통해 원격 명령 수신
- `AmazonEC2ContainerRegistryReadOnly` — ECR에서 Docker 이미지 Pull

### Step 3. EC2의 SSM Agent 동작 확인
```bash
# EC2 SSH 접속 후
sudo systemctl status amazon-ssm-agent
# → "active (running)" 이 출력되면 정상
```

---

## 5. AWS 준비: GitHub Actions용 IAM 사용자 생성

GitHub Actions가 AWS 서비스(ECR, SSM, S3, CloudFront)를 사용할 수 있도록 전용 IAM 사용자를 만듭니다.

### Step 1. IAM 사용자 생성
1. AWS 콘솔 → **IAM** → **사용자** → **사용자 생성**
2. 사용자 이름: `github-actions-psf` (임의 설정 가능)
3. **[다음]** → **권한 설정** → **"정책 직접 연결"** 선택

### Step 2. 아래 4개 정책 연결
| 정책 이름 | 용도 |
|-----------|------|
| `AmazonEC2ContainerRegistryPowerUser` | ECR 이미지 빌드 & Push |
| `AmazonSSMFullAccess` | EC2에 SSM 명령 전달 |
| `AmazonS3FullAccess` | 프론트엔드 S3 업로드 |
| `CloudFrontFullAccess` | CloudFront 캐시 무효화 |

### Step 3. 액세스 키 발급
1. 생성된 사용자 클릭 → **[보안 자격 증명]** 탭
2. **[액세스 키 만들기]** → **"서드 파티 서비스"** 선택 → 생성
3. ✅ **Access Key ID**와 **Secret Access Key**를 안전한 곳에 복사 (창 닫으면 다시 확인 불가!)

---

## 6. GitHub Secrets 등록

GitHub Actions 워크플로우가 참조할 민감 정보들을 GitHub에 안전하게 등록합니다.

1. GitHub 리포지토리 → **[Settings]** → **[Secrets and variables]** → **[Actions]**
2. **[New repository secret]** 버튼을 눌러 아래 5개를 등록합니다.

| Secret 이름 | 값 | 확인 방법 |
|------------|----|---------| 
| `AWS_ACCESS_KEY_ID` | Step 5에서 발급받은 Access Key ID | IAM 사용자 생성 시 복사한 값 |
| `AWS_SECRET_ACCESS_KEY` | Step 5에서 발급받은 Secret Access Key | IAM 사용자 생성 시 복사한 값 |
| `EC2_INSTANCE_ID` | `i-0xxxxxxxxxxxxxxxx` 형태 | EC2 콘솔 인스턴스 목록 또는 아래 명령어 |
| `S3_BUCKET_NAME` | S3 버킷 이름 (예: `<S3_BUCKET_NAME>`) | S3 콘솔 버킷 목록 |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E...` 형태의 짧은 영문+숫자 | CloudFront 콘솔 → 배포 목록 맨 왼쪽 **ID** 열 |

**EC2 인스턴스 ID 확인 명령어:**
```bash
ssh -i ~/downloads/psf-key.pem ec2-user@<EC2_IP> \
  'TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -s) && \
   curl -H "X-aws-ec2-metadata-token: $TOKEN" -s \
    http://169.254.169.254/latest/meta-data/instance-id'
```

> ⚠️ **주의**: CloudFront Distribution ID는 도메인 이름(`d1234abcd.cloudfront.net`)이 아닌, 목록 왼쪽의 **ID 값**(예: `E1A2B3C4XYZ`)입니다.

---

## 7. GitHub Actions 워크플로우 파일 작성

프로젝트 루트에 `.github/workflows/` 디렉토리를 만들고 아래 두 파일을 작성합니다.

```bash
mkdir -p .github/workflows
```

### 7-1. 백엔드 배포: `deploy-backend.yml`

```yaml
name: Deploy Backend

on:
  push:
    branches: [ "main" ]
    paths:
      - 'PSF_BACKEND/**'                            # 백엔드 코드 변경 시에만 실행
      - '.github/workflows/deploy-backend.yml'      # 워크플로우 파일 자체 변경 시도 실행

env:
  AWS_REGION: ap-northeast-2
  ECR_REPOSITORY: psf-backend                       # ECR 리포지토리 이름

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Set up JDK 21
      uses: actions/setup-java@v3
      with:
        java-version: '21'
        distribution: 'corretto'
        cache: 'gradle'

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}

    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v2

    - name: Build and push Docker image
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        IMAGE_TAG: latest
      run: |
        cd PSF_BACKEND
        # ⚠️ Mac(Apple Silicon)에서 빌드 시 --platform linux/amd64 필수
        # EC2는 x86_64 아키텍처이므로 amd64 이미지가 필요함
        docker build --platform linux/amd64 -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG -f Dockerfile .
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

    - name: Deploy to EC2 via SSM
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        INSTANCE_ID: ${{ secrets.EC2_INSTANCE_ID }}
      run: |
        aws ssm send-command \
          --instance-ids "$INSTANCE_ID" \
          --document-name "AWS-RunShellScript" \
          --parameters 'commands=[
            "aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin '"$ECR_REGISTRY"'",
            "cd /home/ec2-user/psf",
            "docker-compose pull backend",
            "docker-compose up -d --no-deps backend",
            "docker-compose restart nginx",
            "docker image prune -f"
          ]' \
          --comment "Deploying backend from GitHub Actions"
```

**SSM 명령어 흐름 설명:**

| 명령어 | 역할 |
|--------|------|
| `docker login` | EC2에서 ECR 인증 |
| `docker-compose pull backend` | 새 이미지 다운로드 |
| `docker-compose up -d --no-deps backend` | 백엔드만 교체 (nginx는 유지) |
| `docker-compose restart nginx` | 백엔드 컨테이너 IP가 바뀌어도 nginx가 새 IP로 연결하도록 재시작 |
| `docker image prune -f` | 사용하지 않는 구 이미지 삭제 (디스크 절약) |

### 7-2. 프론트엔드 배포: `deploy-frontend.yml`

```yaml
name: Deploy Frontend

on:
  push:
    branches: [ "main" ]
    paths:
      - 'PSF_APP/**'                                 # 프론트엔드 코드 변경 시에만 실행
      - '.github/workflows/deploy-frontend.yml'      # 워크플로우 파일 자체 변경 시도 실행

env:
  AWS_REGION: ap-northeast-2

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
        cache-dependency-path: 'PSF_APP/package-lock.json'

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}

    - name: Install Dependencies
      run: |
        cd PSF_APP
        npm ci

    - name: Build Application
      run: |
        cd PSF_APP
        npm run build
      env:
        # 프로덕션 API URL 주입 (빌드 시 번들에 포함됨)
        VITE_API_BASE_URL: https://api.psfapp.cloud/api
        VITE_WS_URL: wss://api.psfapp.cloud/ws

    - name: Deploy to S3
      env:
        S3_BUCKET: ${{ secrets.S3_BUCKET_NAME }}
      run: |
        cd PSF_APP/dist
        aws s3 sync . s3://$S3_BUCKET --delete   # --delete: S3에만 있는 구 파일 삭제

    - name: Invalidate CloudFront Cache
      env:
        DISTRIBUTION_ID: ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }}
      run: |
        aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
```

---

## 8. 워크플로우 Push 및 첫 자동 배포 확인

### Step 1. 워크플로우 파일 커밋 & Push

워크플로우 파일을 Push할 때는 **GitHub Personal Access Token에 `workflow` 권한**이 있어야 합니다.

권한이 없다면:
1. GitHub → **Settings** → **Developer settings** → **Personal access tokens**
2. 기존 토큰 클릭 → **`workflow`** 항목에 체크 추가 → 저장
3. 또는 새 토큰 생성 시 `repo` + `workflow` 체크

```bash
git add .github/workflows/
git commit -m "ci: add github actions workflows for backend and frontend"
git push origin main
```

### Step 2. GitHub Actions 실행 확인
1. GitHub 리포지토리 → **[Actions]** 탭
2. 워크플로우 목록에서 실행 중인 항목 확인
   - 🟡 노란색 원 = 실행 중
   - ✅ 초록색 체크 = 성공
   - ❌ 빨간색 X = 실패 (클릭해서 로그 확인)

### Step 3. 배포 성공 검증
프론트엔드와 백엔드 모두 초록색 체크가 뜨면 실제 서비스에서 확인:
```bash
# 백엔드 헬스 체크
curl https://api.psfapp.cloud/api/health

# 챗봇 API 테스트 (로그인 후 토큰 사용)
TOKEN=$(curl -s -X POST https://api.psfapp.cloud/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user1","password":"1234"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

curl -s -X POST https://api.psfapp.cloud/api/chatbot/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"안녕하세요"}'
```

---

## 9. 앞으로의 배포 방법

### 일반 코드 변경 배포 (자동)

```bash
# 코드 수정 후 아래 3줄이 전부!
git add .
git commit -m "feat: 변경 내용 설명"
git push origin main
```

수정된 파일 위치에 따라 자동으로 올바른 워크플로우가 실행됩니다.

| 수정 위치 | 실행 워크플로우 | 소요 시간 |
|-----------|----------------|----------|
| `PSF_BACKEND/**` | Deploy Backend | ~2분 |
| `PSF_APP/**` | Deploy Frontend | ~30초 |
| 둘 다 수정 | 두 워크플로우 **동시** 실행 | 각각 병렬 진행 |

### 환경변수 변경 시 (수동)

`.env.production` 파일은 Git에 포함되지 않으므로 EC2에 직접 접속해서 변경해야 합니다.

```bash
# 1. EC2 접속
ssh -i ~/downloads/psf-key.pem ec2-user@<EC2_PUBLIC_IP>

# 2. 환경변수 파일 수정
cd ~/psf
nano .env.production

# 3. ⚠️ 반드시 'down && up' 사용 (restart는 env_file 변경을 반영하지 못할 수 있음)
docker-compose down && docker-compose up -d
```

---

## 10. 트러블슈팅 모음

### ❌ Push 실패: "refusing to allow... without `workflow` scope"

```
remote rejected: refusing to allow a Personal Access Token to create
or update workflow without `workflow` scope
```

**원인**: Git에 등록된 GitHub 토큰에 `workflow` 권한이 없음  
**해결**: GitHub → Developer settings → Personal access tokens → 해당 토큰 클릭 → `workflow` 체크 → Update

---

### ❌ 프론트 배포 실패: "NoSuchDistribution"

```
Error: aws: [ERROR]: An error occurred (NoSuchDistribution) when calling
the CreateInvalidation operation: The specified distribution does not exist.
```

**원인**: `CLOUDFRONT_DISTRIBUTION_ID` 시크릿 값이 잘못됨  
**해결**: CloudFront 콘솔 → 배포 목록 → **ID** 열의 값(예: `E1A2B3XYZ`)을 확인 후 시크릿 수정  
(도메인 이름 `d1234.cloudfront.net`이 아닌 짧은 ID 문자열임에 주의)

---

### ❌ 챗봇 오류: "API key expired"

```
Caused by: ClientException: 400. API key expired. Please renew the API key.
```

**원인**: EC2 컨테이너가 폐기된 이전 API 키를 사용 중  
**해결 순서**:
1. `.env.production`에 새 API 키가 제대로 들어갔는지 확인
2. `docker-compose restart`가 아닌 **`down && up`** 으로 완전 재시작:
   ```bash
   cd ~/psf && docker-compose down && docker-compose up -d
   ```
3. 컨테이너 내부 환경변수 확인:
   ```bash
   docker exec psf-backend-1 env | grep GEMINI
   ```

---

### ❌ SSM 명령이 EC2에 전달되지 않음

**원인 체크리스트**:
1. EC2에 IAM 역할이 연결되어 있는가?
2. 역할에 `AmazonSSMManagedInstanceCore` 정책이 있는가?
3. EC2에서 `amazon-ssm-agent`가 실행 중인가?
   ```bash
   sudo systemctl status amazon-ssm-agent
   ```
4. `EC2_INSTANCE_ID` 시크릿 값이 올바른가? (`i-0xxxxxxxxxxxxxxxx` 형태)

---

### ❌ git filter-repo 실행 시 "Refusing to destructively overwrite"

```
Aborting: Refusing to destructively overwrite repo history since
this does not look like a fresh clone.
```

**해결**: `--force` 옵션 추가
```bash
git filter-repo --force --replace-text <(printf "노출된값==>REMOVED\n")
```

> ⚠️ 실행 후 remote가 제거되므로 `git remote add origin <URL>` 후 `git push --force` 필요

---

*최초 작성일: 2026-05-12*
*적용 프로젝트: PSF (부산 포럼 앱)*
*관련 파일: `.github/workflows/deploy-backend.yml`, `.github/workflows/deploy-frontend.yml`*
