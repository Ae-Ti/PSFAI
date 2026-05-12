import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'

export default function AboutPage() {
    const navigate = useNavigate()
    const mapRef = useRef(null)

    useEffect(() => {
        const renderMap = () => {
            if (mapRef.current) return;
            const bexco = new window.naver.maps.LatLng(35.1689, 129.1360);
            const mapOptions = {
                center: bexco,
                zoom: 16,
                draggable: true,
                scrollWheel: false,
            };
            const map = new window.naver.maps.Map('about-map', mapOptions);
            mapRef.current = map;

            new window.naver.maps.Marker({
                position: bexco,
                map: map,
                title: 'BEXCO 제1전시장'
            });
        };

        if (window.naver && window.naver.maps) {
            renderMap();
        } else {
            window.initNaverMap = () => renderMap();
        }

        return () => {
            window.initNaverMap = null;
        };
    }, []);

    return (
        <div className="app-shell" style={{ overflowY: 'auto' }}>
            <Header title="포럼 둘러보기" />
            <div className="page" style={{ padding: '24px 16px' }}>
                <button 
                    onClick={() => navigate('/')} 
                    style={{ 
                        background: 'none', border: 'none', color: '#0056b3', 
                        fontSize: 15, fontWeight: 700, padding: 0, marginBottom: 20, 
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    뒤로가기
                </button>

                <div className="card" style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0056b3', marginBottom: 12 }}>개요</h2>
                    <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
                        PSF Forum 2026은 글로벌 리더들과 함께 미래의 지속 가능한 발전을 논의하는 국제 포럼입니다. 
                        다양한 분야의 전문가들이 모여 혁신적인 아이디어를 공유하고 협력을 다집니다.
                    </p>
                </div>

                <div className="card" style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0056b3', marginBottom: 12 }}>연혁</h2>
                    <ul style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, paddingLeft: 20, margin: 0 }}>
                        <li><strong>2026:</strong> 부산 BEXCO 제1전시장 제1회 개최</li>
                        <li><strong>2025:</strong> 포럼 준비 위원회 발족</li>
                        <li><strong>2024:</strong> 비전 선포 및 기획</li>
                    </ul>
                </div>

                <div className="card" style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0056b3', marginBottom: 12 }}>오시는 길</h2>
                    <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 8 }}>
                        <strong>부산 BEXCO 제1전시장</strong><br />
                        부산광역시 해운대구 APEC로 55
                    </p>
                    <div 
                        id="about-map"
                        style={{ 
                            height: 200, background: '#e5e7eb', borderRadius: 8, 
                            border: '1px solid #d1d5db',
                            overflow: 'hidden'
                        }}
                    >
                    </div>
                </div>
            </div>
        </div>
    )
}
