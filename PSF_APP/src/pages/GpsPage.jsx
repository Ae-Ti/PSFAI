import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import { useEffect, useRef } from 'react'
import { updateGpsLocation } from '../api/gps'
import { Geolocation } from '@capacitor/geolocation'

const MAP_LINES_H = [20, 40, 60, 80]
const MAP_LINES_V = [20, 40, 60, 80]

export default function GpsPage() {
    const { t, user, isGpsSending, startGps, stopGps } = useApp()
    const [currentAddress, setCurrentAddress] = useState('')
    const mapRef = useRef(null)
    const markerRef = useRef(null)
    const lastCoordsRef = useRef(null)

    // Helper: Reverse Geocode coordinates to address
    const fetchAddress = (lat, lng, callback) => {
        if (!window.naver || !window.naver.maps || !window.naver.maps.Service) return;
        const latlng = new window.naver.maps.LatLng(lat, lng);
        window.naver.maps.Service.reverseGeocode({
            coords: latlng,
            orders: [
                window.naver.maps.Service.OrderType.ADDR,
                window.naver.maps.Service.OrderType.ROAD_ADDR
            ].join(',')
        }, (status, response) => {
            if (status === window.naver.maps.Service.Status.OK) {
                const result = response?.v2?.address;
                const cleanAddress = result?.jibunAddress || result?.roadAddress || t.gpsAddress;
                setCurrentAddress(cleanAddress);
                if (callback) callback(cleanAddress);
            } else {
                console.error('Initial Reverse Geocode failed');
                if (callback) callback(t.gpsAddress);
            }
        });
    };

    // Initialize Naver Map and Geolocation in parallel
    useEffect(() => {
        // 1. Start getting location immediately for faster UX
        const initLocation = async () => {
            try {
                // 모바일 환경을 위해 위치 권한 먼저 요청
                await Geolocation.requestPermissions();
                
                const pos = await Geolocation.getCurrentPosition({
                    enableHighAccuracy: true,
                    timeout: 30000,
                    maximumAge: 60000
                });
                
                const { latitude, longitude } = pos.coords;
                lastCoordsRef.current = { latitude, longitude };

                // Update map if it exists
                if (window.naver && window.naver.maps) {
                    const loc = new window.naver.maps.LatLng(latitude, longitude);
                    if (mapRef.current) mapRef.current.setCenter(loc);
                    if (markerRef.current) markerRef.current.setPosition(loc);
                }

                // Fetch address immediately
                if (window.naver && window.naver.maps && window.naver.maps.Service) {
                    fetchAddress(latitude, longitude);
                }
            } catch (err) {
                console.warn('Initial position fetch failed:', err);
                alert(`GPS 오류: ${err.message || JSON.stringify(err)}\n(에뮬레이터의 경우 Google Maps 앱을 한 번 실행해주세요)`);
            }
        };

        initLocation();

        // 2. Map rendering logic
        const renderMap = () => {
            if (mapRef.current) return;
            
            try {
                // Use last known coords or BEXCO as fallback
                const initialPos = lastCoordsRef.current 
                    ? new window.naver.maps.LatLng(lastCoordsRef.current.latitude, lastCoordsRef.current.longitude)
                    : new window.naver.maps.LatLng(35.1689, 129.1360);

                const mapOptions = {
                    center: initialPos,
                    zoom: 15,
                    minZoom: 10,
                    mapTypeControl: true
                };
                
                const mapEl = document.getElementById('map-view');
                if (!mapEl) {
                    throw new Error('map-view element not found in DOM');
                }
                
                mapRef.current = new window.naver.maps.Map(mapEl, mapOptions);
                markerRef.current = new window.naver.maps.Marker({
                    position: initialPos,
                    map: mapRef.current,
                });

                // If we already have the address, currentAddress state will handle the UI
                if (lastCoordsRef.current) {
                    fetchAddress(lastCoordsRef.current.latitude, lastCoordsRef.current.longitude);
                }
            } catch (err) {
                console.error('Failed to render map:', err);
                alert(`지도 렌더링 실패: ${err.message}`);
            }
        };

        if (window.naver && window.naver.maps && window.naver.maps.Service) {
            renderMap();
        } else {
            window.initNaverMap = () => {
                renderMap();
            };
        }

        return () => {
            window.initNaverMap = null;
            if (mapRef.current) {
                if (typeof mapRef.current.destroy === 'function') {
                    mapRef.current.destroy();
                }
                mapRef.current = null;
            }
            if (markerRef.current) {
                markerRef.current.setMap(null);
                markerRef.current = null;
            }
        };
    }, []);

    const toggle = () => {
        if (!isGpsSending) {
            startGps();
        } else {
            stopGps();
        }
    }

    // Still use a secondary interval for local UI marker update if the user stays on page
    useEffect(() => {
        let uiInterval = null;
        if (isGpsSending) {
            uiInterval = setInterval(() => {
                Geolocation.getCurrentPosition({ enableHighAccuracy: true })
                    .then((pos) => {
                        const { latitude, longitude } = pos.coords;
                        const latlng = new window.naver.maps.LatLng(latitude, longitude);
                        if (mapRef.current) mapRef.current.setCenter(latlng);
                        if (markerRef.current) markerRef.current.setPosition(latlng);
                        fetchAddress(latitude, longitude);
                    })
                    .catch(console.error);
            }, 10000);
        }
        return () => {
            if (uiInterval) clearInterval(uiInterval);
        };
    }, [isGpsSending]);

    return (
        <div className="app-shell">
            <Header title={t.gpsTitle} />
            <div className="page">
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{t.gpsTitle}</h2>
                <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>{t.gpsDesc}</p>

                {/* Real Naver Map */}
                <div 
                    id="map-view" 
                    style={{ 
                        width: '100%', 
                        height: 300, 
                        borderRadius: 12, 
                        overflow: 'hidden', 
                        marginBottom: 20,
                        backgroundColor: '#e5e7eb',
                        border: '1px solid #e5e7eb'
                    }} 
                />

                {/* Current Location Card */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: isGpsSending ? '#fff5f5' : '#f0fff4',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                        }}>
                            📍
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 13, color: '#6b7280', fontWeight: 500 }}>현재 주소</p>
                            <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 600, color: '#111827' }}>
                                {currentAddress || '위치 정보를 불러오는 중...'}
                            </p>
                        </div>
                    </div>
                    {isGpsSending && (
                        <div style={{
                            marginTop: 12, display: 'flex', alignItems: 'center', gap: 8,
                            background: '#fff5f5', borderRadius: 8, padding: '8px 12px',
                        }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e53e3e', animation: 'blink_dot 1s infinite' }} />
                            <span style={{ fontSize: 13, color: '#e53e3e', fontWeight: 500 }}>
                                {t.gpsSending}...
                            </span>
                        </div>
                    )}
                </div>

                {/* Toggle Button */}
                <button
                    className={`btn ${isGpsSending ? 'btn--danger' : 'btn--primary'}`}
                    id="gps-toggle-btn"
                    onClick={toggle}
                >
                    {isGpsSending ? `⏹ ${t.gpsStop}` : `▶ ${t.gpsStart}`}
                </button>
            </div>
            <BottomNav />
            <style>{`
        @keyframes blink_dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
        </div>
    )
}
