import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import { fetchChatbotHistory, sendChatbotMessage } from '../api/chatbot'

export default function ChatbotPage() {
    const { user, t } = useApp()
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const bottomRef = useRef(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isTyping])

    useEffect(() => {
        fetchChatbotHistory().then(data => {
            const mapped = data.map(m => ({
                id: m.id,
                type: m.senderType,
                message: m.message
            }));
            setMessages(mapped);
        }).catch(console.error);
    }, []);

    const send = async (text) => {
        const userMsg = text || input.trim()
        if (!userMsg) return
        setInput('')

        const userBubble = { id: Date.now(), type: 'user', message: userMsg }
        setMessages((prev) => [...prev, userBubble])
        setIsTyping(true)

        try {
            const res = await sendChatbotMessage(userMsg);
            const botReply = { id: res.id, type: 'bot', message: res.message };
            setMessages((prev) => [...prev, botReply]);
        } catch (err) {
            console.error(err);
            alert("챗봇 응답에 실패했습니다.");
        } finally {
            setIsTyping(false);
        }
    }

    const QUICK = [
        { label: t.quickQ1, text: '관광' },
        { label: t.quickQ2, text: '다이소' },
        { label: '🍽 식당 추천', text: '식당' },
        { label: '🚌 교통 안내', text: '교통' },
    ]

    return (
        <div className="app-shell">
            <Header title={t.chatbotTitle} />
            <div className="page" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 'calc(var(--nav-h) + 130px)' }}>
                <div style={{ padding: '0 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700 }}>{t.chatbotTitle}</h2>
                    <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        {user?.name} · PSF Forum 2026
                    </p>
                </div>

                {/* Quick Buttons */}
                <div className="quick-btns" style={{ padding: '12px 16px 0' }}>
                    {QUICK.map((q) => (
                        <button
                            key={q.text}
                            className="quick-btn"
                            id={`quick-${q.text}`}
                            onClick={() => send(q.text)}
                        >
                            {q.label}
                        </button>
                    ))}
                </div>

                <div className="chatbot-messages" id="chatbot-messages">
                    {messages.map((msg) =>
                        msg.type === 'bot' ? (
                            <div key={msg.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                                <div style={{
                                    width: 32, height: 32, borderRadius: '50%',
                                    background: '#0056b3', color: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 14, flexShrink: 0,
                                }}>
                                    🤖
                                </div>
                                <div className="bot-bubble" style={{ whiteSpace: 'pre-line' }}>{msg.message}</div>
                            </div>
                        ) : (
                            <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <div className="user-bubble">{msg.message}</div>
                            </div>
                        )
                    )}
                    {isTyping && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: '#0056b3', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14, flexShrink: 0,
                            }}>
                                🤖
                            </div>
                            <div className="bot-bubble" id="typing-indicator">
                                <span className="typing-dot" />
                                <span className="typing-dot" />
                                <span className="typing-dot" />
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* Input Bar */}
            <div className="chatbot-input-bar" id="chatbot-input-bar">
                <input
                    className="chat-input"
                    id="chatbot-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t.chatbotPlaceholder}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                />
                <button className="chat-send-btn" id="chatbot-send-btn" onClick={() => send()}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </div>

            <BottomNav />
        </div>
    )
}
