import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import ConfirmModal from '../components/ConfirmModal'
import { useEffect } from 'react'
import { fetchNotices, createNotice, updateNotice, deleteNotice as apiDeleteNotice, generateAiDraft } from '../api/notices'



export default function NoticesPage() {
    const { user, t } = useApp()
    const [notices, setNotices] = useState([])
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState(null)
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null })

    useEffect(() => {
        fetchNotices()
            .then(data => {
                setNotices(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => {
                setNotices([]);
                setLoading(false);
            });
    }, [])

    const formatDate = (isoStr) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    // Form state
    const [showForm, setShowForm] = useState(false)
    const [newTitle, setNewTitle] = useState('')
    const [newContent, setNewContent] = useState('')
    const [newImportant, setNewImportant] = useState(false)

    // Edit state
    const [editingNoticeId, setEditingNoticeId] = useState(null)
    const [editTitle, setEditTitle] = useState('')
    const [editContent, setEditContent] = useState('')
    const [editImportant, setEditImportant] = useState(false)

    // AI assist state
    const [aiPrompt, setAiPrompt] = useState('')
    const [aiLoading, setAiLoading] = useState(false)

    const toggle = (id) => setExpanded(expanded === id ? null : id)

    const runAiDraft = async () => {
        if (!aiPrompt.trim()) return
        setAiLoading(true)
        try {
            const draft = await generateAiDraft(aiPrompt)
            setNewTitle(draft.title)
            setNewContent(draft.content)
        } catch (err) {
            console.error(err)
            alert("AI 초안 생성에 실패했습니다.")
        } finally {
            setAiLoading(false)
        }
    }

    const addNotice = async () => {
        if (!newTitle.trim() || !newContent.trim()) return
        const notice = {
            title: newTitle.trim(),
            date: new Date().toISOString().slice(0, 10),
            content: newContent.trim(),
            isImportant: newImportant,
        }
        try {
            const saved = await createNotice(notice)
            setNotices([saved, ...notices])
        } catch {
            // handle error
        }
        setNewTitle('')
        setNewContent('')
        setNewImportant(false)
        setAiPrompt('')
        setShowForm(false)
    }

    const confirmDelete = async () => {
        const id = deleteModal.id;
        if (!id) return;
        try {
            await apiDeleteNotice(id)
            setNotices((prev) => prev.filter((n) => n.id !== id))
            if (expanded === id) setExpanded(null)
            if (editingNoticeId === id) setEditingNoticeId(null)
        } catch {
            // handle error
        }
        setDeleteModal({ isOpen: false, id: null });
    }

    const startEdit = (e, notice) => {
        e.stopPropagation();
        setEditingNoticeId(notice.id);
        setEditTitle(notice.title);
        setEditContent(notice.content);
        setEditImportant(notice.isImportant);
        setExpanded(notice.id);
    }

    const handleUpdateNotice = async (id) => {
        if (!editTitle.trim() || !editContent.trim()) return
        const noticeData = {
            title: editTitle.trim(),
            content: editContent.trim(),
            important: editImportant,
        }
        try {
            const updated = await updateNotice(id, noticeData)
            setNotices(notices.map(n => n.id === id ? updated : n))
            setEditingNoticeId(null)
        } catch {
            alert('공지 수정에 실패했습니다.')
        }
    }

    const isHQ = user?.role === '사무국'

    const inputStyle = {
        border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px',
        fontFamily: 'Outfit, sans-serif', fontSize: 14, outline: 'none',
        transition: 'border-color 0.15s', width: '100%', boxSizing: 'border-box',
    }

    return (
        <div className="app-shell">
            <Header title={t.noticesTitle} />
            <div className="page">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700 }}>{t.noticesTitle}</h2>
                    {isHQ && (
                        <button
                            className="btn btn--primary btn--sm"
                            id="add-notice-btn"
                            onClick={() => { setShowForm((v) => !v) }}
                        >
                            {showForm ? '✕ 취소' : '＋ 공지 작성'}
                        </button>
                    )}
                </div>

                {/* HQ notice creation form */}
                {isHQ && showForm && (
                    <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 14 }} id="notice-form">
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0056b3', margin: 0 }}>📢 공지 작성</h3>

                        {/* AI Assist Section */}
                        <div style={{ background: '#f0f7ff', borderRadius: 10, padding: 12 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#0056b3', marginBottom: 8 }}>
                                🤖 {t.aiDraftLabel}
                            </p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    id="ai-draft-prompt"
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    placeholder={t.aiDraftPromptPh}
                                    onKeyDown={(e) => e.key === 'Enter' && runAiDraft()}
                                    style={{ ...inputStyle, flex: 1 }}
                                    onFocus={(e) => (e.target.style.borderColor = '#0056b3')}
                                    onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                                />
                                <button
                                    id="ai-draft-btn"
                                    onClick={runAiDraft}
                                    disabled={aiLoading || !aiPrompt.trim()}
                                    style={{
                                        whiteSpace: 'nowrap', padding: '0 14px', height: 40,
                                        borderRadius: 8, border: 'none',
                                        background: aiLoading ? '#93c5fd' : '#0056b3',
                                        color: '#fff', fontSize: 13, fontWeight: 600,
                                        cursor: aiLoading ? 'not-allowed' : 'pointer',
                                        fontFamily: 'Outfit, sans-serif', flexShrink: 0,
                                    }}
                                >
                                    {aiLoading ? '...' : '생성'}
                                </button>
                            </div>
                            {aiLoading && (
                                <p style={{ fontSize: 12, color: '#0056b3', marginTop: 6, animation: 'pulse 1s infinite' }}>
                                    {t.aiDraftLoading}
                                </p>
                            )}
                        </div>

                        {/* Title */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>제목</label>
                            <input
                                id="notice-title-input"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="공지 제목을 입력하세요"
                                style={inputStyle}
                                onFocus={(e) => (e.target.style.borderColor = '#0056b3')}
                                onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                            />
                        </div>

                        {/* Content */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>내용</label>
                            <textarea
                                id="notice-content-input"
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                placeholder="공지 내용을 입력하세요..."
                                rows={5}
                                style={{ ...inputStyle, resize: 'vertical' }}
                                onFocus={(e) => (e.target.style.borderColor = '#0056b3')}
                                onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                            />
                        </div>

                        {/* 필독 checkbox */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                            <input
                                id="notice-important-check"
                                type="checkbox"
                                checked={newImportant}
                                onChange={(e) => setNewImportant(e.target.checked)}
                                style={{ width: 16, height: 16, accentColor: '#e53e3e' }}
                            />
                            <span style={{ color: '#e53e3e', fontWeight: 600 }}>필독 공지로 표시</span>
                        </label>

                        <button
                            className="btn btn--primary"
                            id="notice-submit-btn"
                            onClick={addNotice}
                            disabled={!newTitle.trim() || !newContent.trim()}
                        >
                            공지 등록
                        </button>
                    </div>
                )}

                {/* Notice list */}
                {notices.map((notice) => (
                    <div
                        key={notice.id}
                        className={`notice-card ${expanded === notice.id ? 'expanded' : ''}`}
                        id={`notice-${notice.id}`}
                    >
                        <div className="notice-card-header" onClick={() => toggle(notice.id)} style={{ cursor: 'pointer' }}>
                            <div style={{ flex: 1 }}>
                                <div className="notice-card-title">{notice.title}</div>
                                <div className="notice-card-date" style={{ fontSize: '11px', marginTop: '4px' }}>
                                    <span>작성: {notice.createdAt ? formatDate(notice.createdAt) : (notice.date || '')}</span>
                                    {notice.updatedAt && notice.updatedAt !== notice.createdAt && (
                                        <span style={{ color: '#9ca3af', marginLeft: '6px' }}>(수정: {formatDate(notice.updatedAt)})</span>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                {notice.isImportant && <span className="badge badge--red">{t.important}</span>}
                                {isHQ && (
                                    <>
                                        <button
                                            onClick={(e) => startEdit(e, notice)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px 4px', fontSize: 14, lineHeight: 1 }}
                                            title="수정"
                                        >✏️</button>
                                        <button
                                            id={`delete-notice-${notice.id}`}
                                            onClick={(e) => { e.stopPropagation(); setDeleteModal({ isOpen: true, id: notice.id }) }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px 4px', fontSize: 16, lineHeight: 1 }}
                                            title="삭제"
                                        >✕</button>
                                    </>
                                )}
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"
                                    style={{ transform: expanded === notice.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </div>
                        </div>
                        {expanded === notice.id && (
                            <div className="notice-card-content">
                                {editingNoticeId === notice.id ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <input
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            style={inputStyle}
                                            placeholder="제목 수정"
                                        />
                                        <textarea
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
                                            placeholder="내용 수정"
                                        />
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                                            <input
                                                type="checkbox"
                                                checked={editImportant}
                                                onChange={(e) => setEditImportant(e.target.checked)}
                                                style={{ width: 16, height: 16, accentColor: '#e53e3e' }}
                                            />
                                            <span style={{ color: '#e53e3e', fontWeight: 600 }}>필독 공지로 표시</span>
                                        </label>
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                                            <button className="btn" onClick={() => setEditingNoticeId(null)} style={{ padding: '6px 14px', height: 32, fontSize: 13, background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer', borderRadius: 8 }}>취소</button>
                                            <button className="btn btn--primary" onClick={() => handleUpdateNotice(notice.id)} style={{ padding: '6px 14px', height: 32, fontSize: 13 }} disabled={!editTitle.trim() || !editContent.trim()}>수정 완료</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ whiteSpace: 'pre-line' }}>{notice.content}</div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <ConfirmModal
                isOpen={deleteModal.isOpen}
                title="공지사항 삭제"
                message="이 공지사항을 정말 삭제하시겠습니까?"
                confirmText="삭제"
                confirmColor="#e53e3e"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModal({ isOpen: false, id: null })}
            />
            <BottomNav />
        </div>
    )
}
