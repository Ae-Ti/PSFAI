import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import ConfirmModal from '../components/ConfirmModal'
import { fetchAllUsers, createUser, updateUser, deleteUser } from '../api/users'

const ROLES = ['참석자', '인솔자', '의전', '사무국']
const TEAMS = ['Team A', 'Team B', 'Team C', 'All']

// Mapping for Backend Enums
const ROLE_MAP = {
    '참석자': 'ATTENDEE',
    '인솔자': 'GUIDE',
    '의전': 'ESCORT',
    '사무국': 'HQ'
}
const REVERSE_ROLE_MAP = {
    'ATTENDEE': '참석자',
    'GUIDE': '인솔자',
    'ESCORT': '의전',
    'HQ': '사무국'
}

const ROLE_COLOR = {
    참석자: '#0056b3', 인솔자: '#d97706', 의전: '#6d28d9', 사무국: '#065f46',
    ATTENDEE: '#0056b3', GUIDE: '#d97706', ESCORT: '#6d28d9', HQ: '#065f46'
}
const ROLE_EMOJI = {
    참석자: '🙋', 인솔자: '🧭', 의전: '🚗', 사무국: '🏢',
    ATTENDEE: '🙋', GUIDE: '🧭', ESCORT: '🚗', HQ: '🏢'
}

const EMPTY_FORM = { username: '', password: '', name: '', role: '참석자', team: 'Team A', email: '', phone: '', position: '' }

export default function AccountsPage() {
    const { t } = useApp()
    const [accounts, setAccounts] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState(EMPTY_FORM)
    const [error, setError] = useState('')
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null })
    const [editingAccountId, setEditingAccountId] = useState(null)

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const data = await fetchAllUsers();
            setAccounts(data);
        } catch (err) {
            console.error(err);
            setError('계정 목록을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAccounts();
    }, []);

    const handleSubmit = async () => {
        setError('')
        if (!form.username.trim() || (!editingAccountId && (!form.password || !form.password.trim())) || !form.name.trim()) {
            setError(editingAccountId ? '이름과 아이디를 입력해주세요.' : '모든 필드를 입력해주세요.')
            return
        }

        const payload = {
            username: form.username.trim(),
            password: form.password,
            name: form.name.trim(),
            role: ROLE_MAP[form.role],
            teamName: form.team,
            email: form.email.trim(),
            phone: form.phone.trim(),
            position: form.position.trim()
        }

        try {
            if (editingAccountId) {
                await updateUser(editingAccountId, payload);
            } else {
                await createUser(payload);
            }
            setForm(EMPTY_FORM)
            setShowForm(false)
            setEditingAccountId(null)
            loadAccounts();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || '계정 저장 중 오류가 발생했습니다.');
        }
    }

    const confirmDelete = async () => {
        const id = deleteConfirm.id;
        if (!id) return;
        try {
            await deleteUser(id);
            setDeleteConfirm({ isOpen: false, id: null });
            loadAccounts();
        } catch (err) {
            console.error(err);
            alert('계정 삭제에 실패했습니다.');
        }
    }

    const startEdit = (acc) => {
        setForm({
            username: acc.username,
            password: '',
            name: acc.name,
            role: REVERSE_ROLE_MAP[acc.role] || acc.role,
            team: acc.teamName || 'Team A',
            email: acc.email || '',
            phone: acc.phone || '',
            position: acc.position || ''
        });
        setEditingAccountId(acc.id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const inputStyle = {
        border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px',
        fontFamily: 'Outfit, sans-serif', fontSize: 14, outline: 'none',
        transition: 'border-color 0.15s', width: '100%', boxSizing: 'border-box',
    }
    const selectStyle = { ...inputStyle, appearance: 'none', background: '#fff' }

    return (
        <div className="app-shell">
            <Header title={t.accountsTitle} />
            <div className="page">
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                        <h2 style={{ fontSize: 20, fontWeight: 700 }}>{t.accountsTitle}</h2>
                        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{accounts.length}개 계정</p>
                    </div>
                    <button
                        className="btn btn--primary btn--sm"
                        id="account-create-btn"
                        onClick={() => { 
                            if (showForm) {
                                setShowForm(false);
                                setEditingAccountId(null);
                                setForm(EMPTY_FORM);
                            } else {
                                setShowForm(true);
                                setError('');
                            }
                        }}
                    >
                        {showForm ? '✕ 취소' : t.accountCreate}
                    </button>
                </div>

                {/* Create form */}
                {showForm && (
                    <div className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }} id="account-form">
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0056b3', marginBottom: 4 }}>{editingAccountId ? '✏️ 계정 수정' : '🔐 계정 생성'}</h3>
                        {[
                            { key: 'username', label: t.accountUsername, type: 'text', ph: '예: user99' },
                            { key: 'password', label: t.accountPassword, type: 'password', ph: editingAccountId ? '변경 시 입력 (공란 시 기존 유지)' : '비밀번호 입력' },
                            { key: 'name', label: t.accountName, type: 'text', ph: '이름 입력' },
                            { key: 'position', label: '직책', type: 'text', ph: '예: 경찰국장, 팀장' },
                            { key: 'email', label: '이메일', type: 'email', ph: 'example@psf.kr' },
                            { key: 'phone', label: '연락처', type: 'tel', ph: '010-0000-0000' },
                        ].map(({ key, label, type, ph }) => (
                            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{label}</label>
                                <input
                                    id={`account-${key}`}
                                    type={type}
                                    value={form[key]}
                                    placeholder={ph}
                                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                                    style={inputStyle}
                                    onFocus={(e) => (e.target.style.borderColor = '#0056b3')}
                                    onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                                />
                            </div>
                        ))}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {/* Role */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{t.accountRole}</label>
                                <select
                                    id="account-role"
                                    value={form.role}
                                    onChange={(e) => {
                                        const r = e.target.value
                                        setForm((f) => ({ ...f, role: r, team: r === '사무국' ? 'All' : f.team }))
                                    }}
                                    style={selectStyle}
                                >
                                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            {/* Team */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{t.accountTeam}</label>
                                <select
                                    id="account-team"
                                    value={form.team}
                                    onChange={(e) => setForm((f) => ({ ...f, team: e.target.value }))}
                                    style={selectStyle}
                                    disabled={form.role === '사무국'}
                                >
                                    {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                        {error && (
                            <p style={{ color: '#e53e3e', fontSize: 13, margin: 0 }}>{error}</p>
                        )}
                        <button
                            className="btn btn--primary"
                            id="account-submit-btn"
                            onClick={handleSubmit}
                        >
                            {editingAccountId ? '수정 완료' : t.accountSubmit}
                        </button>
                    </div>
                )}

                {/* Account list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 40, gap: 12 }}>
                            <div className="spinner" style={{ borderColor: '#0056b3', borderTopColor: 'transparent' }} />
                            <p style={{ fontSize: 13, color: '#9ca3af' }}>계정 목록을 불러오는 중...</p>
                        </div>
                    ) : accounts.length === 0 ? (
                        <div className="empty-state">
                            <p>등록된 계정이 없습니다.</p>
                        </div>
                    ) : (
                        accounts.map((acc) => (
                            <div key={acc.id} className="card" id={`account-${acc.id}`}
                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}
                            >
                                <div style={{
                                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                                    background: ROLE_COLOR[acc.role] || '#6b7280',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                                }}>
                                    {acc.emoji || ROLE_EMOJI[acc.role]}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                        <span style={{ fontWeight: 700, fontSize: 15 }}>{acc.name}</span>
                                        <span style={{
                                            background: ROLE_COLOR[acc.role], color: '#fff',
                                            borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 600,
                                        }}>{REVERSE_ROLE_MAP[acc.role] || acc.role}</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#9ca3af' }}>
                                        @{acc.username} · {acc.teamName || 'N/A'} {acc.position ? `· ${acc.position}` : ''}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                    <button
                                        onClick={() => startEdit(acc)}
                                        style={{ background: 'none', border: '1px solid #f3f4f6', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}
                                    >수정</button>
                                    <button
                                        id={`delete-account-${acc.id}`}
                                        onClick={() => setDeleteConfirm({ isOpen: true, id: acc.id })}
                                        style={{ background: 'none', border: '1px solid #fee2e2', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#fca5a5', cursor: 'pointer' }}
                                    >삭제</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                title="계정 삭제"
                message="정말 이 계정을 삭제하시겠습니까? 관련 데이터가 함께 삭제될 수 있습니다."
                confirmText="삭제"
                confirmColor="#e53e3e"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
            />
            <BottomNav />
        </div>
    )
}
