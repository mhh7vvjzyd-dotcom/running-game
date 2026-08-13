import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import * as turf from '@turf/turf';

function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 17);
  }, [lat, lng]);
  return null;
}

export default function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [route, setRoute] = useState([]);
  const [currentPos, setCurrentPos] = useState({ lat: 55.751244, lng: 37.618423 });
  const [watchId, setWatchId] = useState(null);
  const [territories, setTerritories] = useState([]);
  const [distance, setDistance] = useState(0);
  const [startPoint, setStartPoint] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      alert('Ваш браузер не поддерживает геолокацию');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCurrentPos({ lat: latitude, lng: longitude });
      },
      (err) => alert('Ошибка GPS: ' + err.message),
      { enableHighAccuracy: true }
    );
  }, []);

  const calcDistance = (points) => {
    if (points.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const from = turf.point([points[i-1].lng, points[i-1].lat]);
      const to = turf.point([points[i].lng, points[i].lat]);
      total += turf.distance(from, to, { units: 'meters' });
    }
    return total;
  };

  const isLoopClosed = (points) => {
    if (points.length < 5) return false;
    const first = points[0];
    const last = points[points.length - 1];
    const dist = turf.distance(
      turf.point([first.lng, first.lat]),
      turf.point([last.lng, last.lat]),
      { units: 'meters' }
    );
    return dist < 50;
  };

  const createPolygon = (points) => {
    if (!isLoopClosed(points) || points.length < 5) return null;
    try {
      const coords = points.map(p => [p.lng, p.lat]);
      coords.push(coords[0]);
      const polygon = turf.polygon([coords]);
      const area = turf.area(polygon);
      return { polygon, area };
    } catch {
      return null;
    }
  };

  const startRun = () => {
    if (!navigator.geolocation) return;
    setRoute([]);
    setDistance(0);
    setIsRunning(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setStartPoint({ lat: latitude, lng: longitude });
        setRoute([{ lat: latitude, lng: longitude }]);
      },
      (err) => alert('Ошибка GPS: ' + err.message),
      { enableHighAccuracy: true }
    );

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const newPoint = { lat: latitude, lng: longitude };
        setCurrentPos(newPoint);
        setRoute(prev => {
          const updated = [...prev, newPoint];
          setDistance(calcDistance(updated));
          return updated;
        });
      },
      (err) => alert('Ошибка GPS: ' + err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 5000 }
    );
    setWatchId(id);
  };

  const stopRun = () => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsRunning(false);

    if (route.length < 5) {
      alert('Слишком короткий маршрут');
      return;
    }

    const polygonData = createPolygon(route);
    if (polygonData) {
      const newTerritory = {
        id: Date.now(),
        points: route,
        area: polygonData.area,
        date: new Date().toLocaleString()
      };
      setTerritories(prev => [...prev, newTerritory]);
      alert(`🏆 Территория захвачена!\nПлощадь: ${Math.round(polygonData.area)} м²`);
    } else {
      alert('Маршрут не замкнут. Вернись в точку старта (< 50 м)');
    }
  };

  const getColor = (index) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    return colors[index % colors.length];
  };

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      <MapContainer
        center={[currentPos.lat, currentPos.lng]}
        zoom={17}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Recenter lat={currentPos.lat} lng={currentPos.lng} />

        {route.length > 0 && (
          <Polyline
            positions={route.map(p => [p.lat, p.lng])}
            pathOptions={{ color: isRunning ? '#FF0000' : '#FF6B35', weight: 4 }}
          />
        )}

        {startPoint && (
          <CircleMarker
            center={[startPoint.lat, startPoint.lng]}
            radius={6}
            pathOptions={{ color: '#00FF00', fillColor: '#00FF00', fillOpacity: 1 }}
          />
        )}

        {territories.map((terr, idx) => (
          <Polyline
            key={terr.id}
            positions={terr.points.map(p => [p.lat, p.lng])}
            pathOptions={{
              color: getColor(idx),
              weight: 3,
              fillColor: getColor(idx),
              fillOpacity: 0.3
            }}
          />
        ))}
      </MapContainer>

      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '12px 16px',
        borderRadius: 12,
        display: 'flex',
        justifyContent: 'space-around',
        fontSize: '13px',
        zIndex: 1000,
        backdropFilter: 'blur(10px)'
      }}>
        <span>📍 {route.length} точек</span>
        <span>📏 {Math.round(distance)} м</span>
        {isLoopClosed(route) && route.length > 0 && (
          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>🔒 ПЕТЛЯ!</span>
        )}
        <span>🏆 {territories.length} зон</span>
      </div>

      <div style={{
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        {!isRunning ? (
          <button
            onClick={startRun}
            style={{
              padding: '16px 48px',
              borderRadius: 30,
              fontSize: '20px',
              fontWeight: 'bold',
              color: 'white',
              border: 'none',
              background: 'linear-gradient(135deg, #4CAF50, #45a049)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              minWidth: '200px'
            }}
          >
            🏃‍♂️ СТАРТ
          </button>
        ) : (
          <button
            onClick={stopRun}
            style={{
              padding: '16px 48px',
              borderRadius: 30,
              fontSize: '20px',
              fontWeight: 'bold',
              color: 'white',
              border: 'none',
              background: 'linear-gradient(135deg, #f44336, #d32f2f)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              minWidth: '200px'
            }}
          >
            ⏹ СТОП
          </button>
        )}
      </div>

      {territories.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 120,
          right: 16,
          background: 'rgba(0,0,0,0.85)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: 12,
          fontSize: '12px',
          maxWidth: '180px',
          zIndex: 1000,
          backdropFilter: 'blur(10px)',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 6, borderBottom: '1px solid #555', paddingBottom: 4 }}>
            🏅 Мои территории
          </div>
          {territories.slice().reverse().slice(0, 5).map((t, i) => (
            <div key={t.id} style={{ padding: '4px 0', borderBottom: '1px solid #333', fontSize: '11px' }}>
              #{i+1} — {Math.round(t.area)} м²
            </div>
          ))}
        </div>
      )}
    </div>
  );
}