# ── Stage 1: Gradle 빌드 ──────────────────────────────────────
FROM gradle:8-jdk21 AS builder
WORKDIR /app

# 의존성 캐시 레이어 (소스 변경 시에도 의존성 재다운로드 방지)
COPY build.gradle settings.gradle ./
COPY gradle ./gradle
RUN gradle dependencies --no-daemon || true

# 소스 복사 후 빌드 (테스트 제외)
COPY . .
RUN gradle bootJar --no-daemon -x test

# ── Stage 2: 경량 JRE 실행 이미지 ────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# 타임존 설정 (한국)
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Seoul /etc/localtime && \
    echo "Asia/Seoul" > /etc/timezone

COPY --from=builder /app/build/libs/psf-backend-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-Dspring.profiles.active=prod", "-jar", "app.jar"]
