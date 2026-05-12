import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import { useEffect } from 'react'
import { checkIn, fetchMyAttendance } from '../api/attendance'

// Deterministic QR pattern
const QR_PATTERN = [
    1, 1, 1, 0, 1, 1, 1,
    1, 0, 1, 0, 1, 0, 1,
    1, 1, 1, 0, 0, 1, 0,
    0, 0, 0, 0, 1, 0, 1,
    1, 1, 1, 0, 1, 1, 1,
    1, 0, 0, 0, 1, 0, 1,
    1, 1, 1, 0, 1, 1, 1,
]

export default function AttendancePage() {
    const { t, user } = useApp()
    const [status, setStatus] = useState('initial') // initial | loading | success
    const [attInfo, setAttInfo] = useState(null)

    useEffect(() => {
        if (user?.role === '참석자') {
            fetchMyAttendance().then(data => {
                if (data && data.status === 'ATTENDED') {
                    setAttInfo(data)
                    setStatus('success')
                }
            }).catch(console.error)
        }
    }, [user])

    const handleAttend = async () => {
        setStatus('loading')
        try {
            const data = await checkIn("PSF_FORUM_2026_QR_SAMPLE")
            setAttInfo(data)
            setStatus('success')
        } catch (err) {
            console.error(err)
            alert("출석 체크에 실패했습니다.")
            setStatus('initial')
        }
    }

    if (status === 'success') {
        return (
            <div className="app-shell">
                <Header title={t.attendanceTitle} />
                <div className="page page--no-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="success-screen">
                        <div className="success-icon">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#38a169" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <div>
                            <div className="success-title">{t.attendSuccess}</div>
                            <div className="success-sub" style={{ marginTop: 6 }}>{t.attendSuccessSub}</div>
                            <div className="success-sub" style={{ marginTop: 4 }}>
                                {user?.name} · {attInfo ? new Date(attInfo.scannedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                        </div>
                        <button
                            className="btn btn--secondary"
                            style={{ width: 200 }}
                            onClick={() => setStatus('initial')}
                        >
                            돌아가기
                        </button>
                    </div>
                </div>
                <BottomNav />
            </div>
        )
    }

    return (
        <div className="app-shell">
            <Header title={t.attendanceTitle} />
            <div className="page">
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{t.attendanceTitle}</h2>
                <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>{t.attendanceDesc}</p>

                {/* Camera Skeleton */}
                <div className="camera-skeleton" id="camera-view">
                    <div className="camera-corner camera-corner--tl" />
                    <div className="camera-corner camera-corner--tr" />
                    <div className="camera-corner camera-corner--bl" />
                    <div className="camera-corner camera-corner--br" />
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>카메라 영역</span>
                </div>

                {/* My QR */}
                <div className="qr-dummy" id="my-qr">
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>내 QR 코드 · {user?.name}</p>
                        <div className="qr-grid">
                            {QR_PATTERN.map((cell, i) => (
                                <div
                                    key={i}
                                    className="qr-cell"
                                    style={{ background: cell ? '#1a1a2e' : '#fff' }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {status === 'loading' ? (
                    <div className="loading-screen">
                        <div className="spinner" />
                        <span>{t.attendLoading}</span>
                    </div>
                ) : (
                    <button
                        className="btn btn--primary"
                        id="attend-btn"
                        onClick={handleAttend}
                        style={{ marginTop: 8 }}
                    >
                        ✓ {t.attendBtn}
                    </button>
                )}
            </div>
            <BottomNav />
        </div>
    )
}
