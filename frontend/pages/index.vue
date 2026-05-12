<template>
  <div class="geocore-viewport">
    <div id="map"></div>
    
    <!-- Glassmorphism Controls -->
    <div class="controls-overlay">
      <div class="top-nav">
        <h1 class="logo">GeoCore <span>2026</span></h1>
        <div class="btn-group">
          <button @click="setProjection('globe')" :class="{active: proj==='globe'}">Globo</button>
          <button @click="setProjection('mercator')" :class="{active: proj==='mercator'}">Mercator</button>
          <button @click="setProjection('equirectangular')" :class="{active: proj==='equirectangular'}">Equidistante</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const proj = ref('mercator');
let map = null;

onMounted(() => {
  console.log('🗺️ GeoCore: Initializing Map...');
  map = new maplibregl.Map({
    container: 'map',
    style: '/style.json',
    center: [-62.275, -38.725],
    zoom: 12,
    antialias: true
  });

  map.on('load', () => {
    console.log('✅ GeoCore: Map Loaded');
    console.log('Sources:', map.getStyle().sources);
  });

  map.on('error', (e) => {
    console.error('❌ GeoCore Error:', e);
  });
});

const setProjection = (name) => {
  proj.value = name;
  map.setProjection({ name });
};
</script>

<style scoped>
.geocore-viewport { position: relative; width: 100vw; height: 100vh; background: #0b0d17; overflow: hidden; }
#map { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }

.controls-overlay {
  position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
  z-index: 10; width: 90%; max-width: 800px;
}

.top-nav {
  display: flex; justify-content: space-between; align-items: center;
  padding: 15px 25px;
  background: rgba(15, 20, 35, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(100, 255, 218, 0.2);
  border-radius: 50px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.4);
}

.logo { color: #fff; font-size: 1.2rem; margin: 0; font-weight: 800; }
.logo span { color: #64ffda; }

.btn-group { display: flex; gap: 10px; }
button {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  color: #fff; padding: 8px 18px; border-radius: 20px; cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 600;
  font-size: 0.85rem;
}
button:hover, button.active { background: #64ffda; color: #0b0d17; border-color: #64ffda; box-shadow: 0 0 15px rgba(100, 255, 218, 0.3); }
</style>
