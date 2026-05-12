import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const HIDE_BACK = ['/home', '/']

export default function Header({ title, onBack }) {
    const { user, t, language, setLanguage } = useApp()
    const navigate = useNavigate()
    const location = useLocation()
    const showBack = !HIDE_BACK.includes(location.pathname)

    return (
        <header className="header">
            <div>
                {showBack ? (
                    <button 
                        className="header__back" 
                        onClick={() => onBack ? onBack() : navigate('/home')} 
                        id="header-back-btn"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                        {title || ''}
                    </button>
                ) : (
                    <span className="header__logo">PSF</span>
                )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    id="lang-select"
                    className="header__lang"
                >
                    <option value="KO">🇰🇷 KO</option>
                    <option value="EN">🇺🇸 EN</option>
                    <option value="FR">🇫🇷 FR</option>
                </select>
                {/* Profile button — always show when logged in */}
                {user && (
                    <button
                        id="header-profile-btn"
                        onClick={() => navigate('/profile')}
                        title={t.profileTitle}
                        style={{
                            width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
                            background: '#f0f7ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, flexShrink: 0,
                        }}
                    >
                        {user.emoji || '👤'}
                    </button>
                )}
            </div>
        </header>
    )
}
