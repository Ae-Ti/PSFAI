# PSF 하이브리드 앱 전환 매뉴얼 (Phase 6)

> **목적**: React 웹 앱을 Capacitor를 이용해 iOS/Android 네이티브 앱으로 전환하는 전 과정을 기록한 매뉴얼입니다.
> 처음 보는 사람도, 나중에 까먹은 경우도 이 문서 하나로 처음부터 끝까지 따라할 수 있도록 작성되었습니다.

---

## 목차
1. [사전 준비 및 환경 설정](#1-사전-준비-및-환경-설정)
2. [Capacitor 설치 및 초기 설정](#2-capacitor-설치-및-초기-설정)
3. [iOS 프로젝트 생성 및 빌드](#3-ios-프로젝트-생성-및-빌드)
4. [Android 프로젝트 생성 및 빌드](#4-android-프로젝트-생성-및-빌드)
5. [핵심 설정: capacitor.config.json](#5-핵심-설정-capacitorconfigjson)
6. [백엔드 CORS 설정 업데이트](#6-백엔드-cors-설정-업데이트)
7. [네이버 지도 API 연동 문제 해결](#7-네이버-지도-api-연동-문제-해결)
8. [GPS(위치) 플러그인 연동](#8-gps위치-플러그인-연동)
9. [웹/앱 환경 분기 처리](#9-웹앱-환경-분기-처리)
10. [실기기 테스트 방법 (iOS)](#10-실기기-테스트-방법-ios)
11. [실기기 테스트 방법 (Android)](#11-실기기-테스트-방법-android)
12. [코드 수정 후 앱 업데이트 절차](#12-코드-수정-후-앱-업데이트-절차)
13. [검증 체크리스트](#13-검증-체크리스트)
14. [알려진 이슈 및 FAQ](#14-알려진-이슈-및-faq)

---

## 1. 사전 준비 및 환경 설정

### 필수 설치 목록
| 도구 | 필수 여부 | 확인 명령어 / 비고 |
|------|-----------|-------------------|
| Node.js 18+ | **필수** | `node -v` (React 빌드 및 npx 실행용) |
| Xcode 최신버전 | **iOS 필수** | Mac App Store에서 설치 |
| Android Studio | **Android 필수** | [공식 홈페이지](https://developer.android.com/studio)에서 설치 |
| CocoaPods | **iOS 필수** | `pod --version` (iOS 라이브러리 관리) |

> 💡 **이미 설치되어 있나요?** 회원님 컴퓨터에는 이미 Node.js와 CocoaPods가 모두 설치되어 있습니다. `확인 명령어`를 터미널에 쳐서 버전이 나온다면 설치 과정을 건너뛰셔도 됩니다.

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

### Android 플랫폼 추가 (최초 1회)
```bash
# Android 패키지 설치
npm install @capacitor/android

# Android 네이티브 프로젝트 생성
npx cap add android
```

> ⚠️ `npx cap add android` 실행 후 `android/` 폴더가 생성됩니다.

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

## 4. Android 프로젝트 생성 및 빌드

### Android Studio에서 열기
```bash
# 터미널에서 실행하면 Android Studio가 자동으로 열림
npx cap open android
```

> Android Studio가 설치되어 있지 않은 경우: [developer.android.com/studio](https://developer.android.com/studio) 에서 무료로 다운로드

### Android Studio 초기 설정
1. Android Studio에서 프로젝트가 열리면 상단에 **"Gradle sync"** 진행 표시가 뜹니다. 완료될 때까지 기다립니다. (최초 1회, 수 분 소요)
2. 상단 메뉴 **Tools → SDK Manager** 에서 현재 기기에 맞는 Android SDK가 설치되어 있는지 확인합니다.

### Android 에뮬레이터로 실행
1. 상단 메뉴 **Tools → Device Manager** 클릭
2. **Create Device** → 원하는 기기(예: Pixel 8) 선택 → 시스템 이미지 다운로드
3. 생성된 에뮬레이터의 ▶ 버튼으로 에뮬레이터를 켭니다.
4. Android Studio 상단 기기 드롭다운에서 에뮬레이터 선택 후 **▶ (Run) 버튼** 클릭

### Android 실기기로 실행
아래 **11번 섹션 '실기기 테스트 방법 (Android)'** 를 참고하세요.

---

## 5. 핵심 설정: capacitor.config.json

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

## 6. 백엔드 CORS 설정 업데이트

Capacitor 앱은 플랫폼에 따라 서로 다른 Origin을 사용합니다.
Spring Boot 백엔드의 CORS 설정에 아래 주소들을 반드시 추가해야 합니다.

| 환경 | Origin |
|------|--------|
| iOS 앱 (기본) | `capacitor://localhost` |
| Android 앱 (기본) | `http://localhost` |
| 로컬 개발 | `http://localhost:5173` |
| 프로덕션 웹 | `https://psfapp.cloud` |
| CloudFront | `https://*.cloudfront.net` |

### 적용 위치
백엔드 CORS 설정 파일(예: `WebConfig.java` 또는 `SecurityConfig.java`):

```java
config.setAllowedOriginPatterns(List.of(
    "http://localhost:5173",       // 로컬 개발
    "https://psfapp.cloud",        // 프로덕션 웹
    "https://*.cloudfront.net",    // CloudFront
    "capacitor://localhost",        // iOS Capacitor 앱
    "http://localhost"              // Android Capacitor 앱
));
```

> ⚠️ **현재 상태 (2026-05-16 기준)**: `server.url`을 `https://psfapp.cloud`로 설정하여 실서버 도메인을 사용 중이므로 실질적으로 CORS 문제가 발생하지 않습니다. 하지만 향후 오프라인 내장 파일 방식으로 전환하거나 개발 환경에서 테스트할 경우를 대비해 위 설정을 유지하는 것이 좋습니다.

---

## 7. 네이버 지도 API 연동 문제 해결

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

## 8. GPS(위치) 플러그인 연동

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

## 9. 웹/앱 환경 분기 처리

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

## 10. 실기기 테스트 방법 (iOS)

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

## 11. 실기기 테스트 방법 (Android)

### 준비물
- Windows/Mac PC
- Android 스마트폰
- USB-C 케이블
- Android Studio

### Step 1: 안드로이드 개발자 모드 활성화
1. 안드로이드 폰 **[설정]** 앱 열기
2. **[휴대전화 정보]** (또는 '기기 정보') 메뉴 진입
3. **[소프트웨어 정보]** → **[빌드 번호]** 를 **7번 연속으로 탭**
4. "개발자 모드가 활성화되었습니다" 메시지 확인

### Step 2: USB 디버깅 활성화
1. **[설정]** → **[개발자 옵션]** 진입 (이제 메뉴에 보임)
2. **[USB 디버깅]** 스위치를 **켬(ON)**

### Step 3: PC에 기기 연결 및 Android Studio에서 선택 (방법 1)
1. USB 케이블로 안드로이드 폰을 PC에 연결합니다.
2. 안드로이드 폰 화면에 **"USB 디버깅을 허용하시겠습니까?"** 팝업이 뜨면 **[허용]** 을 누릅니다.
3. Android Studio 상단 기기 드롭다운에 **연결된 기기 이름**이 표시됩니다.
4. 기기를 선택하고 **▶ (Run) 버튼** 클릭 → 빌드 및 설치 시작

### 방법 2: APK 파일 생성 후 설치 (케이블 없이 공유 가능)
케이블 연결 없이 파일을 전송하여 설치하고 싶을 때 사용합니다.

1. Android Studio 상단 메뉴: **Build → Build Bundle(s) / APK(s) → Build APK(s)** 클릭
2. 오른쪽 하단에 `Build APK(s): APK(s) generated successfully` 알림이 뜨면 **[locate]** 클릭
3. 열린 폴더의 `app-debug.apk` 파일을 카카오톡, 이메일 등을 통해 폰으로 전송
4. 폰에서 파일을 실행하여 설치 (출처를 알 수 없는 앱 설치 허용 필요)

### Step 4: 첫 실행 시 확인
앱이 설치되고 나면 별도의 '신뢰' 처리 없이 바로 실행됩니다. (iOS와 달리 Android는 이 과정이 없습니다.)

---

## 12. 코드 수정 후 앱 업데이트 절차

하이브리드 앱의 최대 장점은 모든 수정을 매번 동기화할 필요가 없다는 것입니다.

### ❓ `npx cap sync`가 매번 필요한가요?

| 수정 사항 | `sync` 필요 여부 | 이유 |
|-----------|------------------|------|
| **웹 코드 (React, CSS)** | **필요 없음** | `server.url` 설정 덕분에 AWS 배포 시 실시간 반영됨 |
| **플러그인 추가/삭제** | **필수** | 네이티브 라이브러리 연결이 필요함 |
| **config.json 수정** | **필수** | 앱 이름, 서버 주소 등 핵심 설정 반영 |
| **아이콘, 이미지 변경** | **필수** | 네이티브 리소스 업데이트 필요 |

### 업데이트 작업 순서 (네이티브 변경 시)

```bash
# 1. (필요시) 웹 앱 빌드
npm run build

# 2. 플랫폼 동기화 (전체 플랫폼 한 번에)
npx cap sync

# 3. Xcode 또는 Android Studio에서 실행
# iOS: npx cap open ios 후 재생 버튼
# Android: npx cap open android 후 재생 버튼
```

> 💡 **한꺼번에 동기화**: `npx cap sync ios` 대신 그냥 `npx cap sync`를 치면 추가된 모든 플랫폼(iOS, Android)이 한 번에 동기화됩니다.

---

## 13. 검증 체크리스트

### 기능 검증 (플랫폼 무관)
- [ ] 로그인 / 로그아웃 정상 작동
- [ ] GPS 위치 수집 및 백엔드 전송 확인
- [ ] 네이버 지도 정상 표시
- [ ] 챗봇(AI) 응답 정상 작동
- [ ] WebSocket 실시간 채팅 작동
- [ ] 공지사항 조회
- [ ] 참석자 명단 조회
- [ ] 위치 송신 시작/중단 버튼 정상 작동

### iOS 전용 확인 사항
- [ ] 위치 권한 팝업 정상 표시 ("위치 정보를 사용하겠습니까?")
- [ ] 이모지(이모티콘) 정상 표시 (실기기에서만 확인 가능)
- [ ] 지도 정상 표시 (server.url 설정 후)
- [ ] 앱 신뢰 처리 완료
- [ ] ATS 정책 준수 (모든 API 통신이 HTTPS)

### Android 전용 확인 사항
- [ ] 위치 권한 팝업 정상 표시
- [ ] 지도 정상 표시
- [ ] WebSocket 연결 유지 (백그라운드 시)

### 웹 브라우저 확인 사항
- [ ] PC 크롬에서 GPS Fallback 작동 (브라우저 위치 권한 허용 후)
- [ ] 모바일 사파리/크롬에서 GPS 정상 작동
- [ ] "Not implemented on web" 에러 미발생 확인

---

## 14. 알려진 이슈 및 FAQ

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

# Android 동기화 (코드 수정 후 필수)
npx cap sync android

# Xcode 열기
npx cap open ios

# Android Studio 열기
npx cap open android

# 개발 서버 실행 (로컬 실기기 테스트용)
npm run dev -- --host

# Xcode 빌드 캐시 초기화
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Android 연결 기기 확인
adb devices
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
├── android/                    ← Android Studio 네이티브 프로젝트 (npx cap add android로 생성)
│   └── app/
│       └── src/main/
│           └── AndroidManifest.xml  ← Android 권한 설정 (Capacitor가 자동 추가)
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
