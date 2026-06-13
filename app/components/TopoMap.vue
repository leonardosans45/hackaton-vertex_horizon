<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as turf from '@turf/turf'

const props = defineProps<{
  center: [number, number]
  tileStyle: string
  rainfall: number
  temperature: number
  soilFactor: number
  cadVisible: boolean
  cadData: any[] | null
  // Cloud & Wind Simulation props
  cloudsVisible: boolean
  cloudCoverage: number
  windSpeed: number
  windDirection: number
}>()

const emit = defineEmits<{
  (e: 'mapClick', lat: number, lng: number): void
  (e: 'drawnPolygon', data: { area: number; perimeter: number }): void
  (e: 'drawnPolyline', data: { length: number }): void
}>()

let L: any = null
const mapElement = ref<HTMLElement | null>(null)
const cloudsCanvas = ref<HTMLCanvasElement | null>(null)

let mapInstance: any = null
let tileLayer: any = null
let heatmapLayer: any = null
let waterLayer: any = null
let dxfLayerGroup: any = null
let animationFrameId: number | null = null
let clouds: any[] = []

onMounted(async () => {
  if (process.client) {
    try {
      // Dynamic imports for Leaflet to prevent SSR errors
      L = await import('leaflet')
      ;(window as any).L = L
      await import('leaflet.heat')
      await import('@geoman-io/leaflet-geoman-free')

      // Fix default Leaflet marker icons issues
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
      })

      initMap()
      updateOverlays()
      
      if (props.cloudsVisible) {
        generateClouds()
        startAnimation()
      }
    } catch (err) {
      console.error('Error in map component initialization:', err)
    }
  }
})

onUnmounted(() => {
  stopAnimation()
})

const initMap = () => {
  if (!L || !mapElement.value) return

  mapInstance = L.map(mapElement.value, {
    zoomControl: false,
    attributionControl: false
  }).setView(props.center, 14)

  L.control.scale({ position: 'bottomleft', imperial: false }).addTo(mapInstance)
  L.control.zoom({ position: 'bottomright' }).addTo(mapInstance)

  updateTileStyle()

  // Initialize Geoman
  mapInstance.pm.addControls({
    position: 'topleft',
    drawMarker: true,
    drawCircleMarker: false,
    drawPolyline: true,
    drawRectangle: true,
    drawPolygon: true,
    drawCircle: true,
    editMode: true,
    dragMode: true,
    cutPolygon: true,
    removalMode: true
  })

  // Listener for drawn shapes
  mapInstance.on('pm:create', (e: any) => {
    const layer = e.layer

    if (e.shape === 'Polygon' || e.shape === 'Rectangle') {
      const latlngs = layer.getLatLngs()[0]
      const turfCoords = latlngs.map((ll: any) => [ll.lng, ll.lat])
      turfCoords.push(turfCoords[0]) // close polygon loop

      const polygon = turf.polygon([turfCoords])
      const area = turf.area(polygon)
      const perimeter = turf.length(polygon, { units: 'meters' })

      layer.bindPopup(`
        <div class="map-popup">
          <h3><i class="pi pi-map"></i> Terreno Dibujado</h3>
          <p><strong>Área:</strong> ${Math.round(area).toLocaleString()} m²</p>
          <p><strong>Perímetro:</strong> ${Math.round(perimeter).toLocaleString()} m</p>
          <p style="font-size: 0.75rem; color: #8b5cf6; margin-top: 5px;">Geometría calculada con Turf.js</p>
        </div>
      `).openPopup()

      emit('drawnPolygon', { area, perimeter })
    } else if (e.shape === 'Polyline') {
      const latlngs = layer.getLatLngs()
      const turfCoords = latlngs.map((ll: any) => [ll.lng, ll.lat])
      const line = turf.lineString(turfCoords)
      const length = turf.length(line, { units: 'meters' })

      layer.bindPopup(`
        <div class="map-popup">
          <h3><i class="pi pi-share-alt"></i> Sendero / Vector</h3>
          <p><strong>Longitud:</strong> ${Math.round(length).toLocaleString()} m</p>
        </div>
      `).openPopup()

      emit('drawnPolyline', { length })
    }
  })

  mapInstance.on('click', (e: any) => {
    if (mapInstance.pm.globalDrawModeEnabled()) return
    emit('mapClick', e.latlng.lat, e.latlng.lng)
  })

  dxfLayerGroup = L.layerGroup().addTo(mapInstance)
}

const updateTileStyle = () => {
  if (!mapInstance || !L) return

  if (tileLayer) {
    mapInstance.removeLayer(tileLayer)
  }

  let url = ''
  let attr = ''

  if (props.tileStyle === 'standard') {
    url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    attr = '© OpenStreetMap'
  } else if (props.tileStyle === 'dark') {
    url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
    attr = '© OpenStreetMap, © CartoDB'
  } else if (props.tileStyle === 'satellite') {
    url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    attr = '© ESRI Satellite, USGS'
  }

  tileLayer = L.tileLayer(url, {
    attribution: attr,
    maxZoom: 19
  }).addTo(mapInstance)
}

// Elevation helper to add noise to water boundary
const getMockHeight = (lat: number, lng: number) => {
  const x = lat * 350
  const y = lng * 350
  return 2240 + Math.sin(x) * 150 + Math.cos(y) * 90
}

const updateOverlays = () => {
  if (!mapInstance || !L) return

  const center = props.center

  // 1. Temperature Heatmap
  if (heatmapLayer) {
    mapInstance.removeLayer(heatmapLayer)
  }

  const heatIntensity = (props.temperature + 10) / 60
  const heatPoints: any[] = []

  for (let i = -6; i <= 6; i++) {
    for (let j = -6; j <= 6; j++) {
      const lat = center[0] + i * 0.0015
      const lng = center[1] + j * 0.0015
      const height = getMockHeight(lat, lng)
      const heightFactor = 1 - (height - 2000) / 500
      const intensity = heatIntensity * (0.5 + heightFactor * 0.5)
      heatPoints.push([lat, lng, intensity])
    }
  }

  heatmapLayer = L.heatLayer(heatPoints, {
    radius: 35,
    blur: 25,
    maxZoom: 17,
    gradient: {
      0.1: 'rgba(59, 130, 246, 0.4)',
      0.4: 'rgba(16, 185, 129, 0.6)',
      0.7: 'rgba(234, 179, 8, 0.7)',
      1.0: 'rgba(239, 68, 68, 0.9)'
    }
  }).addTo(mapInstance)

  // 2. Rainfall pooling (Water Layer)
  if (waterLayer) {
    mapInstance.removeLayer(waterLayer)
  }

  const radius = props.rainfall * props.soilFactor * 0.015
  if (radius > 0.05) {
    const centerLngLat = [center[1], center[0]]
    const circle = turf.circle(centerLngLat, radius, { steps: 32, units: 'kilometers' })

    const deformedCoords = circle.geometry.coordinates[0].map((coord, index) => {
      const angle = (index / 32) * 360
      const latOffset = coord[1] - center[0]
      const lngOffset = coord[0] - center[1]
      const height = getMockHeight(center[0] + latOffset, center[1] + lngOffset)
      const heightOffset = (2400 - height) / 400

      const noiseRadius = radius * (0.85 + Math.sin(index * 3) * 0.12 + heightOffset * 0.15)
      const destPoint = turf.destination(centerLngLat, noiseRadius, angle, { units: 'kilometers' })
      return destPoint.geometry.coordinates
    })

    const waterPolygon = turf.polygon([deformedCoords])
    const leafletCoords = waterPolygon.geometry.coordinates[0].map(c => [c[1], c[0]])

    waterLayer = L.polygon(leafletCoords, {
      color: '#2563eb',
      fillColor: '#3b82f6',
      fillOpacity: 0.45,
      weight: 2,
      dashArray: '4, 4'
    }).addTo(mapInstance)
      .bindPopup(`
        <div class="map-popup">
          <h3><i class="pi pi-cloud-rain"></i> Zona de Acumulación</h3>
          <p><strong>Lluvia:</strong> ${props.rainfall} mm</p>
          <p><strong>Riesgo Inundación:</strong> Alto</p>
        </div>
      `)
  }

  // 3. CAD Overlay
  if (dxfLayerGroup) {
    dxfLayerGroup.clearLayers()
    if (props.cadVisible && props.cadData && props.cadData.length > 0) {
      props.cadData.forEach(item => {
        if (item.type === 'line' || item.type === 'polyline') {
          L.polyline(item.coords, { color: item.color || '#38bdf8', weight: item.weight || 2, dashArray: item.dashArray || '' }).addTo(dxfLayerGroup)
        } else if (item.type === 'circle') {
          L.circle(item.coords, { radius: item.radius || 10, color: item.color || '#ef4444', fillColor: item.fillColor || '#ef4444', fillOpacity: 0.5 })
            .addTo(dxfLayerGroup)
            .bindTooltip(item.tooltip || '', { permanent: false })
        }
      })
    }
  }
}

// Procedural Cloud Generation and Animation
const generateClouds = () => {
  if (!mapInstance) return
  const bounds = mapInstance.getBounds()
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  const latSpan = ne.lat - sw.lat
  const lngSpan = ne.lng - sw.lng
  
  const padding = 0.25
  clouds = Array.from({ length: 28 }, () => {
    return {
      lat: sw.lat - padding * latSpan + Math.random() * (latSpan * (1 + 2 * padding)),
      lng: sw.lng - padding * lngSpan + Math.random() * (lngSpan * (1 + 2 * padding)),
      radiusMeters: 400 + Math.random() * 1800,
      opacity: 0.3 + Math.random() * 0.5,
      speedFactor: 0.85 + Math.random() * 0.4
    }
  })
}

const drawClouds = () => {
  if (!cloudsCanvas.value || !mapInstance || !props.cloudsVisible) return
  const canvas = cloudsCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
  }
  
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  const bounds = mapInstance.getBounds()
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  
  // Wind physics: Speed in km/h translated to coordinate velocity
  const fps = 60
  const speedMetersPerFrame = (props.windSpeed * 0.2777) / fps
  const degPerFrame = speedMetersPerFrame / 111000
  const angleRad = (props.windDirection * Math.PI) / 180
  
  const dLat = degPerFrame * Math.cos(angleRad)
  const dLng = degPerFrame * Math.sin(angleRad) / Math.cos(props.center[0] * Math.PI / 180)
  
  const zoom = mapInstance.getZoom()
  
  clouds.forEach(cloud => {
    // 1. Move cloud coordinates
    cloud.lat += dLat * cloud.speedFactor
    cloud.lng += dLng * cloud.speedFactor
    
    // 2. Wrap boundaries
    const latPadding = ne.lat - sw.lat
    const lngPadding = ne.lng - sw.lng
    const paddingMultiplier = 0.35
    
    if (dLat > 0 && cloud.lat > ne.lat + latPadding * paddingMultiplier) {
      cloud.lat = sw.lat - latPadding * paddingMultiplier
    } else if (dLat < 0 && cloud.lat < sw.lat - latPadding * paddingMultiplier) {
      cloud.lat = ne.lat + latPadding * paddingMultiplier
    }
    
    if (dLng > 0 && cloud.lng > ne.lng + lngPadding * paddingMultiplier) {
      cloud.lng = sw.lng - lngPadding * paddingMultiplier
    } else if (dLng < 0 && cloud.lng < sw.lng - lngPadding * paddingMultiplier) {
      cloud.lng = ne.lng + lngPadding * paddingMultiplier
    }
    
    // 3. Project coords to canvas screen space
    const latLng = L.latLng(cloud.lat, cloud.lng)
    const screenPos = mapInstance.latLngToContainerPoint(latLng)
    
    // Project radius in meters to pixels based on current zoom
    const latRad = cloud.lat * Math.PI / 180
    const metersPerPixel = (156543.03392 * Math.cos(latRad)) / Math.pow(2, zoom)
    let screenRadius = cloud.radiusMeters / metersPerPixel
    
    // Clamp to prevent performance/rendering artifacts
    screenRadius = Math.max(15, Math.min(screenRadius, 450))
    
    // 4. Draw cloud shadow first (Offset South-East based on radius scale)
    const shadowOffset = screenRadius * 0.22
    const shadowGrad = ctx.createRadialGradient(
      screenPos.x + shadowOffset, screenPos.y + shadowOffset, 0,
      screenPos.x + shadowOffset, screenPos.y + shadowOffset, screenRadius
    )
    
    const coverageFactor = props.cloudCoverage / 100
    const shadowAlpha = cloud.opacity * coverageFactor * 0.11
    
    shadowGrad.addColorStop(0, `rgba(15, 23, 42, ${shadowAlpha})`)
    shadowGrad.addColorStop(0.6, `rgba(15, 23, 42, ${shadowAlpha * 0.3})`)
    shadowGrad.addColorStop(1, 'rgba(15, 23, 42, 0)')
    
    ctx.fillStyle = shadowGrad
    ctx.beginPath()
    ctx.arc(screenPos.x + shadowOffset, screenPos.y + shadowOffset, screenRadius, 0, Math.PI * 2)
    ctx.fill()
    
    // 5. Draw cloud body with fluffy white-slate gradient
    const cloudGrad = ctx.createRadialGradient(
      screenPos.x, screenPos.y, 0,
      screenPos.x, screenPos.y, screenRadius
    )
    
    const bodyAlpha = cloud.opacity * coverageFactor * 0.65
    cloudGrad.addColorStop(0, `rgba(255, 255, 255, ${bodyAlpha})`)
    cloudGrad.addColorStop(0.4, `rgba(241, 245, 249, ${bodyAlpha * 0.8})`)
    cloudGrad.addColorStop(0.7, `rgba(219, 234, 254, ${bodyAlpha * 0.3})`)
    cloudGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    
    ctx.fillStyle = cloudGrad
    ctx.beginPath()
    ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2)
    ctx.fill()
  })
}

const startAnimation = () => {
  if (animationFrameId) return
  const tick = () => {
    drawClouds()
    animationFrameId = requestAnimationFrame(tick)
  }
  tick()
}

const stopAnimation = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

// Watchers
watch(() => props.center, (newCenter) => {
  if (mapInstance) {
    mapInstance.setView(newCenter, 14)
    updateOverlays()
  }
})

watch(() => props.tileStyle, () => {
  updateTileStyle()
})

watch([() => props.rainfall, () => props.temperature, () => props.soilFactor, () => props.cadVisible, () => props.cadData], () => {
  updateOverlays()
})

watch(() => props.cloudsVisible, (visible) => {
  if (visible) {
    generateClouds()
    setTimeout(() => {
      startAnimation()
    }, 60)
  } else {
    stopAnimation()
    // Clear canvas when disabled
    if (cloudsCanvas.value) {
      const ctx = cloudsCanvas.value.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, cloudsCanvas.value.width, cloudsCanvas.value.height)
    }
  }
}, { immediate: true })

defineExpose({
  flyTo: (coords: [number, number], zoom = 14) => {
    if (mapInstance) {
      mapInstance.flyTo(coords, zoom, { duration: 1.5 })
    }
  }
})
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapElement" class="topo-map"></div>
    <canvas 
      v-if="cloudsVisible" 
      ref="cloudsCanvas" 
      class="clouds-canvas"
    ></canvas>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.topo-map {
  width: 100%;
  height: 100%;
  background-color: #0d1117;
}

.clouds-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 450;
  pointer-events: none;
}
</style>

