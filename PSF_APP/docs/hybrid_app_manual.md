# PSF 하이브리드 앱 전환 매뉴얼 (Phase 6)

> **목적**: React 웹 앱을 Capacitor를 이용해 iOS/Android 네이티브 앱으로 전환하는 전 과정을 기록한 매뉴얼입니다.
> 처음 보는 사람도, 나중에 까먹은 경우도 이 문서 하나로 처음부터 끝까지 따라할 수 있도록 작성되었습니다.

---

## 목차
1. [사전 준비 및 환경 설정](#1-사전-준비-및-환경-설정)
2. [Capacitor 설치 및 초기 설정](#2-capacitor-설치-및-초기-설정)
3. [iOS 프로젝트 생성 및 빌드](#3-ios-프로젝트-생성-및-빌드)
4. [핵심 설정: capacitor.config.json](#4-핵심-설정-capacitorconfigjson)
5. [네이버 지도 API 연동 문제 해결](#5-네이버-지도-api-연동-문제-해결)
6. [GPS(위치) 플러그인 연동](#6-gps위치-플러그인-연동)
7. [웹/앱 환경 분기 처리](#7-웹앱-환경-분기-처리)
8. [실기기 테스트 방법 (iOS)](#8-실기기-테스트-방법-ios)
9. [코드 수정 후 앱 업데이트 절차](#9-코드-수정-후-앱-업데이트-절차)
10. [알려진 이슈 및 FAQ](#10-알려진-이슈-및-faq)

---

## 1. 사전 준비 및 환경 설정

### 필수 설치 목록
| 도구 | 설치 방법 | 확인 명령어 |
|------|-----------|-------------|
| Node.js 18+ | [nodejs.org](https://nodejs.org) | `node --version` |
| Xcode 최신버전 | Mac App Store | `xcodebuild -version` |
| CocoaPods | `sudo gem install cocoapods` | `pod --version` |
| Capacitor CLI | 프로젝트 내 설치 (아래 참고) | `npx cap --version` |

### 맥북 Xcode 최초 설정
```bash
# Xcode Command Line Tools 설치 (최초 1회)
xcode-select --install

# 라이선스 동의
sudo xcodebuild -license accept
```

---

## 2. Capacitor 설치 및 초기 설정

### 패키지 설치
```bash
cd PSF_APP

# Capacitor 핵심 패키지 설치
npm install @capacitor/core @capacitor/cli

# GPS(위치) 플러그인 설치
npm install @capacitor/geolocation

# iOS 플랫폼 패키지 설치
npm install @capacitor/ios
```

### Capacitor 초기화 (최초 1회)
```bash
# 프로젝트 초기화 (appId는 com.회사명.앱이름 형태)
npx cap init "PSF Forum" "cloud.psfapp.app" --web-dir dist
```

### iOS 플랫폼 추가 (최초 1회)
```bash
# 먼저 웹앱 빌드가 되어 있어야 함
npm run build

# iOS 네이티브 프로젝트 생성
npx cap add ios
```

> ⚠️ `npx cap add ios` 실행 후 `ios/` 폴더가 생성됨. 이 폴더는 Git에 커밋해도 무방하지만 Xcode 빌드 캐시(`ios/App/build/`)는 `.gitignore`에 추가 권장.

---

## 3. iOS 프로젝트 생성 및 빌드

### Xcode에서 열기
```bash
# 터미널에서 실행하면 Xcode가 자동으로 열림
npx cap open ios
```

### Xcode Signing 설정 (최초 1회)
개인 Apple ID로 무료 배포(개인 기기 설치)가 가능하도록 설정합니다.

1. Xcode 왼쪽 파일 트리에서 파란색 **App** 아이콘 클릭
2. 중앙 화면 **Signing & Capabilities** 탭 클릭
3. **Team** 항목 클릭 → **Add an Account...** → Apple ID로 로그인
4. Team을 본인 이름(Personal Team)으로 선택
5. Bundle Identifier가 `cloud.psfapp.app`인지 확인

### 빌드 및 실행
- **에뮬레이터(시뮬레이터)**: 상단 기기 선택 드롭다운에서 `iPhone 17` 등 선택 후 ▶ 버튼
- **실기기**: 기기를 케이블로 연결 후 드롭다운에서 실제 기기 이름 선택 후 ▶ 버튼

---

## 4. 핵심 설정: capacitor.config.json

이 파일이 하이브리드 앱의 동작 방식을 결정하는 가장 중요한 설정 파일입니다.

### 현재 적용 중인 설정 (프로덕션 권장)
```json
{
  "appId": "cloud.psfapp.app",
  "appName": "PSF Forum",
  "webDir": "dist",
  "server": {
    "url": "https://psfapp.cloud",
    "androidScheme": "https"
  },
  "plugins": {
    "Geolocation": {
      "permissions": ["location"]
    }
  }
}
```

### server.url 설정의 의미와 중요성

| server.url 설정 | 동작 방식 | 네이버 지도 | GPS |
|----------------|-----------|------------|-----|
| **없음 (기본값)** | 앱 내부 파일(`capacitor://localhost`) 사용 | ❌ 500 에러 (네이버 정책) | ✅ 정상 |
| **`https://psfapp.cloud`** | AWS 실서버 실시간 연동 | ✅ 정상 | ✅ 정상 |

> **왜 server.url이 필수인가?**
> 네이버 지도 API는 보안 정책상 `capacitor://` 프로토콜을 비정상 접근으로 간주하여 HTTP 500 에러를 반환합니다. AWS에 배포된 실서버 도메인(`https://`)을 바라보게 설정하면 이 문제가 완전히 해결됩니다.

### 개발 중 로컬 테스트가 필요할 때 (임시 설정)
```json
{
  "server": {
    "url": "http://192.168.x.x:5173",
    "cleartext": true
  }
}
```
> ⚠️ 위 설정은 테스트 후 반드시 원래대로 복구하세요. 로컬 IP는 `npm run dev -- --host` 실행 후 터미널에 표시되는 `Network: http://...` 주소를 사용합니다.

---

## 5. 네이버 지도 API 연동 문제 해결

### 문제 증상
```
Error Code / Error Message: 500 / Internal Server Error
URI: capacitor://localhost
```

### 원인 분석
네이버 클라우드 플랫폼의 Web Dynamic Map API는 HTTP/HTTPS 요청만 정상 처리합니다.
Capacitor 기본 설정(`capacitor://localhost`)은 네이버 서버가 인식하지 못해 500 에러를 반환합니다.

### 해결책: server.url 설정 (위 4번 섹션 참고)
```bash
# 설정 변경 후 반드시 sync 실행
npx cap sync ios
```

### 네이버 클라우드 콘솔 등록 필요 항목
[네이버 클라우드 플랫폼](https://www.ncloud.com/) → Application → 인증 정보 → **Web 서비스 URL** 에 아래 주소들을 등록:
- `https://psfapp.cloud` (프로덕션)
- `http://localhost:5173` (로컬 개발, 필요시)

### GpsPage.jsx 지도 렌더링 안정화 코드
지도 초기화 시 예외 처리 및 메모리 누수 방지를 위해 아래 패턴을 사용합니다:

```jsx
// 컴포넌트 언마운트 시 지도 객체 정리 (메모리 누수 방지)
return () => {
    window.initNaverMap = null;
    if (mapRef.current) {
        if (typeof mapRef.current.destroy === 'function') {
            mapRef.current.destroy();
        }
        mapRef.current = null;
    }
    if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
    }
};
```

---

## 6. GPS(위치) 플러그인 연동

### Info.plist 권한 설정 (iOS 필수)
Xcode에서 `Info.plist` 파일에 위치 권한 메시지를 추가해야 합니다.
`ios/App/App/Info.plist` 파일을 열고 아래 항목을 추가하거나, Xcode GUI에서 추가:

| Key | Value |
|-----|-------|
| `NSLocationWhenInUseUsageDescription` | `현재 위치를 의전팀에 전달하기 위해 위치 정보가 필요합니다.` |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | `백그라운드에서도 위치를 전송하기 위해 항상 위치 접근이 필요합니다.` |

### Geolocation 플러그인 코드 사용법
```jsx
import { Geolocation } from '@capacitor/geolocation'

// 권한 요청 (iOS에서 팝업이 뜸)
await Geolocation.requestPermissions();

// 현재 위치 가져오기
const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 60000
});

const { latitude, longitude } = pos.coords;
```

---

## 7. 웹/앱 환경 분기 처리

### 문제
`@capacitor/geolocation`은 iOS/Android 네이티브 앱 전용 플러그인입니다.
PC 웹 브라우저에서 접속하면 `Not implemented on web.` 에러가 발생합니다.

### 해결책: 자동 Fallback 로직
```jsx
const getPosition = async () => {
    try {
        // 1순위: Capacitor 네이티브 GPS (iOS/Android 앱)
        await Geolocation.requestPermissions();
        const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 60000
        });
        return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch (capErr) {
        // 2순위: 브라우저 내장 GPS API (PC/모바일 웹)
        if (capErr.message?.includes('Not implemented')) {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('GPS를 지원하지 않는 브라우저입니다.'));
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude
                    }),
                    reject,
                    { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
                );
            });
        }
        throw capErr;
    }
};
```

이 패턴을 `GpsPage.jsx`와 `AppContext.jsx`의 GPS 관련 로직 전체에 동일하게 적용합니다.

---

## 8. 실기기 테스트 방법 (iOS)

### 준비물
- 맥북(Mac)
- 아이폰 또는 아이패드
- Lightning/USB-C 케이블
- Apple ID (유료 개발자 계정 불필요)

### Step 1: 기기 연결 및 신뢰 설정
1. 케이블로 기기와 맥북을 연결합니다.
2. 아이폰/아이패드 화면에 **"이 컴퓨터를 신뢰하겠습니까?"** 팝업이 뜨면 **[신뢰]** 를 누릅니다.
3. 아이폰/아이패드 잠금 해제 비밀번호를 입력합니다.

### Step 2: 개발자 모드 활성화 (iOS 16 이상 필수)
1. 아이폰/아이패드 **[설정]** 앱 열기
2. **[개인정보 보호 및 보안]** 메뉴 진입
3. 맨 아래 **[개발자 모드]** 클릭
4. 스위치를 켜고 기기를 **재시작**
5. 재시작 후 팝업에서 **[켜기]** 클릭

### Step 3: Xcode에서 실기기 선택
1. `npx cap open ios` 또는 Xcode에서 프로젝트 열기
2. Xcode 상단 중앙 기기 드롭다운 클릭
3. **[iOS Devices]** 섹션에서 연결된 기기 이름 선택
   - `pairing is in progress` → 기기 화면을 켜두고 1~2분 대기 또는 케이블 재연결
4. **▶ (재생) 버튼** 클릭 → 빌드 및 설치 시작

### Step 4: 기기에서 앱 신뢰 처리 (최초 1회)
앱을 처음 설치한 후 기기에서 앱 아이콘을 눌렀을 때 "신뢰하지 않는 개발자" 팝업이 뜹니다.

1. **[설정]** → **[일반]** → **[VPN 및 기기 관리]** 이동
2. **[개발자 앱]** 섹션에서 본인 Apple ID 클릭
3. 파란 글씨 **[{Apple ID} 신뢰]** 클릭
4. 확인 팝업에서 **[신뢰]** 클릭
5. 홈 화면으로 나가서 앱 아이콘을 다시 누르면 정상 실행

---

## 9. 코드 수정 후 앱 업데이트 절차

### 매번 코드를 수정할 때마다 해야 하는 작업 순서

```bash
# PSF_APP 디렉토리에서 실행

# Step 1: 웹 앱 빌드 (React → dist/ 폴더)
npm run build

# Step 2: iOS 네이티브 프로젝트에 웹 에셋 동기화
npx cap sync ios

# Step 3: Xcode에서 ▶ 버튼 눌러 재빌드 및 설치
# (또는 이미 Xcode가 열려있다면 Cmd+R)
```

> 💡 **팁**: `server.url`에 AWS 실서버 주소를 설정한 경우, 프론트엔드를 AWS에 새로 배포하면 Xcode 재빌드 없이도 앱에서 변경 사항이 자동 반영됩니다!
> 이는 하이브리드 앱의 가장 큰 장점으로, 앱스토어 심사 없이 실시간 업데이트가 가능합니다.

### Xcode DerivedData(빌드 캐시) 초기화 (문제 발생 시)
설정을 바꾸었는데도 이전 설정이 계속 적용되는 경우 캐시를 초기화합니다.

**방법 1 (Xcode 내)**
- 단축키: `Cmd(⌘) + Shift(⇧) + K` → "Clean Build Folder"

**방법 2 (터미널)**
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

캐시 초기화 후 첫 빌드는 Swift 패키지를 새로 다운로드하므로 **2~5분** 정도 시간이 걸립니다.

---

## 10. 알려진 이슈 및 FAQ

### ❓ 시뮬레이터에서 이모지(이모티콘)가 `[?]`로 깨져 보여요.
- **원인**: 설치된 iOS 26.3 시뮬레이터 런타임 내부에 `AppleColorEmoji.ttc` 폰트 파일이 누락된 애플 자체 버그입니다.
- **해결**: 실제 아이폰/아이패드로 실기기 테스트하면 정상적으로 표시됩니다.

### ❓ 시뮬레이터에서 지도가 회색으로만 보여요.
- **원인**: 네이버 지도 API가 `capacitor://localhost` 주소를 차단합니다.
- **해결**: `capacitor.config.json`의 `server.url`을 실서버 도메인으로 설정하세요. (섹션 4 참고)

### ❓ 웹 브라우저에서 접속하면 "GPS 오류: Not implemented on web" 메시지가 떠요.
- **원인**: Capacitor Geolocation 플러그인이 네이티브 앱 전용입니다.
- **해결**: 섹션 7의 Fallback 로직을 코드에 적용하세요.

### ❓ 웹 브라우저에서 접속하면 "User denied Geolocation" 에러가 떠요.
- **원인**: 브라우저에서 위치 권한을 차단한 상태입니다.
- **해결**: 브라우저 주소창 좌측의 자물쇠 아이콘 → 권한 → 위치를 '허용'으로 변경 후 새로고침

### ❓ Xcode에서 "pairing is in progress" 라고 뜨면서 실기기 선택이 안 돼요.
- **원인**: 맥북과 기기 간 개발용 페어링이 완료되지 않은 상태입니다.
- **해결**: 기기 화면을 켜두고(잠금 해제 상태) 1~2분 대기, 또는 케이블을 뽑았다 다시 꽂기

### ❓ "신뢰하지 않는 개발자" 팝업이 뜨면서 앱이 실행되지 않아요.
- **해결**: 섹션 8 Step 4를 참고하여 기기 설정에서 개발자를 신뢰 처리하세요.

### ❓ Build Failed가 뜹니다.
- **대부분의 원인**: DerivedData 캐시 충돌 또는 Swift 패키지 다운로드 미완료
- **해결 순서**:
  1. `Cmd + Shift + K` (Clean Build Folder)
  2. `rm -rf ~/Library/Developer/Xcode/DerivedData/*` (터미널)
  3. Xcode 재시작 후 다시 빌드

### ❓ `capacitor.config.json`을 수정했는데 앱에 반영이 안 돼요.
- `npx cap sync ios` 명령어를 반드시 실행하고 Xcode에서 Clean Build 후 재빌드해야 합니다.

---

## 주요 명령어 치트시트

```bash
# 웹 빌드
npm run build

# iOS 동기화 (코드 수정 후 필수)
npx cap sync ios

# Xcode 열기
npx cap open ios

# 개발 서버 실행 (실기기 로컬 테스트용)
npm run dev -- --host

# Xcode 빌드 캐시 초기화
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

---

## 현재 프로젝트 구조 (Phase 6 완료 상태)

```
PSF_APP/
├── capacitor.config.json       ← 하이브리드 앱 핵심 설정
├── ios/                        ← Xcode 네이티브 iOS 프로젝트 (npx cap add ios로 생성)
│   └── App/
│       ├── App.xcodeproj       ← Xcode에서 여는 프로젝트 파일
│       └── App/
│           ├── Info.plist      ← iOS 앱 권한 설정 (위치 권한 등)
│           └── public/         ← npm run build + npx cap sync 결과물
├── src/
│   ├── context/
│   │   └── AppContext.jsx      ← GPS 전송 로직 (Capacitor + Web Fallback 적용)
│   └── pages/
│       └── GpsPage.jsx         ← 네이버 지도 + GPS UI (예외처리 및 메모리 누수 방지 적용)
└── docs/
    ├── aws_deployment_plan.md  ← AWS 배포 계획서
    └── hybrid_app_manual.md    ← 이 문서
```

---

*작성일: 2026-05-16 | 작성자: Antigravity AI Assistant*
*Capacitor 버전: 8.3.4 | @capacitor/geolocation 버전: 8.2.0*
