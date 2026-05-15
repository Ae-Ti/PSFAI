
```
목차

0. 개요
1. Capacitor 설치 및 초기 설정
2. iOS 프로젝트 생성 및 빌드
3. Android 프로젝트 생성 및 빌드
4. 핵심 설정: capacitor.config.json
5. 백엔드 CORS 설정 업데이트
6. GPS(위치) 플러그인 연동
7. 실기기 테스트 방법 (iOS)
8. 실기기 테스트 방법 (Android)
9. 코드 수정 후 앱 업데이트 절차
```

---

# 0. 개요

**목표**: React 웹 앱을 Capacitor를 이용해 iOS/Android 네이티브 앱으로 전환

- 이전 하이브리드 앱 배포 매뉴얼 1-3을 진행한 것을 가정한다.
- 네이티브 프로젝트 변환을 위해 개발 도구인 Xcode와 안드로이드 스튜디오가 설치되어 있어야 한다.
- Capacitor 사용을 위한 Node.js 18+, Capacitor가 ios에서 라이브러리를 관리하는 도구인 CocoaPods를 설치해야 한다.
- 위 도구들은 설치가 간단하므로, 검색을 통해 설치 방법을 찾을 것.

### 맥북 Xcode 최초 설정
```bash
# Xcode Command Line Tools 설치 (최초 1회)
xcode-select --install

# 라이선스 동의
sudo xcodebuild -license accept
```

---

# 1. Capacitor 설치 및 초기 설정

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

### iOS 플랫폼과 Android 플랫폼 추가 (최초 1회)
```bash
# 먼저 웹앱 빌드가 되어 있어야 함
npm run build

# Android 패키지 설치
npm install @capacitor/android

# Android 네이티브 프로젝트 생성
npx cap add android

# iOS 네이티브 프로젝트 생성
npx cap add ios
```

> ⚠️ `npx cap add ` 실행 후 `ios/`와 `android/` 폴더가 생성됨. 이 폴더는 Git에 커밋해도 무방하지만 Xcode 빌드 캐시(`ios/App/build/`,`android/app/build`)는 `.gitignore`에 추가하는 것을 권장.

---

# 2. iOS 프로젝트 생성 및 빌드

### Xcode에서 열기
```bash
# 터미널에서 실행하면 Xcode가 자동으로 열림
npx cap open ios
```

### Xcode Signing 설정 (최초 1회)
개인 Apple ID로 무료 배포(개인 기기 설치)가 가능하도록 설정한다.

1. Xcode 왼쪽 파일 트리에서 파란색 **App** 아이콘 클릭
2. 중앙 화면 **Signing & Capabilities** 탭 클릭
3. **Team** 항목 클릭 → **Add an Account...** → Apple ID로 로그인
4. Team을 본인 이름(Personal Team)으로 선택
5. Bundle Identifier가 `cloud.psfapp.app`인지 확인

### 빌드 및 에뮬레이터 실행
- 상단 기기 선택 드롭다운에서 `iPhone 17` 등 기기 선택 후 ▶ 버튼

---

# 3. Android 프로젝트 생성 및 빌드

### Android Studio에서 열기
```bash
# 터미널에서 실행하면 Android Studio가 자동으로 열림
npx cap open android
```

### Android Studio 초기 설정
1. Android Studio에서 프로젝트가 열리면 상단에 **"Gradle sync"** 진행 표시가 뜬다. (최초 1회, 수 분 소요)
2. 상단 메뉴 **Tools → SDK Manager** 에서 현재 기기에 맞는 Android SDK가 설치되어 있는지 확인.

### Android 에뮬레이터로 실행
1. 상단 메뉴 **Tools → Device Manager** 클릭
2. **Create Device** → 원하는 기기(예: Pixel 8) 선택 → 시스템 이미지 다운로드
3. 생성된 에뮬레이터의 ▶ 버튼으로 에뮬레이터를 작동.
4. Android Studio 상단 기기 드롭다운에서 에뮬레이터 선택 후 **▶ (Run) 버튼** 클릭

---

# 4. 핵심 설정: capacitor.config.json

이 파일이 하이브리드 앱의 동작 방식을 결정하는 가장 중요한 설정 파일이다.

### 현재 적용 중인 설정 (프로덕션 권장)
```json
{
  "appId": "cloud.psfapp.app",
  "appName": "PSF Forum",
  "webDir": "dist",
  "server": {
    "url": "https://psfapp.cloud", // 도메인 주소
    "androidScheme": "https"
  },
  "plugins": {
    "Geolocation": {
      "permissions": ["location"]
    }
  }
}
```

- 위에서 server.url 설정을 따로 하지 않으면 앱 내부 파일(capacitor://localhost)을 사용하게 된다. 이때, 기기의 GPS 기능은 제대로 작동하지만, 네이버 지도 API는 보안 정책상 `capacitor://` 프로토콜을 비정상 접근으로 간주하여 HTTP 500 에러를 반환한다. AWS에 배포된 실서버 도메인(`https://`)을 바라보게 설정하면 이 문제가 완전히 해결된다.
- 또한 웹과 도메인 주소를 동일하게 하면 앱 심사 따로 없이 코드 푸시가 가능하다.

---

# 5. 백엔드 CORS 설정 업데이트

Capacitor 앱은 플랫폼에 따라 서로 다른 Origin을 사용한다.
Spring Boot 백엔드의 CORS 설정에 아래 주소들이 추가되어 있는지 반드시 확인할 것.

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

- 향후 오프라인 내장 파일 방식으로 전환하거나 개발 환경에서 테스트할 경우를 대비해 위 설정을 유지하는 것이 좋다.

---

# 6. GPS(위치) 플러그인 연동

### Info.plist 권한 설정 (iOS 필수)
ios에서 GPS 기능 사용하려면, Xcode에서 `Info.plist` 파일에 위치 권한 메시지를 추가해야 한다.
`ios/App/App/Info.plist` 파일을 열고 아래 항목을 추가하거나, Xcode GUI에서 추가:

| Key                                            | Value                                   |
| ---------------------------------------------- | --------------------------------------- |
| `NSLocationWhenInUseUsageDescription`          | `현재 위치를 의전팀에 전달하기 위해 위치 정보가 필요합니다.`     |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | `백그라운드에서도 위치를 전송하기 위해 항상 위치 접근이 필요합니다.` |

### Geolocation 플러그인 코드 사용법
`@capacitor/geolocation`은 iOS/Android 네이티브 앱 전용 플러그인이다.
PC 웹 브라우저에서 접속하면 `Not implemented on web.` 에러가 발생하므로 웹/앱 환경 분기 처리를 해줘야 한다. (Fallback 로직 적용)

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

이 패턴을 `GpsPage.jsx`와 `AppContext.jsx`(GPS 사용 페이지)의 GPS 관련 로직 전체에 동일하게 적용.

---

# 7. 실기기 테스트 방법 (iOS)

### Step 1: 기기 연결 및 신뢰 설정
1. 케이블로 기기와 맥북을 연결.
2. 아이폰/아이패드 화면에 **"이 컴퓨터를 신뢰하겠습니까?"** 팝업이 뜨면 **[신뢰]** 를 클릭.
3. 아이폰/아이패드 잠금 해제 비밀번호를 입력.

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

# 8. 실기기 테스트 방법 (Android)

1. Android Studio 상단 메뉴: **Build > Build Bundle(s) / APK(s) > Build APK(s)** 클릭.
2. 오른쪽 하단에 완료 알림이 뜨면 **'locate'** 버튼 클릭.
3. 생성된 `app-debug.apk` 파일을 폰으로 전송 후 설치. (다운받기 위해 잠시 설정의 보안 및 개인 정보 보호에서 보안 위험 자동 차단을 해제했다가 다운 받으면 다시 설정하자.)

---

# 9. 코드 수정 후 앱 업데이트 절차

### npx cap sync

```bash
# PSF_APP 디렉토리에서 실행

# Step 1: 웹 앱 빌드 (React → dist/ 폴더)
npm run build

# Step 2: 네이티브 프로젝트에 웹 에셋 동기화
npx cap sync

# Step 3: Xcode 또는 안드로이드 스튜디오에서 재빌드 및 설치
```

> `server.url`에 AWS 실서버 주소를 설정하고 배포했다면, Xcode 재빌드 없이도 코드 배포 시 앱에서 변경 사항이 자동 반영된다. 일반적인 코드 수정이 아닌, 다음과 같은 상황에서만 sync 명령어를 사용하면 된다.

- **새로운 플러그인 설치**: 예를 들어 '카메라'나 '알림' 기능을 새로 설치했을 때.
- **설정 파일 변경**: `capacitor.config.json` 내용을 수정했을 때 (예: 앱 이름 변경, 서버 주소 변경 등).
- **아이콘/스플래시 이미지 변경**: 앱의 로딩 화면이나 아이콘을 바꿨을 때.

### Xcode DerivedData(빌드 캐시) 초기화 (문제 발생 시)

설정을 바꾸었는데도 이전 설정이 계속 적용되는 경우 캐시를 초기화한다.

**(Xcode 내)**
- 맥 상단 탭 중 Product → "Clean Build Folder"

캐시 초기화 후 첫 빌드는 Swift 패키지를 새로 다운로드하므로 **2~5분** 정도 시간이 소요될 수 있다.

### 주요 명령어 치트시트

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

### 현재 프로젝트 구조 (Phase 6 완료 상태)

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

# 10. 요약 및 마무리

  ```text
  [로컬 개발 PC]
  ├─ 환경 구축: Xcode, Android Studio, CocoaPods 설치
  ├─ 패키지 설치: @capacitor/core, @capacitor/cli, @capacitor/geolocation
  └─ Capacitor 초기화
       → npx cap init (앱 이름, Bundle ID 설정)
       → npm run build (웹 빌드 결과물 생성)
       → npx cap add ios & npx cap add android (네이티브 프로젝트 생성)
       │
       ▼
[하이브리드 핵심 설정]
  PSF_APP/capacitor.config.json 수정
  → server.url: "https://psfapp.cloud" 설정 (실시간 업데이트 및 지도 API 에러 해결)
  → androidScheme: "https" (보안 통신 설정)
       │
       ▼
[플랫폼별 네이티브 설정 (수동)]
  ├─ iOS (Xcode)
  │    → Signing & Capabilities: 개발자계정 연결 및 번들ID 확인
  │    → Info.plist: NSLocation... 위치 권한 메시지 추가 (GPS 필수)
  └─ Android (Android Studio)
       → Gradle Sync 실행 및 필요한 SDK 설치 확인
       │
       ▼
[백엔드 & 프론트엔드 코드 수정]
  ├─ 백엔드 (CORS): capacitor://localhost 및 http://localhost 허용 도메인 추가
  └─ 프론트엔드 (GPS): @capacitor/geolocation 적용 및 Web Fallback 로직 구현
       │
       ▼
[실기기 테스트 실행 (수동)]
  ├─ iOS 테스트
  │    → iPhone 연결 → 개발자 모드 활성화 → [설정]에서 앱 '신뢰' 처리 → 실행
  └─ Android 테스트
       → Build APK 생성 → app-debug.apk 파일 폰으로 전송 → 직접 설치 → 실행

[결과]
  - 앱 업데이트: 단순 코드 수정 시 npx cap sync 없이도 실시간 자동 반영
  - 하이브리드 최적화: 네이티브 GPS 기능과 네이버 지도 API 완벽 연동
  ```

- 이로써 모든 목표를 완수했다. PSF 앱 사례를 바탕으로, 이제 하나의 프로젝트로웹과 하이브리드 앱 서비스를 빠르게 제공할 수 있으며, 실시간 업데이트 구조를 구성할 수 있다. 또한, 정립된 배포 및 앱 패키징 방식으로 다른 아이디어를 더욱 빠르게 구현할 수 있게 되었다.