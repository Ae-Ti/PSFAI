# 프론트엔드 커스텀 도메인 연결 매뉴얼
## (S3 + CloudFront + Route 53 + ACM + 가비아)

> **목표**: `https://psfapp.cloud` (또는 `https://www.psfapp.cloud`)로 접속 시 S3에 올라간 React 앱이 뜨도록 설정한다.

---

## ⚠️ 핵심 원칙 (먼저 읽기)

작업 순서가 매우 중요합니다. 아래 순서를 **절대 바꾸지 마세요**.

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

---

## Step 1. Route 53 호스팅 영역 생성

1. AWS 콘솔 검색창에 **Route 53** 입력 후 접속
2. 왼쪽 메뉴 **[호스팅 영역]** > **[호스팅 영역 생성]** 클릭
3. 입력:
   - **도메인 이름**: `psfapp.cloud` (본인 도메인)
   - **유형**: 퍼블릭 호스팅 영역
4. **[호스팅 영역 생성]** 클릭

생성 후 레코드 목록에 **NS**, **SOA** 두 개가 자동으로 생깁니다.

---

## Step 2. 가비아 네임서버 변경

> 이 단계가 없으면 이후의 모든 DNS 설정이 아무런 의미가 없습니다.

1. Route 53에서 방금 만든 `psfapp.cloud` 호스팅 영역 클릭
2. **NS 레코드**의 값(우측)에 있는 **4개 주소**를 메모합니다:
   ```
   ns-xxxx.awsdns-xx.com.
   ns-xxxx.awsdns-xx.org.
   ns-xxxx.awsdns-xx.net.
   ns-xxxx.awsdns-xx.co.uk.
   ```
   > ⚠️ 각 주소 끝의 마침표(`.`)는 가비아 입력 시 제거하세요.

3. **가비아 홈페이지** 로그인
4. **My 가비아** > **도메인 관리** > `psfapp.cloud` 선택
5. **[네임서버 설정]** 클릭
6. 1차~4차 네임서버에 위의 4개 주소를 하나씩 입력 후 저장

> ⏳ 변경 후 최대 1~2시간 전파 시간이 필요합니다. 전파 전에도 이후 Step은 미리 진행할 수 있습니다.

---

## Step 3. ACM SSL 인증서 발급

> 🚨 **반드시 `us-east-1 (미국 동부 버지니아 북부)` 리전에서 진행해야 합니다!**
> CloudFront는 이 리전의 인증서만 인식합니다.

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

---

## Step 4. ACM 인증서 DNS 검증

1. 방금 요청한 인증서의 ID를 클릭하여 상세 페이지로 이동
2. 상태가 **'검증 대기 중'** 으로 표시됨
3. **[Route 53에서 레코드 생성]** 버튼 클릭
4. 체크박스 선택 후 **[레코드 생성]** 클릭
   > ✅ 이 버튼이 활성화되려면 Step 1의 Route 53 호스팅 영역이 먼저 있어야 합니다!
5. 약 1~5분 후 인증서 상태가 **'발급됨(Issued)'** 으로 변경됨

> ⏳ '발급됨'이 될 때까지 다음 단계를 진행하지 마세요.

---

## Step 5. CloudFront 대체 도메인 + 인증서 등록

1. AWS 콘솔 검색창에 **CloudFront** 입력 후 접속
2. 연결할 배포(Distribution) ID 클릭
3. **[일반(General)]** 탭 > 우측 상단 **[편집(Edit)]** 클릭
4. **대체 도메인 이름(CNAME)** 에 도메인 추가:
   - `psfapp.cloud`
   - `www.psfapp.cloud` (www도 원한다면)
5. **사용자 정의 SSL 인증서** 드롭다운에서 Step 3~4에서 **발급받은 인증서** 선택
   > ⚠️ 인증서 상태가 '발급됨'이 아니면 이 드롭다운에 표시되지 않습니다.
6. **[변경 사항 저장]** 클릭
7. 배포 상태가 **'배포 중(Deploying)'** → **'배포됨(Deployed)'** 이 될 때까지 대기 (1~3분)

---

## Step 6. Route 53 레코드 생성

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

---

## Step 7. 최종 확인

| 테스트 URL | 예상 결과 |
|-----------|-----------|
| `https://psfapp.cloud` | ✅ React 앱 화면 표시 |
| `https://www.psfapp.cloud` | ✅ React 앱 화면 표시 (Step 6-2 했을 경우) |
| `http://psfapp.cloud` | ✅ 자동으로 https로 리다이렉트 |

---

## 최종 Route 53 레코드 완성 목록

| 이름 | 유형 | 값 | 용도 |
|------|------|----|------|
| `psfapp.cloud` | NS | AWS 네임서버 4개 | 가비아에 입력한 값 |
| `psfapp.cloud` | SOA | (자동 생성) | 도메인 권한 정보 |
| `_62f95b....psfapp.cloud` | CNAME | `_cfbc71fb....acm-validations.aws.` | ACM 인증서 검증용 |
| `psfapp.cloud` | A (별칭) | CloudFront 주소 | 프론트엔드 루트 도메인 |
| `www.psfapp.cloud` | A (별칭) | CloudFront 주소 | www 서브도메인 |
| `api.psfapp.cloud` | A | `<EC2_PUBLIC_IP>` | 백엔드 EC2 서버 |

---

## 자주 겪는 문제 (Troubleshooting)

| 증상 | 원인 | 해결 |
|------|------|------|
| ACM [레코드 생성] 버튼 비활성화 | Route 53 호스팅 영역이 없음 | Step 1 먼저 수행 |
| CloudFront에서 인증서가 안 보임 | 인증서가 아직 '검증 대기 중' 또는 리전이 us-east-1이 아님 | Step 4까지 완료 후 재시도 |
| Route 53 CloudFront 배포 목록 비어있음 | CloudFront에 대체 도메인이 미등록 | Step 5 먼저 수행 |
| DBeaver 연결 타임아웃 | IP 주소 변경으로 보안 그룹 규칙 만료 | RDS 보안 그룹에서 '내 IP'로 다시 갱신 |
| `api.psfapp.cloud` 갑자기 안 됨 | 가비아→Route 53 네임서버 변경 후 Route 53에 레코드 미등록 | Route 53에 `api` A 레코드 추가 |
