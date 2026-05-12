import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import { useEffect, useState } from 'react'
import { fetchNotices } from '../api/notices'

const roleActions = {
    참석자: [
        { label: '📷 QR 출석 체크', sub: '카메라로 출석을 인증하세요', path: '/attendance', color: 'blue' },
        { label: '📋 공지 확인', sub: '최신 공지 및 일정을 확인하세요', path: '/notices', color: 'green' },
        { label: '👥 명단', sub: '소속 팀 명단 확인', path: '/contacts', color: 'orange' },
    ],
    인솔자: [
        { label: '📍 GPS 위치 공유', sub: '현재 위치를 의전에 공유하세요', path: '/gps', color: 'orange' },
        { label: '📋 공지 확인', sub: '최신 공지 및 일정을 확인하세요', path: '/notices', color: 'blue' },
        { label: '👥 명단', sub: '소속 팀 명단 확인', path: '/contacts', color: 'green' },
    ],
    의전: [
        { label: '📊 운영 현황', sub: '출석 현황 및 특이사항 확인', path: '/dashboard', color: 'blue' },
        { label: '💬 채팅방', sub: '팀 및 의전 전체 채팅', path: '/chat', color: 'green' },
        { label: '👥 명단', sub: '전체 참석자·인솔자·사무국 명단', path: '/contacts', color: 'orange' },
    ],
    사무국: [
        { label: '📢 공지사항', sub: '전체 공지 및 안내', path: '/notices', color: 'indigo' },
        { label: '👥 명단', sub: '전체 명단 확인', path: '/contacts', color: 'green' },
        { label: '🔐 계정 관리', sub: '참석자·인솔자 계정 발급 및 삭제', path: '/accounts', color: 'blue' },
    ],
}

export default function HomePage() {
    const { user, t } = useApp()
    const navigate = useNavigate()
    if (!user) return null

    const [notices, setNotices] = useState([])
    useEffect(() => {
        fetchNotices().then(data => setNotices(Array.isArray(data) ? data : [])).catch(() => setNotices([]))
    }, [])

    const actions = roleActions[user.role] || []
    const latestNotice = notices[0]
    const roleLabel = { 참석자: t.participant, 인솔자: t.guide, 의전: t.escort, 사무국: t.hq }
    const roleColors = { 참석자: '#0056b3', 인솔자: '#d97706', 의전: '#6d28d9', 사무국: '#065f46' }

    return (
        <div className="app-shell">
            <Header />
            <div className="page">
                {/* Banner */}
                <div className="home-banner">
                    <div className="role-badge">{roleLabel[user.role]}</div>
                    <h2>{t.welcome}, {user.name} 👋</h2>
                    <p>PSF Forum 2026 · {user.team}</p>
                </div>

                {/* Quick Actions */}
                <p className="section-title">{t.quickAction}</p>
                {actions.map((action) => (
                    <div
                        key={action.path}
                        className="quick-action-card"
                        id={`quick-action-${action.path.replaceAll('/', '')}`}
                        onClick={() => navigate(action.path)}
                        role="button"
                    >
                        <div className={`quick-action-icon quick-action-icon--${action.color}`}>
                            {action.label.slice(0, 2)}
                        </div>
                        <div className="quick-action-text">
                            <h3>{action.label.slice(3)}</h3>
                            <p>{action.sub}</p>
                        </div>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </div>
                ))}

                {/* Recent Notice */}
                <p className="section-title" style={{ marginTop: 24 }}>{t.recentNotice}</p>
                {latestNotice && (
                    <div className="notice-card" onClick={() => navigate('/notices')}>
                        <div className="notice-card-header">
                            <span className="notice-card-title">{latestNotice.title}</span>
                            {latestNotice.isImportant && (
                                <span className="badge badge--red">{t.important}</span>
                            )}
                        </div>
                        <div className="notice-card-date">{latestNotice.date}</div>
                    </div>
                )}
            </div>
            <BottomNav />
        </div>
    )
}
