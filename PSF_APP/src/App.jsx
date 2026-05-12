import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import NoticesPage from './pages/NoticesPage'
import AttendancePage from './pages/AttendancePage'
import GpsPage from './pages/GpsPage'
import DashboardPage from './pages/DashboardPage'
import ChatPage from './pages/ChatPage'
import ChatbotPage from './pages/ChatbotPage'
import ProfilePage from './pages/ProfilePage'
import ContactsPage from './pages/ContactsPage'
import AccountsPage from './pages/AccountsPage'
import AboutPage from './pages/AboutPage'

function AuthGuard({ children, allowedRoles }) {
    const { user } = useApp()
    if (!user) return <Navigate to="/" replace />
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/home" replace />
    }
    return children
}

function AppRoutes() {
    const { user } = useApp()
    return (
        <Routes>
            <Route path="/" element={user ? <Navigate to="/home" replace /> : <LoginPage />} />
            <Route path="/home" element={<AuthGuard><HomePage /></AuthGuard>} />
            <Route path="/notices" element={<AuthGuard><NoticesPage /></AuthGuard>} />
            <Route path="/attendance" element={<AuthGuard allowedRoles={['참석자']}><AttendancePage /></AuthGuard>} />
            <Route path="/gps" element={<AuthGuard allowedRoles={['인솔자']}><GpsPage /></AuthGuard>} />
            <Route path="/dashboard" element={<AuthGuard allowedRoles={['의전', '사무국']}><DashboardPage /></AuthGuard>} />
            <Route path="/chat" element={<AuthGuard allowedRoles={['참석자', '인솔자', '의전', '사무국']}><ChatPage /></AuthGuard>} />
            <Route path="/chatbot" element={<AuthGuard><ChatbotPage /></AuthGuard>} />
            <Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />
            <Route path="/contacts" element={<AuthGuard><ContactsPage /></AuthGuard>} />
            <Route path="/accounts" element={<AuthGuard allowedRoles={['사무국']}><AccountsPage /></AuthGuard>} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default function App() {
    return (
        <AppProvider>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AppProvider>
    )
}
