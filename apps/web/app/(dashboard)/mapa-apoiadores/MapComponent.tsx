'use client'
import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'

interface MapPoint {
  region: string
  lat: number
  lng: number
  dominant: 'APOIADOR' | 'INDECISO' | 'CRITICO'
  total: number
  apoiador: number
  indeciso: number
  critico: number
}

const COLORS = {
  APOIADOR: '#16a34a',
  INDECISO: '#d97706',
  CRITICO: '#dc2626',
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13)
      return
    }
    const lats = points.map(p => p.lat)
    const lngs = points.map(p => p.lng)
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [40, 40] }
    )
  }, [points, map])
  return null
}

export default function MapComponent({ points, regionLabel }: { points: MapPoint[]; regionLabel: string }) {
  const center: [number, number] = points.length > 0
    ? [points.reduce((s, p) => s + p.lat, 0) / points.length, points.reduce((s, p) => s + p.lng, 0) / points.length]
    : [-15.788, -47.879] // Brasil central como fallback

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {points.map((point, i) => {
        const radius = Math.max(10, Math.min(40, point.total * 4))
        const pct = (n: number) => point.total > 0 ? Math.round(n / point.total * 100) : 0
        return (
          <CircleMarker
            key={i}
            center={[point.lat, point.lng]}
            radius={radius}
            pathOptions={{
              fillColor: COLORS[point.dominant],
              fillOpacity: 0.75,
              color: COLORS[point.dominant],
              weight: 2,
            }}
          >
            <Popup>
              <div className="min-w-[160px]">
                <p className="font-bold text-gray-800 mb-2 text-sm">{point.region}</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-green-700 font-medium">🟢 Apoiadores</span>
                    <span className="font-bold">{point.apoiador} <span className="text-gray-400">({pct(point.apoiador)}%)</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-600 font-medium">🟡 Indecisos</span>
                    <span className="font-bold">{point.indeciso} <span className="text-gray-400">({pct(point.indeciso)}%)</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-600 font-medium">🔴 Críticos</span>
                    <span className="font-bold">{point.critico} <span className="text-gray-400">({pct(point.critico)}%)</span></span>
                  </div>
                  <div className="border-t pt-1 mt-1 flex justify-between text-gray-500">
                    <span>Total</span><span className="font-bold text-gray-700">{point.total}</span>
                  </div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
