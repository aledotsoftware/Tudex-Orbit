---

# Tudex Orbit 🛰️

**Tudex Orbit** es una consola de operaciones orbitales y monitoreo satelital soberano desarrollado por [Tudex Networks][], de código abierto y autogestionado. Permite rastrear la posición en tiempo real de satélites activos (principalmente radioaficionados y meteorológicos), predecir ventanas de paso sobre estaciones terrenas locales y consultar información técnica de radiofrecuencias.

Está diseñado como una alternativa libre e independiente para el seguimiento espacial: cualquier organización, universidad o radioaficionado puede desplegarlo en su propia infraestructura y operar sin depender de servicios web privativos externos.

---

# GeoCore Orbit Engine 🌍

GeoCore Orbit es una plataforma cartográfica y de cálculo orbital soberana de alto rendimiento. Diseñada para operar de forma autónoma, renderiza mapas globales, calcula eficientemente trayectorias orbitales en el cliente a partir de datos TLE en tiempo real, y provee herramientas avanzadas de instrumentación para radioaficionados y estaciones de escucha.

## 🚀 Características Principales

* **Rastreador de Constelaciones Completo:** Visualización en tiempo real de todos los satélites catalogados orbitando la Tierra de manera simultánea en WebGL.
* **Proyecciones Dinámicas:**
  * Mercator (Estándar web).
  * Globo 3D (Visión espacial realista).
* **Cálculo Orbital Local (Zero-Server):** Propagación de órbitas utilizando `satellite.js` basado en el modelo SGP4/SDP4 de la USAF en tiempo real en el navegador del usuario.
* **Cono de Visibilidad (Footprint):** Renderizado de la huella de cobertura geográfica en vivo de cada satélite con isolíneas de elevación dinámica (0°, 10°, 30°).
* **Predicción de Pases:** Cálculo instantáneo de ventanas de paso, tiempo de duración e inclinación máxima para cualquier coordenada terrestre (Estación Terrena).
* **Frecuencias de Radioaficionados:** Consulta y despliegue de frecuencias de Uplink, Downlink y modos de modulación (FM, GFSK, SSB/CW).




## 🏗 Arquitectura del Sistema

El proyecto se divide en tres capas principales:

1. **Capa de Datos y Teselas:**
   * **Martin Vector Tile Server:** Servidor escrito en Rust que sirve teselas vectoriales locales (`.mbtiles`) a la interfaz de MapLibre GL.
   * **Planetiler:** Herramienta de alta velocidad para generar archivos `.mbtiles` a partir de mapas globales de OpenStreetMap.

2. **Capa de Frontend y Cálculo:**
   * **React + Vite + TypeScript:** Entorno de desarrollo moderno y rápido.
   * **MapLibre GL JS:** Motor de renderizado cartográfico que utiliza WebGL/WebGPU para mostrar el mapa en 2D o Globo 3D con gran rendimiento.
   * **Satellite.js:** Librería matemática de dinámica celeste que propaga órbitas basándose en TLEs y el modelo SGP4.

---

## 🛠 Instalación y Configuración (Guía Rápida)

### 1. Iniciar los contenedores del sistema (Martin y Frontend)

```bash
docker compose up -d --build
```

Esto compilará y ejecutará:
* **geocore-martin:** Servidor de mapas en el puerto `3000`.
* **geocore-web:** Interfaz de usuario React en el puerto `51744` (redirige a `3000` interno).

### 2. Generar o descargar teselas MBTiles (Opcional)

Si necesitas generar mapas locales personalizados:
```bash
docker compose --profile generate up -d planetiler
```

---

## 📝 Roadmap de Desarrollo

* [x] Conversión e integración completa a **Tudex Orbit**.
* [x] Implementación de propagador orbital SGP4 local en cliente.
* [x] Visualización interactiva en tiempo real de toda la constelación satelital en el mapa.
* [x] Modelado de huellas de cobertura (footprint) dinámicas con isolíneas.
* [x] Panel de instrumentación y calculadora de pases terrestres.
* [ ] Soporte para comandos CAT para control de rotores de antena físicos.