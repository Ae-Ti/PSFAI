import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import ConfirmModal from '../components/ConfirmModal'
import { useEffect, useRef } from 'react'
import { fetchDashboardStats, fetchDashboardNotes, fetchDashboardAttendees, createDashboardNote, updateDashboardNote, deleteDashboardNote } from '../api/dashboard'
import { fetchGpsLocations } from '../api/gps'
import { resetAttendance } from '../api/attendance'
import HistoryModal from '../components/HistoryModal'

const COLORS = ['#0056b3', '#e5e7eb']

function DashboardMap({ latitude, longitude, id }) {
    const mapRef = useRef(null);

    useEffect(() => {
        if (!window.naver || !window.naver.maps) return;
        const loc = new window.naver.maps.LatLng(latitude, longitude);
        const mapOptions = {
            center: loc,
            zoom: 15,
            minZoom: 10,
            mapTypeControl: true,
        };
        const map = new window.naver.maps.Map(`map-${id}`, mapOptions);
        mapRef.current = map;
        new window.naver.maps.Marker({
            position: loc,
            map: map
        });
    }, [latitude, longitude, id]);

    return (
        <div id={`map-${id}`} style={{ width: '100%', height: 200, marginTop: 12, borderRadius: 8, background: '#f3f4f6', overflow: 'hidden' }}>
            {!window.naver && <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>지도 로딩 중...</div>}
        </div>
    );
}

export default function DashboardPage() {
    const { user, t } = useApp()
    const [stats, setStats] = useState({ total: 0, attended: 0, missing: 0 })
    const [notes, setNotes] = useState([])
    const [guides, setGuides] = useState([])
    const [noteInput, setNoteInput] = useState('')
    const [editingNoteId, setEditingNoteId] = useState(null)
    const [editInput, setEditInput] = useState('')
    const [attendees, setAttendees] = useState([])
    const [showAttendeesModal, setShowAttendeesModal] = useState(false)
    const [attendeeFilter, setAttendeeFilter] = useState('all')
    const [expandedGuideId, setExpandedGuideId] = useState(null)
    const [deleteNoteConfirm, setDeleteNoteConfirm] = useState({ isOpen: false, id: null })
    const [showResetConfirm, setShowResetConfirm] = useState(false)
    const [showHistoryModal, setShowHistoryModal] = useState(false)

    const isEscort = user?.role === '의전'
    const isHQ = user?.role === '사무국'

    useEffect(() => {
        const refreshData = () => {
            fetchDashboardStats().then(setStats).catch(console.error);
            fetchGpsLocations().then(setGuides).catch(console.error);
            // Optionally refresh notes and attendees less frequently or only on mount
        };

        refreshData(); // Initial load
        fetchDashboardNotes().then(setNotes).catch(console.error);
        fetchDashboardAttendees().then(setAttendees).catch(console.error);

        const pollId = setInterval(refreshData, 10000); // Poll every 10s
        return () => clearInterval(pollId);
    }, [])

    const openAttendeesModal = async (filter) => {
        setAttendeeFilter(filter);
        try {
            const data = await fetchDashboardAttendees();
            setAttendees(data);
            setShowAttendeesModal(true);
        } catch (err) {
            console.error('Failed to fetch attendees:', err);
            alert('명단을 불러오지 못했습니다.');
        }
    }

    // GPS visibility: 의전 → own team only / 사무국 → all
    const pieData = [
        { name: t.attended, value: stats.attended },
        { name: t.missing, value: stats.missing },
    ]

    const addNote = async () => {
        if (!noteInput.trim()) return
        try {
            const saved = await createDashboardNote(noteInput.trim());
            setNotes([saved, ...notes]);
            setNoteInput('');
        } catch (err) {
            console.error(err);
            alert("특이사항 등록에 실패했습니다.");
        }
    }

    const startEdit = (note) => {
        setEditingNoteId(note.id)
        setEditInput(note.content)
    }

    const handleUpdate = async () => {
        if (!editInput.trim()) return
        try {
            const updated = await updateDashboardNote(editingNoteId, editInput.trim());
            setNotes(notes.map(n => n.id === updated.id ? updated : n));
            setEditingNoteId(null);
            setEditInput('');
        } catch (err) {
            console.error(err);
            alert("특이사항 수정에 실패했습니다.");
        }
    }

    const confirmDeleteNote = async () => {
        const id = deleteNoteConfirm.id;
        if (!id) return;
        try {
            await deleteDashboardNote(id);
            setNotes(notes.filter(n => n.id !== id));
        } catch (err) {
            console.error(err);
            alert("특이사항 삭제에 실패했습니다.");
        }
        setDeleteNoteConfirm({ isOpen: false, id: null });
    }

    const handleResetAttendance = async () => {
        try {
            await resetAttendance();
            setShowResetConfirm(false);
            // Refresh stats and attendants
            const newStats = await fetchDashboardStats();
            setStats(newStats);
            if (showAttendeesModal) {
                const data = await fetchDashboardAttendees();
                setAttendees(data);
            }
            alert('출석 기록이 마감되었습니다.');
        } catch (err) {
            console.error(err);
            alert('출석 초기화에 실패했습니다.');
        }
    }



    return (
        <div className="app-shell">
            <Header title={t.dashboardTitle} />
            <div className="page">
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px 0' }}>
                    {isEscort ? `(${user?.teamName || 'Team'}) ${t.dashboardTitle}` : t.dashboardTitle}
                </h2>
                <p className="section-title" style={{ marginBottom: 12 }}>실시간 출석 현황</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 16 }}>
                    {isHQ && (
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button 
                                className="btn btn--sm" 
                                style={{ background: '#f3f4f6', color: '#4b5563', border: 'none', padding: '6px 10px' }}
                                onClick={() => setShowHistoryModal(true)}
                            >
                                내역 열람
                            </button>
                            <button 
                                className="btn btn--secondary btn--sm" 
                                style={{ color: '#0056b3', borderColor: '#0056b3', background: '#fff' }}
                                onClick={() => setShowResetConfirm(true)}
                            >
                                🏁 출석 마감
                            </button>
                        </div>
                    )}
                </div>

                {/* Stats Row */}
                <div className="stat-row">
                    <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => openAttendeesModal('all')}>
                        <div className="stat-num" style={{ color: '#374151' }}>{stats.total}</div>
                        <div className="stat-label">{t.totalAtt}</div>
                    </div>
                    <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => openAttendeesModal('attended')}>
                        <div className="stat-num" style={{ color: '#0056b3' }}>{stats.attended}</div>
                        <div className="stat-label">{t.attended}</div>
                    </div>
                    <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => openAttendeesModal('missing')}>
                        <div className="stat-num" style={{ color: '#e53e3e' }}>{stats.missing}</div>
                        <div className="stat-label">{t.missing}</div>
                    </div>
                </div>

                {/* Donut Chart */}
                <div className="chart-container">
                    <ResponsiveContainer width={140} height={140}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={60}
                                paddingAngle={2}
                                dataKey="value"
                                startAngle={90}
                                endAngle={-270}
                            >
                                {pieData.map((_, index) => (
                                    <Cell key={index} fill={COLORS[index]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(v, n) => [v + '명', n]} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="chart-legend">
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                            출석률 {Math.round((stats.attended / stats.total) * 100)}%
                        </div>
                        {pieData.map((d, i) => (
                            <div key={i} className="legend-item">
                                <div className="legend-dot" style={{ background: COLORS[i] }} />
                                <span>{d.name}: {d.value}명</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Guide Locations */}
                <p className="section-title" style={{ marginTop: 0 }}>
                    {t.guideLocations}
                    <span style={{ fontWeight: 400, marginLeft: 6, textTransform: 'none', color: '#9ca3af' }}>
                        {isHQ ? '(전체)' : `(${user?.teamName || user?.team})`}
                    </span>
                </p>
                <div className="card" style={{ marginBottom: 20 }}>
                    {guides.length === 0 ? (
                        <div style={{ color: '#9ca3af', fontSize: 13, padding: '8px 0' }}>해당 팀 인솔자 없음</div>
                    ) : guides.map((g) => (
                        <div key={g.guideId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <div 
                                className="location-item" 
                                style={{ cursor: g.isTransmitting ? 'pointer' : 'default', borderBottom: 'none' }}
                                onClick={() => {
                                    if (g.isTransmitting) {
                                        setExpandedGuideId(expandedGuideId === g.guideId ? null : g.guideId);
                                    }
                                }}
                            >
                                <div
                                    className="location-dot"
                                    style={{ background: g.isTransmitting ? '#38a169' : '#d1d5db' }}
                                />
                                <div>
                                    <div className="location-item-name">{g.guide?.name || '인솔자 정보 없음'}</div>
                                    <div className="location-item-addr">{g.isTransmitting ? g.address : '위치 정보 없음'}</div>
                                </div>
                                <span className="badge" style={{ marginLeft: 'auto', ...(g.isTransmitting ? { background: '#f0fff4', color: '#38a169' } : { background: '#f3f4f6', color: '#9ca3af' }) }}>
                                    {g.isTransmitting ? '송신 중' : '대기'}
                                </span>
                            </div>
                            {expandedGuideId === g.guideId && g.latitude && g.longitude && (
                                <div style={{ padding: '0 0 16px 0' }}>
                                    <DashboardMap latitude={g.latitude} longitude={g.longitude} id={g.guideId} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Notes */}
                <p className="section-title">{t.notes}</p>
                <div className="card">
                    {notes.map((note) => (
                        <div key={note.id} className="note-item" id={`note-${note.id}`} style={{ alignItems: 'flex-start' }}>
                            <div className="avatar avatar--blue" style={{ width: 32, height: 32, fontSize: 12, marginTop: 2 }}>
                                {note.author?.name ? note.author.name[0] : '?'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                {editingNoteId === note.id ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <textarea
                                            value={editInput}
                                            onChange={(e) => setEditInput(e.target.value)}
                                            style={{
                                                width: '100%', border: '1px solid var(--color-primary)', borderRadius: 8,
                                                padding: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none',
                                                resize: 'none', overflowY: 'auto', minHeight: '60px'
                                            }}
                                            rows={2}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                                    e.preventDefault();
                                                    handleUpdate();
                                                }
                                            }}
                                        />
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn--primary btn--sm" onClick={handleUpdate} style={{ height: 28 }}>저장</button>
                                            <button className="btn btn--secondary btn--sm" onClick={() => setEditingNoteId(null)} style={{ height: 28 }}>취소</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="note-content">{note.content}</div>
                                        <div className="note-meta">
                                            {note.author?.name || '알 수 없음'} · {new Date(note.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </>
                                )}
                            </div>
                            {(isHQ || note.author?.id === user?.id) && !editingNoteId && (
                                <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                                    <button onClick={() => startEdit(note)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>
                                    </button>
                                    <button onClick={() => setDeleteNoteConfirm({ isOpen: true, id: note.id })} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 4 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}

                    {isEscort && (
                        <div className="note-input-row" id="note-input-row">
                            <textarea
                                className="note-input"
                                id="note-input"
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                placeholder={t.noteInput}
                                rows={2}
                                style={{ resize: 'none', overflowY: 'auto', minHeight: '60px' }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                        e.preventDefault();
                                        addNote();
                                    }
                                }}
                            />
                            <button
                                className="btn btn--primary btn--sm"
                                id="note-submit-btn"
                                onClick={addNote}
                            >
                                {t.noteSubmit}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <BottomNav />

            {/* Attendees Modal */}
            {showAttendeesModal && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 2000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 20
                }} onClick={() => setShowAttendeesModal(false)}>
                    <div style={{
                        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400,
                        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
                        overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                                {attendeeFilter === 'all' ? '전체 인원' : attendeeFilter === 'attended' ? '출석 명단' : '미출석 명단'} 
                                <span style={{ color: '#0056b3', marginLeft: 8 }}>
                                    {attendees.filter(a => attendeeFilter === 'all' ? true : attendeeFilter === 'attended' ? a.attended : !a.attended).length}명
                                </span>
                            </h3>
                            <button onClick={() => setShowAttendeesModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6b7280' }}>&times;</button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {attendees.filter(a => attendeeFilter === 'all' ? true : attendeeFilter === 'attended' ? a.attended : !a.attended).map(a => (
                                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#f9fafb' }}>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{a.name}</div>
                                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{a.teamName}</div>
                                    </div>
                                    {a.attended ? (
                                        <span className="badge badge--green" style={{ padding: '6px 12px', fontSize: 12 }}>출석</span>
                                    ) : (
                                        <span className="badge badge--red" style={{ padding: '6px 12px', fontSize: 12 }}>미출석</span>
                                    )}
                                </div>
                            ))}
                            {attendees.filter(a => attendeeFilter === 'all' ? true : attendeeFilter === 'attended' ? a.attended : !a.attended).length === 0 && (
                                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0', fontSize: 14 }}>해당하는 인원이 없습니다.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            <ConfirmModal
                isOpen={deleteNoteConfirm.isOpen}
                title="특이사항 삭제"
                message="정말 이 특이사항을 삭제하시겠습니까?"
                confirmText="삭제"
                confirmColor="#e53e3e"
                onConfirm={confirmDeleteNote}
                onCancel={() => setDeleteNoteConfirm({ isOpen: false, id: null })}
            />

            <ConfirmModal
                isOpen={showResetConfirm}
                title="출석 기록 마감"
                message="전체 인원의 출석 기록을 마감하시겠습니까? 마감 전 상태는 히스토리로 저장됩니다."
                confirmText="마감"
                confirmColor="#e53e3e"
                onConfirm={handleResetAttendance}
                onCancel={() => setShowResetConfirm(false)}
            />

            <HistoryModal 
                isOpen={showHistoryModal} 
                onClose={() => setShowHistoryModal(false)} 
            />
        </div>
    )
}
