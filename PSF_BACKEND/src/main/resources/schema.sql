-- =====================================================
-- PSF App Database Schema
-- 반드시 이 파일을 Railway PostgreSQL에 직접 실행하세요
-- =====================================================

-- Extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(50)  UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('ATTENDEE','GUIDE','ESCORT','HQ')),
    team_name     VARCHAR(20),
    emoji         VARCHAR(10),
    phone         VARCHAR(30),
    email         VARCHAR(100),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. notices
CREATE TABLE IF NOT EXISTS notices (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    content      TEXT         NOT NULL,
    is_important BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. attendances
CREATE TABLE IF NOT EXISTS attendances (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     VARCHAR(20)  DEFAULT 'ATTENDED',
    qr_data    TEXT,
    scanned_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. guide_locations (1:1 최신 상태)
CREATE TABLE IF NOT EXISTS guide_locations (
    guide_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    latitude        DECIMAL(10,7),
    longitude       DECIMAL(10,7),
    address         VARCHAR(255),
    status          VARCHAR(50),
    is_transmitting BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 5. dashboard_notes
CREATE TABLE IF NOT EXISTS dashboard_notes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_name  VARCHAR(20),
    content    TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 6. chat_rooms
CREATE TABLE IF NOT EXISTS chat_rooms (
    id         VARCHAR(50) PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    room_type  VARCHAR(30),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 7. chat_room_members (중간 테이블)
CREATE TABLE IF NOT EXISTS chat_room_members (
    room_id   VARCHAR(50) NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);

-- 8. chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id    VARCHAR(50) NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 9. chatbot_histories
CREATE TABLE IF NOT EXISTS chatbot_histories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('user','bot')),
    message     TEXT NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
-- =====================================================
-- SEED DATA
-- 비밀번호 '1234' → BCrypt 해시 (rounds=10)
-- =====================================================

-- 1. 더미 계정 (id 명시적 생성)
INSERT INTO users (id, username, password_hash, name, role, team_name, emoji) VALUES
    (gen_random_uuid(), 'user1',   '$2a$10$hxFLlBAAKxKe.Mf7pNuBmu3YDWLvQV6gYLhCqD2JKCXBWbVGMpsCi', 'John Doe',  'ATTENDEE', 'Team A', '👤'),
    (gen_random_uuid(), 'guide1',  '$2a$10$hxFLlBAAKxKe.Mf7pNuBmu3YDWLvQV6gYLhCqD2JKCXBWbVGMpsCi', '김인솔',    'GUIDE',    'Team A', '🧭'),
    (gen_random_uuid(), 'escort1', '$2a$10$hxFLlBAAKxKe.Mf7pNuBmu3YDWLvQV6gYLhCqD2JKCXBWbVGMpsCi', '박의전',    'ESCORT',   'Team A', '🎖️'),
    (gen_random_uuid(), 'hq1',     '$2a$10$hxFLlBAAKxKe.Mf7pNuBmu3YDWLvQV6gYLhCqD2JKCXBWbVGMpsCi', '최운영',    'HQ',       'All',    '🏛️')
ON CONFLICT (username) DO NOTHING;

-- 2. 채팅방 생성 (이 부분이 빠져있었을 겁니다!)
INSERT INTO chat_rooms (id, name, room_type) VALUES
    ('escort-all', '의전 전체 채팅방',  'ESCORT_ALL'),
    ('staff',      '준비인원 채팅방',    'STAFF_ONLY'),
    ('team-a',     'Team A 채팅방',    'TEAM'),
    ('team-b',     'Team B 채팅방',    'TEAM'),
    ('team-c',     'Team C 채팅방',    'TEAM')
ON CONFLICT (id) DO NOTHING;

-- 3. 채팅방 멤버 매핑
INSERT INTO chat_room_members (room_id, user_id)
SELECT 'escort-all', id FROM users WHERE username IN ('escort1', 'guide1', 'hq1')
ON CONFLICT DO NOTHING;

INSERT INTO chat_room_members (room_id, user_id)
SELECT 'staff', id FROM users WHERE username IN ('escort1', 'hq1')
ON CONFLICT DO NOTHING;

INSERT INTO chat_room_members (room_id, user_id)
SELECT 'team-a', id FROM users WHERE username IN ('escort1', 'guide1', 'user1')
ON CONFLICT DO NOTHING;

INSERT INTO chat_room_members (room_id, user_id)
SELECT 'team-b', id FROM users WHERE username IN ('hq1')
ON CONFLICT DO NOTHING;

INSERT INTO chat_room_members (room_id, user_id)
SELECT 'team-c', id FROM users WHERE username IN ('hq1')
ON CONFLICT DO NOTHING;