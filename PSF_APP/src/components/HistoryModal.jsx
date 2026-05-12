import { useState, useEffect } from 'react'
import { fetchSnapshots, fetchSnapshotDetails, downloadSnapshotCsv } from '../api/attendance'

export default function HistoryModal({ isOpen, onClose }) {
    const roleKorean = { ATTENDEE: '참석자', GUIDE: '인솔자', ESCORT: '의전', HQ: '사무국' };
    const [historyList, setHistoryList] = useState([])
    const [selectedSnapshot, setSelectedSnapshot] = useState(null)
    const [snapshotDetails, setSnapshotDetails] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [downloading, setDownloading] = useState(false)

    useEffect(() => {
        if (isOpen) {
            loadHistoryList();
        } else {
            // Reset state when closed
            setSelectedSnapshot(null);
            setSnapshotDetails([]);
        }
    }, [isOpen]);

    const loadHistoryList = async () => {
        setLoadingHistory(true);
        try {
            const data = await fetchSnapshots();
            setHistoryList(data);
        } catch (err) {
            console.error('Failed to fetch history list:', err);
        } finally {
            setLoadingHistory(false);
        }
    }

    const [csvBlob, setCsvBlob] = useState(null)

    const loadSnapshotDetails = async (snapshot) => {
        setLoadingHistory(true);
        setSelectedSnapshot(snapshot);
        setCsvBlob(null);
        try {
            const data = await fetchSnapshotDetails(snapshot.id);
            setSnapshotDetails(data);
        } catch (err) {
            console.error('Failed to fetch snapshot details:', err);
        } finally {
            setLoadingHistory(false);
        }
    }

    const generateAndDownloadCsv = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (!selectedSnapshot || snapshotDetails.length === 0) return;

        const roleKorean = { ATTENDEE: '참석자', GUIDE: '인솔자', ESCORT: '의전', HQ: '사무국' };
        const resetTime = selectedSnapshot.resetAt
            ? new Date(selectedSnapshot.resetAt).toLocaleString('ko-KR')
            : '';
        const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

        // Generate CSV directly from in-memory data (synchronous — no async, no library needed)
        const BOM = '\uFEFF';
        const header = ['기록일시', '이름', '팀', '역할', '출석여부'].map(escape).join(',');
        const dataRows = snapshotDetails.map(d => [
            resetTime,
            d.userName || '',
            d.userTeam || '',
            roleKorean[d.userRole] || d.userRole || '',
            d.attended ? '출석' : '미출석'
        ].map(escape).join(',')).join('\r\n');

        const csv = BOM + header + '\r\n' + dataRows;

        // Build filename
        let fileName = 'attendance.csv';
        if (selectedSnapshot.resetAt) {
            try {
                const d = new Date(selectedSnapshot.resetAt);
                const pad = (n) => String(n).padStart(2, '0');
                fileName = `attendance_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.csv`;
            } catch (_) {}
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { a.parentNode && a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 30000);
    }

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 2100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20
        }} onClick={onClose}>
            <div style={{
                background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500,
                maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', boxShadow: '0 15px 35px rgba(0,0,0,0.2)'
            }} onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                        {selectedSnapshot ? '상세 출석 내역' : '출석 내역'}
                    </h3>
                    <button onClick={() => { 
                        if (selectedSnapshot) {
                            setSelectedSnapshot(null);
                            setSnapshotDetails([]);
                        } else {
                            onClose();
                        }
                    }} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6b7280' }}>
                        {selectedSnapshot ? '←' : '×'}
                    </button>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                    {loadingHistory ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                            <div className="spinner" style={{ borderColor: '#0056b3', borderTopColor: 'transparent' }} />
                        </div>
                    ) : selectedSnapshot ? (
                        <div>
                            <div style={{ background: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 16, border: '1px solid #e5e7eb' }}>
                                <div style={{ fontSize: 14, color: '#4b5563', marginBottom: 4 }}>
                                    마감 시간: <strong>{new Date(selectedSnapshot.resetAt).toLocaleString()}</strong>
                                </div>
                                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                                    통계: 총 {selectedSnapshot.totalCount}명 / 출석 {selectedSnapshot.attendedCount}명 ({(selectedSnapshot.attendedCount/selectedSnapshot.totalCount*100).toFixed(1)}%)
                                </div>
                                
                                <button 
                                    onClick={generateAndDownloadCsv}
                                    disabled={downloading}
                                    style={{ 
                                        width: '100%', background: downloading ? '#9ca3af' : '#0056b3', color: '#fff', 
                                        border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 600,
                                        cursor: downloading ? 'not-allowed' : 'pointer', 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                                    }}
                                >
                                    {downloading ? '다운로드 중...' : '⬇️ 출석 내역 다운로드 (.csv)'}
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {snapshotDetails.map(d => (
                                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #f3f4f6', borderRadius: 8 }}>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 600 }}>{d.userName}</div>
                                            <div style={{ fontSize: 11, color: '#9ca3af' }}>{d.userTeam} · {roleKorean[d.userRole] || d.userRole}</div>
                                        </div>
                                        <span 
                                            style={{ 
                                                fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6,
                                                background: d.attended ? '#ecfdf5' : '#fef2f2',
                                                color: d.attended ? '#10b981' : '#ef4444'
                                            }}
                                        >
                                            {d.attended ? '출석' : '미출석'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : historyList.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>저장된 내역이 없습니다.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {historyList.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => loadSnapshotDetails(item)}
                                    style={{ 
                                        padding: '16px', border: '1px solid #e5e7eb', borderRadius: 12, 
                                        cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                                >
                                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                                        {new Date(item.resetAt).toLocaleString()}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>담당자: {item.resetByName}</span>
                                        <span style={{ color: '#0056b3', fontWeight: 600 }}>
                                            {item.attendedCount}/{item.totalCount}명 출석
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
