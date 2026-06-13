<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  rainfall: number
  temperature: number
  soilType: { name: string; code: string; factor: number }
  soilOptions: { name: string; code: string; factor: number }[]
  simulationRunning: boolean
  // Clouds and Wind properties
  cloudsVisible: boolean
  cloudCoverage: number
  windSpeed: number
  windDirection: number
}>()

const emit = defineEmits<{
  (e: 'update:rainfall', val: number): void
  (e: 'update:temperature', val: number): void
  (e: 'update:soilType', val: { name: string; code: string; factor: number }): void
  (e: 'update:cloudsVisible', val: boolean): void
  (e: 'update:cloudCoverage', val: number): void
  (e: 'update:windSpeed', val: number): void
  (e: 'update:windDirection', val: number): void
  (e: 'toggleSimulation'): void
}>()

const updateRainfall = (e: Event) => {
  const target = e.target as HTMLInputElement
  emit('update:rainfall', parseFloat(target.value))
}

const updateTemperature = (e: Event) => {
  const target = e.target as HTMLInputElement
  emit('update:temperature', parseFloat(target.value))
}

const handleSoilChange = (val: any) => {
  emit('update:soilType', val)
}
</script>

<template>
  <aside class="floating-panel left-panel glass-panel">
    <div class="panel-header">
      <i class="pi pi-sliders-h header-icon text-purple"></i>
      <h2>Control de Simulación</h2>
    </div>

    <div class="panel-body">
      
      <!-- Slider Lluvia (Rainfall) -->
      <div class="control-group">
        <div class="control-label">
          <span><i class="pi pi-cloud-rain"></i> Lluvia (Acumulación)</span>
          <span class="badge badge-blue">{{ rainfall }} mm</span>
        </div>
        <input 
          type="range" 
          :value="rainfall" 
          @input="updateRainfall"
          min="0" 
          max="100" 
          class="custom-slider slider-blue"
        />
        <span class="slider-helper">Afecta el radio del polígono de inundación (Turf.js).</span>
      </div>

      <!-- Slider Temperatura (Heatmap) -->
      <div class="control-group">
        <div class="control-label">
          <span><i class="pi pi-sun"></i> Temperatura Suelo</span>
          <span class="badge badge-orange">{{ temperature }}°C</span>
        </div>
        <input 
          type="range" 
          :value="temperature" 
          @input="updateTemperature"
          min="-10" 
          max="50" 
          class="custom-slider slider-orange"
        />
        <span class="slider-helper">Ajusta la intensidad calórica del mapa térmico (leaflet.heat).</span>
      </div>

      <!-- Soil Type Select -->
      <div class="control-group">
        <label class="control-title-label">Tipo de Suelo (Filtración)</label>
        <Select 
          :modelValue="soilType" 
          @update:modelValue="handleSoilChange"
          :options="soilOptions" 
          optionLabel="name" 
          placeholder="Selecciona tipo" 
          class="w-full text-sm font-sans"
        />
        <span class="slider-helper">Suelos arenosos absorben más; suelos arcillosos y rocosos inundan rápido.</span>
      </div>

      <!-- Cloud & Wind Atmospheric Simulation -->
      <div class="control-section-divider"></div>
      
      <div class="control-group">
        <div class="flex-row-space-between">
          <span class="control-title-label"><i class="pi pi-cloud"></i> Capa de Nubes</span>
          <ToggleSwitch 
            :modelValue="cloudsVisible" 
            @update:modelValue="(val: boolean) => emit('update:cloudsVisible', val)" 
          />
        </div>
        <span class="slider-helper">Activa una simulación visual y física de nubosidad sobre el terreno.</span>
      </div>

      <div v-if="cloudsVisible" class="clouds-advanced-controls">
        <!-- Slider Nubosidad -->
        <div class="control-group">
          <div class="control-label">
            <span>Densidad de Nubes</span>
            <span class="badge badge-sky">{{ cloudCoverage }}%</span>
          </div>
          <input 
            type="range" 
            :value="cloudCoverage" 
            @input="(e: any) => emit('update:cloudCoverage', parseFloat((e.target as HTMLInputElement).value))"
            min="10" 
            max="100" 
            class="custom-slider slider-sky"
          />
        </div>

        <!-- Slider Velocidad Viento -->
        <div class="control-group">
          <div class="control-label">
            <span>Velocidad Viento</span>
            <span class="badge badge-teal">{{ windSpeed }} km/h</span>
          </div>
          <input 
            type="range" 
            :value="windSpeed" 
            @input="(e: any) => emit('update:windSpeed', parseFloat((e.target as HTMLInputElement).value))"
            min="5" 
            max="120" 
            class="custom-slider slider-teal"
          />
        </div>

        <!-- Slider Dirección Viento -->
        <div class="control-group">
          <div class="control-label">
            <span>Dirección Viento</span>
            <span class="badge badge-teal">{{ windDirection }}°</span>
          </div>
          <input 
            type="range" 
            :value="windDirection" 
            @input="(e: any) => emit('update:windDirection', parseFloat((e.target as HTMLInputElement).value))"
            min="0" 
            max="359" 
            class="custom-slider slider-teal"
          />
          <div class="wind-dir-labels">
            <span>N</span>
            <span>E</span>
            <span>S</span>
            <span>O</span>
          </div>
        </div>
      </div>

      <!-- Simulation triggers -->
      <div class="control-section-divider"></div>
      <div class="action-box">
        <Button 
          :label="simulationRunning ? 'Pausar Simulación' : 'Simulación Dinámica'" 
          :icon="simulationRunning ? 'pi pi-pause-circle' : 'pi pi-play-circle'" 
          :class="simulationRunning ? 'p-button-danger w-full' : 'p-button-primary w-full'"
          @click="emit('toggleSimulation')"
        />
      </div>

    </div>
  </aside>
</template>

<style scoped>
/* Scoped overrides to keep floating panels styles in parent and prevent clashes */
.floating-panel {
  width: 100%;
  position: relative;
  box-shadow: none;
  border: none;
  background: transparent;
  backdrop-filter: none;
  padding: 0;
}

.control-section-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 1.25rem 0;
}

.light-mode .control-section-divider {
  background: rgba(0, 0, 0, 0.08);
}

.flex-row-space-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.clouds-advanced-controls {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.badge-sky {
  background: rgba(14, 165, 233, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(14, 165, 233, 0.2);
}

.badge-teal {
  background: rgba(20, 184, 166, 0.15);
  color: #2dd4bf;
  border: 1px solid rgba(20, 184, 166, 0.2);
}

.slider-sky::-webkit-slider-runnable-track {
  background: linear-gradient(to right, #38bdf8, #0ea5e9);
}

.slider-teal::-webkit-slider-runnable-track {
  background: linear-gradient(to right, #2dd4bf, #0d9488);
}

.wind-dir-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.65rem;
  color: var(--text-muted-dark);
  margin-top: 0.25rem;
  padding: 0 0.25rem;
}
</style>

