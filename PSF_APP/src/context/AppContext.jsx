import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { translations } from '../i18n/translations'
import { updateGpsLocation } from '../api/gps'

const AppContext = createContext(null)

export function AppProvider({ children }) {
    const normalizeRole = (role) => {
        const roleMap = {
            'ATTENDEE': '참석자',
            'GUIDE': '인솔자',
            'ESCORT': '의전',
            'HQ': '사무국',
            '본부': '사무국'
        };
        return roleMap[role] || role;
    };

    const [user, setUser] = useState(() => {
        const stored = sessionStorage.getItem('psf_user');
        if (!stored) return null;
        try {
            const parsed = JSON.parse(stored);
            if (parsed) {
                const normalizedRole = normalizeRole(parsed.role);
                if (parsed.role !== normalizedRole) {
                    parsed.role = normalizedRole;
                    sessionStorage.setItem('psf_user', JSON.stringify(parsed));
                }
            }
            return parsed;
        } catch (e) {
            return null;
        }
    });
    const [language, setLanguage] = useState('KO');

    const t = translations[language];

    const login = (userData) => {
        const normalized = { ...userData, role: normalizeRole(userData.role) };
        sessionStorage.setItem('psf_user', JSON.stringify(normalized));
        sessionStorage.setItem('psf_token', normalized.token);
        setUser(normalized);
    };
    const logout = () => {
        sessionStorage.removeItem('psf_user');
        sessionStorage.removeItem('psf_token');
        setUser(null);
    };
    const updateUser = (data) => {
        const newUser = { ...user, ...data };
        if (data.role) newUser.role = normalizeRole(data.role);
        sessionStorage.setItem('psf_user', JSON.stringify(newUser));
        setUser(newUser);
    };

    // GPS Persistence Logic
    const [isGpsSending, setIsGpsSending] = useState(false);
    const gpsIntervalRef = useRef(null);
    const lastCoordsRef = useRef(null);
    const isSendingRef = useRef(false); // Ref flag for closure-safe checks

    const stopGps = () => {
        isSendingRef.current = false;
        setIsGpsSending(false);
        if (gpsIntervalRef.current) {
            clearInterval(gpsIntervalRef.current);
            gpsIntervalRef.current = null;
        }

        // Send stop signal immediately using cached coords (don't wait for geolocation)
        const coords = lastCoordsRef.current;
        if (coords) {
            updateGpsLocation({
                latitude: coords.latitude,
                longitude: coords.longitude,
                address: '',
                status: 'STOPPED',
                transmitting: false
            }).catch(console.error);
        } else {
            // No cached coords — try once with geolocation, short timeout
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        updateGpsLocation({
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                            address: '',
                            status: 'STOPPED',
                            transmitting: false
                        }).catch(console.error);
                    },
                    () => console.warn('stopGps: geolocation failed and no cached coords'),
                    { timeout: 3000, maximumAge: 60000 }
                );
            }
        }
    };

    const startGps = () => {
        isSendingRef.current = true;
        setIsGpsSending(true);

        const send = () => {
            // Check ref flag so if stopGps was called, this interval callback exits early
            if (!isSendingRef.current) return;

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    if (!isSendingRef.current) return; // Check again after async
                    const { latitude, longitude } = pos.coords;
                    lastCoordsRef.current = { latitude, longitude };

                    const sendToBackend = (address) => {
                        if (!isSendingRef.current) return;
                        updateGpsLocation({
                            latitude,
                            longitude,
                            address: address || '',
                            status: 'MOVING',
                            transmitting: true
                        }).catch(console.error);
                    };

                    // Try to get address if Naver Maps is loaded
                    if (window.naver && window.naver.maps && window.naver.maps.Service) {
                        const latlng = new window.naver.maps.LatLng(latitude, longitude);
                        window.naver.maps.Service.reverseGeocode({
                            coords: latlng,
                            orders: [window.naver.maps.Service.OrderType.ADDR, window.naver.maps.Service.OrderType.ROAD_ADDR].join(',')
                        }, (status, response) => {
                            const result = response?.v2?.address;
                            const addr = result?.jibunAddress || result?.roadAddress || '';
                            sendToBackend(addr);
                        });
                    } else {
                        sendToBackend('');
                    }
                }, null, { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 });
            }
        };

        send(); // Initial send
        if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = setInterval(send, 10000);
    };

    useEffect(() => {
        return () => {
            isSendingRef.current = false;
            if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
        };
    }, []);

    return (
        <AppContext.Provider value={{ 
            user, t, language, login, logout, updateUser, setLanguage,
            isGpsSending, startGps, stopGps 
        }}>
            {children}
        </AppContext.Provider>
    )
}

export function useApp() {
    return useContext(AppContext)
}
