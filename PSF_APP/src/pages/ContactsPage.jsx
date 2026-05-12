import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import { fetchContacts } from '../api/users'

const ROLE_COLOR = { 참석자: '#0056b3', 인솔자: '#d97706', 의전: '#6d28d9', 사무국: '#065f46' }
const ROLE_ORDER = ['사무국', '의전', '인솔자', '참석자']

export default function ContactsPage() {
    const { user, t } = useApp()
    const [search, setSearch] = useState('')
    const [contacts, setContacts] = useState([])

    useEffect(() => {
        fetchContacts().then(setContacts).catch(console.error);
    }, [])

    const filtered = contacts.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
    )

    // Group by role. Backend provides role as enum string like "ATTENDEE", so we need to map to Korean if necessary.
    // Wait, the API returns c.role.name(). Does it map to Korean?
    // Let's use roleMap to convert backend enum to local names for sorting and display.
    const roleMap = { 'ATTENDEE': '참석자', 'GUIDE': '인솔자', 'ESCORT': '의전', 'HQ': '사무국' };
    
    const groups = ROLE_ORDER.reduce((acc, roleKR) => {
        const members = filtered.filter((c) => (roleMap[c.role] || c.role) === roleKR)
        if (members.length > 0) acc.push({ role: roleKR, members })
        return acc
    }, [])

    const roleLabel = { 참석자: t.participant, 인솔자: t.guide, 의전: t.escort, 사무국: t.hq }

    return (
        <div className="app-shell">
            <Header title={t.contactsTitle} />
            <div className="page" style={{ paddingLeft: 0, paddingRight: 0 }}>
                {/* Search */}
                <div style={{ padding: '0 16px 12px' }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{t.contactsTitle}</h2>
                    <div style={{ position: 'relative' }}>
                        <svg
                            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
                            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        >
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            id="contacts-search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t.contactsSearch}
                            style={{
                                width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8,
                                border: '1px solid #e5e7eb', fontFamily: 'Outfit, sans-serif', fontSize: 14,
                                outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                    </div>
                </div>

                {groups.length === 0 ? (
                    <div className="empty-state">{t.noData}</div>
                ) : (
                    groups.map(({ role, members }) => (
                        <div key={role}>
                            <div style={{
                                padding: '8px 16px', background: '#f9fafb',
                                borderTop: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6',
                            }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: ROLE_COLOR[role], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {roleLabel[role]} · {members.length}명
                                </span>
                            </div>
                            {members.map((c) => (
                                <div
                                    key={c.id}
                                    id={`contact-${c.id}`}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '14px 16px', borderBottom: '1px solid #f9fafb',
                                        background: '#fff',
                                    }}
                                >
                                    {/* Avatar */}
                                    <div style={{
                                        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                                        background: ROLE_COLOR[roleMap[c.role] || c.role] || '#6b7280',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 20,
                                    }}>
                                        {c.emoji}
                                    </div>
                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
                                            {c.name} {c.position && c.position.trim() ? <span style={{ fontWeight: 400, fontSize: 13, color: '#6b7280', marginLeft: 4 }}>({c.position})</span> : ''}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#9ca3af' }}>
                                            {c.teamName !== 'All' ? c.teamName : t.hq}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                                            {c.phone || '번호 없음'} · {c.email || '이메일 없음'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>
            <BottomNav />
        </div>
    )
}
