import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import apiClient from '../api/client'
import { updateProfile, fetchProfile } from '../api/users'
import ConfirmModal from '../components/ConfirmModal'

export default function ProfilePage() {
    const { user, t, logout, updateUser } = useApp()
    const navigate = useNavigate()
    const [phone, setPhone] = useState(user?.phone || '010-0000-0000')
    const [email, setEmail] = useState(user?.email || '')
    const [saved, setSaved] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [modal, setModal] = useState({ isOpen: false, type: null })

    // Sync state when user object changes (e.g., after login or update)
    useEffect(() => {
        if (user) {
            setPhone(user.phone || '010-0000-0000');
            setEmail(user.email || '');
        }
    }, [user]);

    // Fetch latest profile on mount to ensure data (like Position) is up to date
    useEffect(() => {
        fetchProfile()
            .then(data => {
                if (data) updateUser(data);
            })
            .catch(err => console.error('Failed to fetch latest profile:', err));
    }, []);

    const roleMap = { 'ATTENDEE': '참석자', 'GUIDE': '인솔자', 'ESCORT': '의전', 'HQ': '사무국' };
    const roleLabel = { 참석자: t.participant, 인솔자: t.guide, 의전: t.escort, 사무국: t.hq }
    const roleColors = { 참석자: '#0056b3', 인솔자: '#d97706', 의전: '#6d28d9', 사무국: '#065f46' }

    const save = async () => {
        try {
            await updateProfile({ phone, email })
            updateUser({ phone, email })
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            console.error('Failed to update profile:', err)
            alert('프로필 저장에 실패했습니다.')
        }
    }

    const handleLogout = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setModal({ isOpen: true, type: 'logout' });
    }

    const handleDeleteAccount = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setModal({ isOpen: true, type: 'delete' });
    }

    const onConfirm = async () => {
        const { type } = modal;
        setModal({ isOpen: false, type: null });

        if (type === 'logout') {
            logout();
            navigate('/', { replace: true });
        } else if (type === 'delete') {
            setIsDeleting(true);
            try {
                await apiClient.delete('/auth/me');
                alert('회원 탈퇴가 완료되었습니다.');
                logout();
                navigate('/', { replace: true });
            } catch (err) {
                console.error(err);
                alert('회원 탈퇴 중 오류가 발생했습니다.');
            } finally {
                setIsDeleting(false);
            }
        }
    }

    const inputStyle = {
        padding: '12px 14px',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        fontFamily: 'Outfit, sans-serif',
        fontSize: 14,
        outline: 'none',
        transition: 'border-color 0.15s',
        width: '100%',
        boxSizing: 'border-box',
    }

    return (
        <div className="app-shell">
            <Header title={t.profileTitle} />
            <div className="page">
                {/* Avatar + Name */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, paddingBottom: 24 }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: '50%',
                        background: roleColors[user?.role] || '#0056b3',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 28, marginBottom: 12,
                    }}>
                        {user?.emoji || '👤'}
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{user?.name}</h2>
                    <span style={{
                        background: roleColors[roleMap[user?.role] || user?.role] || '#0056b3',
                        color: '#fff', borderRadius: 20, padding: '3px 14px', fontSize: 13, fontWeight: 600,
                    }}>
                        {roleLabel[roleMap[user?.role] || user?.role] || user?.role}
                    </span>
                    <p style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>
                        PSF Forum 2026 · {user?.team} {user?.position ? `· ${user.position}` : ''}
                    </p>
                </div>

                {/* Read-only fields */}
                <div className="card" style={{ marginBottom: 16 }}>
                    <p className="section-title" style={{ margin: '0 0 12px' }}>계정 정보</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                            <span style={{ color: '#6b7280' }}>아이디</span>
                            <span style={{ fontWeight: 600 }}>{user?.username}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                            <span style={{ color: '#6b7280' }}>역할</span>
                            <span style={{ fontWeight: 600 }}>{roleLabel[roleMap[user?.role] || user?.role] || user?.role}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                            <span style={{ color: '#6b7280' }}>팀</span>
                            <span style={{ fontWeight: 600 }}>{user?.team}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                            <span style={{ color: '#6b7280' }}>직책</span>
                            <span style={{ fontWeight: 600, color: '#0056b3' }}>{user?.position || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                {/* Editable fields */}
                <div className="card" style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <p className="section-title" style={{ margin: 0 }}>연락 정보</p>
                        <button
                            id="profile-save-btn-small"
                            onClick={save}
                            disabled={saved}
                            style={{
                                padding: '6px 14px', borderRadius: 20, border: 'none',
                                background: saved ? '#10b981' : '#0056b3', color: '#fff',
                                fontSize: 12, fontWeight: 600, cursor: saved ? 'default' : 'pointer',
                                transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 4
                            }}
                        >
                            {saved ? '✓ 저장됨' : '저장'}
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{t.profilePhone}</label>
                            <input
                                id="profile-phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder={t.profilePhonePh}
                                style={inputStyle}
                                onFocus={(e) => (e.target.style.borderColor = '#0056b3')}
                                onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{t.profileEmail}</label>
                            <input
                                id="profile-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={t.profileEmailPh}
                                style={inputStyle}
                                onFocus={(e) => (e.target.style.borderColor = '#0056b3')}
                                onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                            />
                        </div>
                    </div>
                </div>



                {/* 계정 관리 버튼: 로그아웃, 탈퇴 */}
                {/* 계정 관리 버튼: 로그아웃, 탈퇴 */}
                <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                    <button
                        type="button"
                        onClick={handleLogout}
                        style={{
                            flex: 1, padding: '12px 0', borderRadius: 8,
                            border: '1px solid #e5e7eb', background: '#fff',
                            color: '#4b5563', fontSize: 14, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'Outfit, sans-serif'
                        }}
                    >
                        로그아웃
                    </button>
                    <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                        style={{
                            flex: 1, padding: '12px 0', borderRadius: 8,
                            border: '1px solid #fee2e2', background: '#fef2f2',
                            color: '#b91c1c', fontSize: 14, fontWeight: 600,
                            cursor: isDeleting ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif'
                        }}
                    >
                        {isDeleting ? '처리 중...' : '회원 탈퇴'}
                    </button>
                </div>
                {/* Spacer for bottom nav */}
                <div style={{ height: 40 }} />
            </div>
            <ConfirmModal
                isOpen={modal.isOpen}
                title={modal.type === 'logout' ? '로그아웃' : '회원 탈퇴'}
                message={modal.type === 'logout' 
                    ? '정말로 로그아웃 하시겠습니까?' 
                    : '정말로 회원 탈퇴를 하시겠습니까? 이 작업은 되돌릴 수 없습니다.'}
                isDanger={modal.type === 'delete'}
                confirmText={modal.type === 'logout' ? '로그아웃' : '탈퇴하기'}
                cancelText="취소"
                onConfirm={onConfirm}
                onCancel={() => setModal({ isOpen: false, type: null })}
            />
            <BottomNav />
        </div>
    )
}
