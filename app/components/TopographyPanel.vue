<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  lastClickedCoords: [number, number] | null
  currentElevation: number | null
  currentSlope: number | null
  loadingElevation: boolean
  aqiValue: number
  aqiStatus: { label: string; color: string; class: string }
  loadedDxfEntitiesCount: number
  hasCadOverlay: boolean
}>()

const emit = defineEmits<{
  (e: 'dxfParsedText', text: string): void
  (e: 'mockCadClick'): void
  (e: 'clearCadClick'): void
}>()

const dxfInputRef = ref<HTMLInputElement | null>(null)

const triggerFileInput = () => {
  if (dxfInputRef.value) {
    dxfInputRef.value.click()
  }
}

const handleFileChange = (event: any) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e: any) => {
    emit('dxfParsedText', e.target.result)
  }
  reader.readAsText(file)
}
</script>

<template>
  <aside class="floating-panel right-panel glass-panel">
    <div class="panel-header">
      <i class="pi pi-compass header-icon text-blue"></i>
      <h2>Topografía & CAD</h2>
    </div>

    <div class="panel-body">
      
      <!-- DXF Uploader & CAD loader -->
      <div class="cad-section">
        <h3>Planos CAD (DWG / DXF)</h3>
        <p class="section-desc">Carga planos de AutoCAD reales o simula un relieve de cimientos estructurales.</p>
        
        <input 
          type="file" 
          ref="dxfInputRef" 
          @change="handleFileChange" 
          accept=".dxf" 
          style="display: none;"
        />
        
        <div class="button-grid">
          <Button 
            label="Importar DXF" 
            icon="pi pi-file-import" 
            class="p-button-outlined p-button-sm flex-1"
            @click="triggerFileInput"
          />
          <Button 
            label="Planos Mock" 
            icon="pi pi-eye" 
            class="p-button-outlined p-button-sm flex-1"
            @click="emit('mockCadClick')"
          />
        </div>

        <!-- CAD Status badge -->
        <div class="cad-status" v-if="hasCadOverlay">
          <span class="status-indicator"></span>
          <span class="status-info">
            {{ loadedDxfEntitiesCount > 0 ? `Cargado: ${loadedDxfEntitiesCount} líneas` : 'Simulación CAD activa' }}
          </span>
          <button class="clear-cad-btn" @click="emit('clearCadClick')" title="Remover Capas">
            <i class="pi pi-trash"></i>
          </button>
        </div>
      </div>

      <!-- Real-time Elevation and Slope details (calculated on Map Click) -->
      <div class="relief-section">
        <h3>Georreferencia & Relieve</h3>
        
        <div class="clicked-info-box" v-if="lastClickedCoords">
          <div class="coord-tag">
            <i class="pi pi-map-marker text-red-500"></i>
            <span>Lat: {{ lastClickedCoords[0].toFixed(5) }}, Lng: {{ lastClickedCoords[1].toFixed(5) }}</span>
          </div>

          <div class="metric-row">
            <div class="metric-col">
              <span class="lbl">Altitud Real</span>
              <div class="val-wrapper">
                <span v-if="loadingElevation" class="pi pi-spin pi-spinner val-loader"></span>
                <span v-else class="val">{{ currentElevation !== null ? currentElevation + ' m' : '---' }}</span>
              </div>
              <span class="src-info">Vía Open Topo Data</span>
            </div>

            <div class="metric-col">
              <span class="lbl">Pendiente</span>
              <div class="val-wrapper">
                <span v-if="loadingElevation" class="pi pi-spin pi-spinner val-loader"></span>
                <span v-else class="val">{{ currentSlope !== null ? currentSlope + ' %' : '---' }}</span>
              </div>
              <span class="src-info">Calculado con Turf.js</span>
            </div>
          </div>
        </div>
        
        <div class="no-click-info" v-else>
          <i class="pi pi-info-circle"></i>
          <span>Haz clic en cualquier parte del mapa para consultar su altitud real y pendiente.</span>
        </div>
      </div>

      <!-- Air Quality Panel (AQICN) -->
      <div class="aqi-section">
        <div class="aqi-header">
          <span>Calidad del Aire (AQICN)</span>
          <span class="aqi-badge" :style="{ backgroundColor: aqiStatus.color }">{{ aqiValue }} AQI</span>
        </div>
        <div class="aqi-body">
          <div class="aqi-level-text">Estado: <strong :style="{ color: aqiStatus.color }">{{ aqiStatus.label }}</strong></div>
          <p class="aqi-advice" v-if="aqiValue <= 50">Seguridad laboral óptima. Condiciones perfectas para trabajos de campo.</p>
          <p class="aqi-advice" v-else-if="aqiValue <= 100">Condiciones normales. Cuidado con partículas finas si hay viento fuerte.</p>
          <p class="aqi-advice" v-else>Alerta de partículas en suspensión. Se recomienda el uso de mascarillas en obras exteriores.</p>
        </div>
      </div>

    </div>
  </aside>
</template>

<style scoped>
.floating-panel {
  width: 100%;
  position: relative;
  box-shadow: none;
  border: none;
  background: transparent;
  backdrop-filter: none;
  padding: 0;
}
</style>
