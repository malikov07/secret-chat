import { useEffect, useRef } from 'react'
import L from 'leaflet'

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="font-size:34px;transform:translate(-50%,-90%)">📍</div>',
  iconSize: [0, 0],
})

export default function MapPanel({ loc }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false })
      .setView([loc?.lat || 0, loc?.lng || 0], loc ? 16 : 2)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
    setTimeout(() => map.invalidateSize(), 120)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loc) return
    const pos = [loc.lat, loc.lng]
    if (!markerRef.current) markerRef.current = L.marker(pos, { icon: pinIcon }).addTo(map)
    else markerRef.current.setLatLng(pos)
    map.setView(pos, Math.max(map.getZoom(), 16), { animate: true })
  }, [loc])

  return (
    <>
      <div ref={containerRef} className="loc-map" />
      {loc && (
        <div className="loc-meta">
          📍 {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
          {loc.accuracy ? ` · ±${Math.round(loc.accuracy)}m` : ''}
        </div>
      )}
    </>
  )
}
