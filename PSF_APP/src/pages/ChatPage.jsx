import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import { useEffect, useRef } from 'react'
import { fetchRooms, fetchMessages, sendMessage as apiSendMessage } from '../api/chat'



export default function ChatPage() {
    const { user, t } = useApp()
    const [rooms, setRooms] = useState([])
    const [selectedRoom, setSelectedRoom] = useState(null)
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const bottomRef = useRef(null)

    useEffect(() => {
        fetchRooms().then(setRooms).catch(console.error)
    }, [])

    useEffect(() => {
        if (!selectedRoom) return;

        const load = () => {
            fetchMessages(selectedRoom).then(data => {
                const mapped = data.map(m => ({
                    id: m.id,
                    sender: m.sender.name,
                    role: m.sender.role,
                    me: m.sender.username === user.username,
                    text: m.content,
                    time: new Date(m.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                }));
                setMessages(mapped);
            }).catch(console.error);
        };

        load();
        const tid = setInterval(load, 3000); // 3초마다 폴링
        return () => clearInterval(tid);
    }, [selectedRoom, user]);


    const sendMessage = async () => {
        if (!input.trim() || !selectedRoom) return
        const text = input.trim();
        setInput('');
        try {
            await apiSendMessage(selectedRoom, text);
            // After sending, immediate fetch or optimistic UI could go here
            fetchMessages(selectedRoom).then(data => {
                const mapped = data.map(m => ({
                    id: m.id,
                    sender: m.sender.name,
                    role: m.sender.role,
                    me: m.sender.username === user.username,
                    text: m.content,
                    time: new Date(m.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                }));
                setMessages(mapped);
            });
        } catch (err) {
            console.error(err);
            alert("메시지 전송에 실패했습니다.");
        }
    }

    if (selectedRoom) {
        const room = rooms.find((r) => r.id === selectedRoom)
        const msgs = messages || []
        return (
            <div className="app-shell">
                <Header title={room?.name} onBack={() => setSelectedRoom(null)} />
                <div
                    className="page"
                    style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 120 }}
                >
                    <div className="chat-messages" id="chat-messages">
                        {msgs.map((msg) => (
                            <div key={msg.id} className={`msg-row ${msg.me ? 'msg-row--me' : ''}`}>
                                {!msg.me && (
                                    <div className="avatar avatar--blue" style={{ width: 32, height: 32, fontSize: 12 }}>
                                        {msg.sender[0]}
                                    </div>
                                )}
                                <div>
                                    {!msg.me && (
                                        <div className="msg-name">
                                            {msg.sender}
                                            <span className="badge badge--gray" style={{ marginLeft: 4, fontSize: 10 }}>
                                                {msg.role}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`msg-bubble ${msg.me ? 'msg-bubble--me' : 'msg-bubble--other'}`}>
                                        {msg.text}
                                    </div>
                                    <div className="msg-time" style={{ textAlign: msg.me ? 'right' : 'left' }}>
                                        {msg.time}
                                    </div>
                                </div>
                            </div>
                        ))}
                    <div ref={bottomRef} />
                </div>
                <div className="chat-input-bar" id="chat-input-bar">
                    <input
                        className="chat-input"
                        id="chat-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={t.chatPlaceholder}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                sendMessage();
                            }
                        }}
                    />
                    <button className="chat-send-btn" id="chat-send-btn" onClick={sendMessage}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </button>
                </div>
            </div>
            <BottomNav />
        </div>
        )
    }

    return (
        <div className="app-shell">
            <Header title={t.chatTitle} />
            <div className="page" style={{ paddingLeft: 0, paddingRight: 0 }}>
                <div style={{ padding: '0 16px 12px' }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700 }}>{t.chatTitle}</h2>
                    <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                        {rooms.length}개 채팅방 참여 중
                    </p>
                </div>
                {rooms.length === 0 ? (
                    <div className="empty-state">{t.noData}</div>
                ) : (
                    rooms.map((room) => (
                        <div
                            key={room.id}
                            className="chat-room-item"
                            id={`room-${room.id}`}
                            onClick={() => setSelectedRoom(room.id)}
                        >
                            <div
                                className="avatar avatar--blue"
                                style={{
                                    width: 44, height: 44, fontSize: 18,
                                    background: room.type === 'ESCORT' ? '#0056b3' : '#38a169',
                                }}
                            >
                                {room.type === 'ESCORT' ? '🚗' : room.type === 'STAFF' ? '🏢' : '👥'}
                            </div>
                            <div className="chat-room-info">
                                <div className="chat-room-name">{room.name}</div>
                                <div className="chat-room-preview">채팅방에 접속하여 대화를 확인하세요</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                <div className="chat-room-time">-</div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <BottomNav />
        </div>
    )
}
