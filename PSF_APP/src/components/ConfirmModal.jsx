import React from 'react';

/**
 * ConfirmModal Component
 * A premium custom modal to replace window.confirm
 */
export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText, cancelText, isDanger }) {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '320px',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                animation: 'modalFadeIn 0.2s ease-out'
            }}>
                <div style={{ padding: '24px 20px 16px' }}>
                    <h3 style={{ 
                        margin: '0 0 8px', 
                        fontSize: '18px', 
                        fontWeight: '700', 
                        color: '#111827',
                        textAlign: 'center'
                    }}>
                        {title}
                    </h3>
                    <p style={{ 
                        margin: 0, 
                        fontSize: '14px', 
                        color: '#6b7280', 
                        textAlign: 'center',
                        lineHeight: '1.5'
                    }}>
                        {message}
                    </p>
                </div>
                
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    padding: '12px 20px 20px',
                    gap: '8px'
                }}>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '12px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: isDanger ? '#ef4444' : '#0056b3',
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                        }}
                    >
                        {confirmText || '확인'}
                    </button>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '12px',
                            borderRadius: '10px',
                            border: '1px solid #e5e7eb',
                            backgroundColor: '#fff',
                            color: '#4b5563',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                        }}
                    >
                        {cancelText || '취소'}
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes modalFadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}
