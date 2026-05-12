import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const navConfigs = {
    참석자: [
        { path: '/home', icon: HomeIcon, key: 'home' },
        { path: '/notices', icon: BellIcon, key: 'notices' },
        { path: '/attendance', icon: QrIcon, key: 'attendance' },
        { path: '/chat', icon: ChatIcon, key: 'chat' },
        { path: '/chatbot', icon: BotIcon, key: 'chatbot' },
    ],
    인솔자: [
        { path: '/home', icon: HomeIcon, key: 'home' },
        { path: '/notices', icon: BellIcon, key: 'notices' },
        { path: '/gps', icon: GpsIcon, key: 'gps' },
        { path: '/chat', icon: ChatIcon, key: 'chat' },
        { path: '/chatbot', icon: BotIcon, key: 'chatbot' },
    ],
    의전: [
        { path: '/home', icon: HomeIcon, key: 'home' },
        { path: '/notices', icon: BellIcon, key: 'notices' },
        { path: '/dashboard', icon: ChartIcon, key: 'dashboard' },
        { path: '/chat', icon: ChatIcon, key: 'chat' },
        { path: '/chatbot', icon: BotIcon, key: 'chatbot' },
    ],
    사무국: [
        { path: '/home', icon: HomeIcon, key: 'home' },
        { path: '/notices', icon: BellIcon, key: 'notices' },
        { path: '/dashboard', icon: ChartIcon, key: 'dashboard' },
        { path: '/chat', icon: ChatIcon, key: 'chat' },
        { path: '/chatbot', icon: BotIcon, key: 'chatbot' },
    ],
}

export default function BottomNav() {
    const { user, t } = useApp()
    const navigate = useNavigate()
    const location = useLocation()
    if (!user) return null
    const tabs = navConfigs[user.role] || []
    return (
        <nav className="bottom-nav">
            {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = location.pathname === tab.path
                return (
                    <button
                        key={tab.path}
                        className={`nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => navigate(tab.path)}
                    >
                        <Icon />
                        <span>{t[tab.key]}</span>
                    </button>
                )
            })}
        </nav>
    )
}

function HomeIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    )
}
function BellIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
    )
}
function ChatIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    )
}
function BotIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v4" />
            <line x1="8" y1="16" x2="8" y2="16" strokeWidth="3" strokeLinecap="round" />
            <line x1="12" y1="16" x2="12" y2="16" strokeWidth="3" strokeLinecap="round" />
            <line x1="16" y1="16" x2="16" y2="16" strokeWidth="3" strokeLinecap="round" />
        </svg>
    )
}
function GpsIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
            <path d="M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
    )
}
function ChartIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
            <line x1="2" y1="20" x2="22" y2="20" />
        </svg>
    )
}
function QrIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h2v2h-2zM18 14h3M14 18h2M18 18h3M21 21h-3v-3" />
        </svg>
    )
}
