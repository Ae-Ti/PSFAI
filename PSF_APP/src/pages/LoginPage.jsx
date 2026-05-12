import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import apiClient from '../api/client'
import loginData from '../data/route_login.json'

export default function LoginPage() {
    const { login, t, language, setLanguage } = useApp()
    const navigate = useNavigate()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e) => {
        e.preventDefault()
        setError('')
        if (!username.trim() || !password.trim()) {
            setError(t.loginErrorEmpty || '아이디와 비밀번호를 입력해주세요.')
            return
        }
        setLoading(true)

        try {
            const response = await apiClient.post('/auth/login', {
                username: username.trim(),
                password: password
            });

            const data = response.data;
            
            if (data.success) {
                // 백엔드에서 내려준 데이터를 맞춤
                const userData = data.data; 
                const roleMap = {
                    'ATTENDEE': '참석자',
                    'GUIDE': '인솔자',
                    'ESCORT': '의전',
                    'HQ': '사무국'
                };
                login({
                    id: userData.id,
                    username: username.trim(),
                    name: userData.name,
                    role: roleMap[userData.role] || userData.role,
                    teamName: userData.teamName,
                    emoji: userData.emoji,
                    token: userData.token
                });
                navigate('/home')
            } else {
                setError(data.message || t.loginErrorWrong || '아이디 또는 비밀번호가 올바르지 않습니다.')
            }
        } catch (err) {
            console.error('Login error:', err);
            // 서버에서 보낸 상세 메시지 (예: "아이디 또는 비밀번호가 올바르지 않습니다. (USER NOT FOUND)")를 표시합니다.
            const errorMessage = err.response?.data?.message || err.message || '서버와 연결할 수 없습니다.';
            setError(errorMessage);
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-page">
            {/* Language selector */}
            <div style={{ position: 'absolute', top: 16, right: 16 }}>
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{
                        appearance: 'none',
                        border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 13,
                        background: 'rgba(255,255,255,0.1)',
                        color: '#fff',
                        cursor: 'pointer',
                        fontFamily: 'Outfit, sans-serif',
                    }}
                >
                    <option value="KO">🇰🇷 KO</option>
                    <option value="EN">🇺🇸 EN</option>
                    <option value="FR">🇫🇷 FR</option>
                </select>
            </div>

            {/* Logo */}
            <div className="login-logo">
                <h1>PSF</h1>
                <p>{t.loginSub}</p>
            </div>

            {/* Login Form */}
            <form
                onSubmit={handleLogin}
                style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 500 }}>
                        {t.loginUsername || '아이디'}
                    </label>
                    <input
                        id="login-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t.loginUsernamePh || '아이디를 입력하세요'}
                        autoComplete="username"
                        style={{
                            padding: '14px 16px',
                            borderRadius: 10,
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(255,255,255,0.1)',
                            color: '#fff',
                            fontSize: 15,
                            fontFamily: 'Outfit, sans-serif',
                            outline: 'none',
                        }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 500 }}>
                        {t.loginPassword || '비밀번호'}
                    </label>
                    <input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t.loginPasswordPh || '비밀번호를 입력하세요'}
                        autoComplete="current-password"
                        style={{
                            padding: '14px 16px',
                            borderRadius: 10,
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(255,255,255,0.1)',
                            color: '#fff',
                            fontSize: 15,
                            fontFamily: 'Outfit, sans-serif',
                            outline: 'none',
                        }}
                    />
                </div>

                <div style={{ minHeight: 52, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {error && (
                        <div style={{
                            background: 'rgba(229,62,62,0.2)',
                            border: '1px solid rgba(229,62,62,0.4)',
                            borderRadius: 8,
                            padding: '10px 14px',
                            color: '#fca5a5',
                            fontSize: 13,
                            animation: 'fadeIn 0.2s ease-out'
                        }}>
                            {error}
                        </div>
                    )}
                </div>

                <button
                    id="login-submit-btn"
                    type="submit"
                    disabled={loading}
                    style={{
                        marginTop: 4,
                        height: 52,
                        borderRadius: 12,
                        border: 'none',
                        background: loading ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.95)',
                        color: '#0056b3',
                        fontSize: 16,
                        fontWeight: 700,
                        fontFamily: 'Outfit, sans-serif',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                    }}
                >
                    {loading
                        ? (t.loading || '로딩 중...')
                        : (t.loginBtn || '로그인')}
                </button>
            </form>

            <button
                id="login-tour-btn"
                type="button"
                onClick={() => navigate('/about')}
                style={{
                    width: '100%',
                    marginTop: 12,
                    height: 52,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'transparent',
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 600,
                    fontFamily: 'Outfit, sans-serif',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                포럼 둘러보기
            </button>

            {/* Hint */}
            <div style={{
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: '12px 16px',
                width: '100%',
            }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6 }}>
                    {t.loginHint || '계정은 사무국에서 발급합니다. 데모 계정 ↓'}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                    {loginData.users.map((u) => (
                        <button
                            key={u.id}
                            onClick={() => { setUsername(u.username); setPassword(u.password) }}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'rgba(255,255,255,0.6)', fontSize: 12,
                                textAlign: 'left', padding: '2px 0', fontFamily: 'Outfit, sans-serif',
                            }}
                        >
                            {u.emoji} {u.role}: <code style={{ fontSize: 11 }}>{u.username}</code>
                        </button>
                    ))}
                </div>
            </div>

            <div className="login-footer">PSF Forum 2026 · Busan BEXCO</div>
        </div>
    )
}
