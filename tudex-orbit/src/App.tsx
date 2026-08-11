import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as satellite from 'satellite.js';
import {
  Search, Menu, ZoomIn, ZoomOut, Compass,
  MapPin, ChevronLeft, Globe, Sun, Moon, Activity, Wifi, BookOpen, FileText,
  LogOut, ShieldCheck, Lock, AlertCircle
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface AppConfig {
  appName: string;
  map: {
    styleUrl: string;
    center: [number, number];
    zoom: number;
    minZoom: number;
    projection?: string;
  };
  servers: {
    label: string;
    key: string;
    url: string;
  }[];
  styles: {
    id: string;
    label: string;
    url: string;
    isLocal: boolean;
  }[];
  layers: {
    id: string;
    label: string;
    color: string;
  }[];
  footerText: string;
}

interface Satellite {
  id: string;
  name: string;
  category: string;
  description: string;
  image: string;
  uplink: string;
  downlink: string;
  mode: string;
  tle1: string;
  tle2: string;
}

interface SatellitePosition {
  lat: number;
  lng: number;
  alt: number;
  speed: number;
}

interface SatellitePass {
  start: Date;
  end: Date;
  maxElevation: number;
  duration: number;
}

// Genera un polígono circular GeoJSON geodésico y contiguo sin distorsión
function getCirclePolygon(center: [number, number], radiusKm: number, properties?: any) {
  const points = 64;
  const coords: [number, number][] = [];
  const R = 6371; // Radio medio de la Tierra en km
  const angularRadius = radiusKm / R; // en radianes

  const centerLngRad = center[0] * Math.PI / 180;
  const centerLatRad = center[1] * Math.PI / 180;

  for (let i = 0; i <= points; i++) {
    const bearing = (i * 2 * Math.PI) / points;

    const latRad = Math.asin(
      Math.sin(centerLatRad) * Math.cos(angularRadius) +
      Math.cos(centerLatRad) * Math.sin(angularRadius) * Math.cos(bearing)
    );

    const lngRad = centerLngRad + Math.atan2(
      Math.sin(bearing) * Math.sin(angularRadius) * Math.cos(centerLatRad),
      Math.cos(angularRadius) - Math.sin(centerLatRad) * Math.sin(latRad)
    );

    let lat = latRad * 180 / Math.PI;
    let lng = lngRad * 180 / Math.PI;
    
    // Evitar estiramiento infinito cerca de los polos (límite en proyección Mercator)
    if (lat > 85) lat = 85;
    if (lat < -85) lat = -85;
    
    // Ajustar longitud para mantener continuidad respecto al centro y evitar cruces bruscos
    while (lng - center[0] > 180) lng -= 360;
    while (lng - center[0] < -180) lng += 360;

    coords.push([lng, lat]);
  }
  
  return {
    type: 'Feature',
    properties: properties || {},
    geometry: {
      type: 'Polygon',
      coordinates: [coords]
    }
  };
}

// Calcula el radio terrestre en km de un cono de visibilidad a cierto ángulo de elevación
function getElevationRadiusKm(altKm: number, elevationDegrees: number) {
  const R = 6371; // Radio medio de la Tierra en km
  const E = elevationDegrees * Math.PI / 180; // en radianes
  const cosE = Math.cos(E);
  const ratio = (R / (R + altKm)) * cosE;
  if (ratio > 1) return 0;
  const eta = Math.acos(ratio) - E;
  if (eta < 0) return 0;
  return R * eta;
}

interface Article {
  id: string;
  title: string;
  category: string;
  content: React.ReactNode;
}

const ARTICLES: Article[] = [
  {
    id: 'evo-arch',
    title: 'Evolución y Arquitectura de las Comunicaciones Espaciales',
    category: 'Historia y Arquitectura',
    content: (
      <div className="space-y-3.5 text-xs text-muted-foreground leading-relaxed">
        <p>
          El monitoreo y la operación a través de satélites de radioaficionados representan una de las intersecciones más fascinantes entre la ingeniería aeroespacial y las telecomunicaciones ciudadanas. Desde el lanzamiento del primer satélite OSCAR (Orbiting Satellite Carrying Amateur Radio) en 1961, la comunidad global ha diseñado, financiado y operado decenas de plataformas orbitales.
        </p>
        <p>
          La evolución reciente de la tecnología de nanosatélites (CubeSats) ha democratizado el acceso al espacio, permitiendo que universidades e institutos de investigación lancen cargas útiles científicas que incluyen transpondedores, balizas telemétricas y digirepetidores accesibles para estaciones terrenas no comerciales.
        </p>
        <div className="rounded-lg border border-border bg-muted/30 p-3 my-2 text-[11px] text-foreground">
          <p className="font-semibold mb-1">Arquitectura de Enlaces Cruzados (Cross-Band)</p>
          Se basa predominantemente en frecuencias de VHF y UHF. Las asignaciones primarias para el enlace ascendente (Uplink) y descendente (Downlink) se concentran en las bandas de 144–146 MHz y 432–438 MHz, respectivamente.
        </div>
        <p>
          La transición tecnológica de las últimas décadas ha redefinido el hardware orbital. Originalmente, los satélites dependían de transpondedores analógicos lineales que retransmitían porciones enteras del espectro (permitiendo múltiples contactos simultáneos en Banda Lateral Única o Código Morse). Hoy en día, la saturación del espectro y la miniaturización han dado paso a repetidores de Frecuencia Modulada (FM) de un solo canal y a sofisticados digirepetidores de paquetes AX.25, modulación por desplazamiento de frecuencia (FSK) y televisión de barrido lento (SSTV).
        </p>
      </div>
    )
  },
  {
    id: 'freq-spec',
    title: 'Asignaciones de Frecuencias y Gestión del Espectro',
    category: 'Espectro Radioeléctrico',
    content: (
      <div className="space-y-3.5 text-xs text-muted-foreground leading-relaxed">
        <p>
          La gestión del espectro radioeléctrico espacial exige una coordinación rigurosa gestionada por la Unión Internacional de Radioaficionados (IARU) y la Unión Internacional de Telecomunicaciones (UIT). El auge masivo de lanzamientos compartidos (rideshare) ha generado una congestión sin precedentes en las bandas tradicionales. Las redes de estaciones terrenas distribuidas, como SatNOGS, requieren evidencia explícita de coordinación de la IARU para catalogar y programar el seguimiento automático de un satélite.
        </p>
        
        <div className="overflow-x-auto my-3 rounded-md border border-border">
          <table className="w-full text-left text-[10px] border-collapse">
            <thead>
              <tr className="bg-muted/80 text-foreground border-b border-border font-bold">
                <th className="p-2">Banda</th>
                <th className="p-2">Rango</th>
                <th className="p-2">Aplicación Principal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr>
                <td className="p-2 font-medium text-foreground">VHF</td>
                <td className="p-2">136–138 MHz</td>
                <td className="p-2">Satélites meteorológicos (ej. NOAA) con transmisiones APT/LRPT.</td>
              </tr>
              <tr>
                <td className="p-2 font-medium text-foreground">VHF</td>
                <td className="p-2">144–146 MHz</td>
                <td className="p-2">Banda primaria amateur. Enlaces ascendentes de satélites FM y telemetría digital.</td>
              </tr>
              <tr>
                <td className="p-2 font-medium text-foreground">UHF</td>
                <td className="p-2">432–438 MHz</td>
                <td className="p-2">Segmento popular para transpondedores lineales y balizas. Mayor Doppler.</td>
              </tr>
              <tr>
                <td className="p-2 font-medium text-foreground">Banda L</td>
                <td className="p-2">1.26 GHz</td>
                <td className="p-2">Uplink alternativo para evitar congestión, emparejado con Banda S o VHF.</td>
              </tr>
              <tr>
                <td className="p-2 font-medium text-foreground">Banda S</td>
                <td className="p-2">2.40 GHz</td>
                <td className="p-2">Enlaces descendentes de alta velocidad (DATV) y satélites experimentales.</td>
              </tr>
              <tr>
                <td className="p-2 font-medium text-foreground">Banda X</td>
                <td className="p-2">10.45 GHz</td>
                <td className="p-2">Satélites geoestacionarios (ej. QO-100) para banda estrecha y ancha.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-[11px] text-foreground leading-normal">
          <span className="font-bold text-destructive">Alerta de Interferencia Cosmológica:</span> El crecimiento exponencial de constelaciones congestiona el espectro y genera interferencias perjudiciales en la radioastronomía. Investigaciones recientes en el rango del telescopio SKA-Low (50 - 350 MHz) revelan que las emisiones de satélites en las bandas de 137 MHz y 145 MHz contaminan observaciones cosmológicas críticas. Dado que solo el 3.7% de este rango goza de protección primaria, se llega a descartar hasta un 73% de las imágenes astronómicas en ciertos periodos.
        </div>
      </div>
    )
  },
  {
    id: 'orbit-dyn',
    title: 'Dinámica Orbital y Evolución de los TLE',
    category: 'Mecánica Orbital',
    content: (
      <div className="space-y-3.5 text-xs text-muted-foreground leading-relaxed">
        <p>
          Para lograr establecer un enlace o decodificar telemetría espacial, las estaciones terrenas deben compensar factores dinámicos severos dictados por la mecánica orbital. La inmensa mayoría de los satélites amateur operan en Órbita Terrestre Baja (LEO), a altitudes de entre 400 y 800 km, viajando a velocidades medias de 27,000 km/h para mantener el equilibrio orbital.
        </p>
        <p>
          Esta altísima velocidad relativa genera un desplazamiento Doppler significativo. En la banda de 435 MHz, la señal de bajada puede desviarse hasta ±10 kHz durante una pasada típica de 10 a 15 minutos, exigiendo sistemas de seguimiento automatizados y algoritmos de control automático de frecuencia (AFC).
        </p>
        <div className="rounded-lg border border-border bg-muted/30 p-3 my-2 text-[11px] text-foreground">
          <p className="font-semibold mb-1">Evolución de Datos Espaciales</p>
          Históricamente, los programas de seguimiento descargaban archivos de texto estáticos (como amateur.txt) de CelesTrak. No obstante, la proliferación de constelaciones comerciales (hasta 100,000 nuevos satélites) agotará el sistema tradicional de 5 dígitos del catálogo NORAD (al superar 99,999). Como solución, los repositorios modernos migran hacia el formato OMM (Orbit Mean-Elements Message) JSON o CSV.
        </div>
      </div>
    )
  },
  {
    id: 'ground-station',
    title: 'Infraestructura de Estaciones Terrenas y Decodificación',
    category: 'Operación Terrestre',
    content: (
      <div className="space-y-3.5 text-xs text-muted-foreground leading-relaxed">
        <p>
          El acceso a las comunicaciones espaciales varía desde configuraciones portátiles minimalistas hasta complejos observatorios automatizados. Para operaciones en satélites de FM (como SO-50 o la ISS), los operadores suelen utilizar transceptores portátiles (HT) en modo dúplex cruzado emparejados con antenas direccionales de mano (como Arrow II o Elk).
        </p>

        <div className="overflow-x-auto my-3 rounded-md border border-border">
          <table className="w-full text-left text-[10px] border-collapse">
            <thead>
              <tr className="bg-muted/80 text-foreground border-b border-border font-bold">
                <th className="p-2">Componente</th>
                <th className="p-2">Función</th>
                <th className="p-2">Hardware Típico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr>
                <td className="p-2 font-medium text-foreground">Receptor (SDR)</td>
                <td className="p-2">Digitalización del espectro con gran ancho de banda.</td>
                <td className="p-2">RTL-SDR, Nooelec NESDR, FUNcube Dongle.</td>
              </tr>
              <tr>
                <td className="p-2 font-medium text-foreground">Transceptor Base</td>
                <td className="p-2">Transmisión/recepción full-duplex con corrección CAT por PC.</td>
                <td className="p-2">Icom IC-9700, Yaesu FT-991A.</td>
              </tr>
              <tr>
                <td className="p-2 font-medium text-foreground">Antenas</td>
                <td className="p-2">Ganancia direccional con polarización circular para mitigar spin fading.</td>
                <td className="p-2">Yagi cruzadas, Helicoidales, Rotores Az/El.</td>
              </tr>
              <tr>
                <td className="p-2 font-medium text-foreground">Decodificador TNC</td>
                <td className="p-2">Demodulación digital y extracción de tramas AX.25.</td>
                <td className="p-2">Direwolf, fldigi, SatNOGS Client.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p>
          Un ejemplo notable de colaboración es el flujo de trabajo para extraer telemetría científica. Satélites como FO-29 transmiten telemetría en telegrafía continua (CW). Los operadores enrutan el audio del SDR hacia programas como fldigi para decodificar Morse a hexadecimal, procesando los datos mediante scripts de Python para cargarlos directamente en la API de SatNOGS, alimentando cuadros de mando públicos.
        </p>
      </div>
    )
  },
  {
    id: 'case-studies',
    title: 'Análisis de Casos: Ingeniería y Supervivencia en Órbita',
    category: 'Casos de Estudio',
    content: (
      <div className="space-y-3.5 text-xs text-muted-foreground leading-relaxed">
        <p>
          El ecosistema satelital amateur es un entorno de ingeniería resiliente donde se manifiestan fenómenos operacionales únicos. A continuación se presentan tres casos de estudio excepcionales:
        </p>
        <div className="rounded-lg border border-border bg-muted/20 p-3 my-2 text-[11px] space-y-1.5">
          <p className="font-semibold text-foreground">1. AO-7 (AMSAT-OSCAR 7) - Resurrección Física</p>
          <p className="text-muted-foreground text-[10px]">
            Lanzado en 1974, sufrió un cortocircuito catastrófico de baterías en 1981 que lo silenció. En 2002, tras décadas de degradación térmica, el cortocircuito se transformó en circuito abierto, permitiendo que los paneles solares alimenten directamente los transpondedores. Hoy en día, el satélite "revive" cada vez que entra en luz solar directa.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3 my-2 text-[11px] space-y-1.5">
          <p className="font-semibold text-foreground">2. RS-44 (DOSAAF-85) - Adaptación a Fallas de Separación</p>
          <p className="text-muted-foreground text-[10px]">
            Lanzado en 2019, falló al separarse del cohete Breeze-KM. Conectado a esta gran masa, su estabilización por gradiente de gravedad quedó inoperante, resultando en un giro caótico (tumbling) que genera desvanecimientos periódicos de señal (QSB). Sin embargo, su órbita elíptica alta de 1511 km ofrece coberturas transatlánticas sobresalientes.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3 my-2 text-[11px] space-y-1.5">
          <p className="font-semibold text-foreground">3. GreenCube (IO-117) - De la Biología al Gateway Mundial</p>
          <p className="text-muted-foreground text-[10px]">
            Ubicado en MEO a 5,800 km de altitud para probar cultivos hidropónicos en microgravedad. Al terminar su misión biológica primaria, se activó su digirepetidor amateur de 1200/2400 bps FSK. Por su altitud, sus pasadas duran más de una hora, cubriendo múltiples continentes en simultáneo y actuando como pasarela de datos intercontinental.
          </p>
        </div>
      </div>
    )
  }
];
const SatelliteIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="4" height="8" x="2" y="12" rx="1"/>
    <rect width="4" height="8" x="18" y="4" rx="1"/>
    <path d="m17 7-3 3"/>
    <path d="m7 14-3 3"/>
    <path d="M14.5 8.5 16 10l-6 6-1.5-1.5z"/>
    <path d="m8 8 8 8"/>
    <path d="M12 5a7 7 0 0 1 7 7"/>
  </svg>
);

export default function App() {
  const { user, isAuthenticated, isLoading: authLoading, error: authError, login, logout } = useAuth();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [satellitesData, setSatellitesData] = useState<Satellite[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showAllSatellites, setShowAllSatellites] = useState(true);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return 'dark';
    }
    return 'dark';
  });

  const [logs, setLogs] = useState<string[]>([]);
  
  // Estados para la biblioteca de telecomunicaciones
  const [activeSidebarTab, setActiveSidebarTab] = useState<'monitoring' | 'library'>('monitoring');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Estados específicos de Satélites e Instrumentación de Órbitas
  const [selectedSatellite, setSelectedSatellite] = useState<string | null>(null);
  const [observerCoords, setObserverCoords] = useState<[number, number]>([-62.275, -38.725]); // Bahía Blanca por defecto
  const [observerAlt, setObserverAlt] = useState<number>(20); // Metros sobre el nivel del mar
  const [satellitePositions, setSatellitePositions] = useState<Record<string, SatellitePosition>>({});
  const [satelliteVisible, setSatelliteVisible] = useState<Record<string, boolean>>({});
  const [satellitePasses, setSatellitePasses] = useState<SatellitePass[]>([]);
  const [nextPassTimes, setNextPassTimes] = useState<Record<string, Date | null>>({});

  // Filtrado de satélites en base a la búsqueda (estilo Google Maps)
  const filteredSatellites = satellitesData.filter(sat =>
    sat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sat.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sat.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Ordenar resultados: 1. Visibles, 2. Próximos a pasar (tiempo ascendente), 3. Invisibles
  const sortedFilteredSatellites = [...filteredSatellites].sort((a, b) => {
    const aVisible = satelliteVisible[a.id] || false;
    const bVisible = satelliteVisible[b.id] || false;

    if (aVisible && !bVisible) return -1;
    if (!aVisible && bVisible) return 1;
    if (aVisible && bVisible) return a.name.localeCompare(b.name);

    const aNextPass = nextPassTimes[a.id];
    const bNextPass = nextPassTimes[b.id];

    if (aNextPass && !bNextPass) return -1;
    if (!aNextPass && bNextPass) return 1;
    if (aNextPass && bNextPass) return aNextPass.getTime() - bNextPass.getTime();

    return a.name.localeCompare(b.name);
  });

  // Referencias para marcadores del mapa
  const satMarker = useRef<maplibregl.Marker | null>(null);
  const obsMarker = useRef<maplibregl.Marker | null>(null);

  // Cargar configuraciones al montar
  useEffect(() => {
    fetch('/config.json')
      .then(r => {
        if (!r.ok) throw new Error(`Status: ${r.status}`);
        return r.json();
      })
      .then((data: AppConfig) => {
        setConfig(data);
      })
      .catch(e => {
        setLogs(prev => [...prev, `Error al cargar configuración: ${e.message}`]);
      });

    fetch('/satellites.json')
      .then(r => {
        if (!r.ok) throw new Error(`Status: ${r.status}`);
        return r.json();
      })
      .then((data: Satellite[]) => {
        setSatellitesData(data);
      })
      .catch(e => {
        setLogs(prev => [...prev, `Error al cargar satélites: ${e.message}`]);
      });
  }, []);

  // Gestionar modo oscuro
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Geolocalización del observador al iniciar
  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setObserverCoords([pos.coords.longitude, pos.coords.latitude]);
          if (pos.coords.altitude) setObserverAlt(pos.coords.altitude);
        },
        (err) => {
          setLogs(prev => [...prev.slice(-4), `Geolocalización: ${err.message}`]);
        }
      );
    } else {
      setLogs(prev => [...prev.slice(-4), 'Geolocalización no soportada']);
    }
  };

  useEffect(() => {
    getUserLocation();
  }, []);

  // Agregar capas vectoriales del satélite al estilo del mapa
  const addSatelliteLayers = (m: maplibregl.Map) => {
    if (!m.getSource('sat-orbit')) {
      m.addSource('sat-orbit', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      
      m.addLayer({
        id: 'sat-orbit-layer',
        type: 'line',
        source: 'sat-orbit',
        filter: ['==', ['get', 'type'], 'orbit-line'],
        paint: {
          'line-color': '#3b82f6',
          'line-width': 2,
          'line-dasharray': [3, 2]
        }
      });
      
      m.addLayer({
        id: 'sat-orbit-arrows-layer',
        type: 'symbol',
        source: 'sat-orbit',
        filter: ['==', ['get', 'type'], 'orbit-line'],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 80,
          'text-field': '▶',
          'text-size': 10,
          'text-keep-upright': false,
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': '#3b82f6',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1
        }
      });

      m.addLayer({
        id: 'sat-orbit-points-layer',
        type: 'circle',
        source: 'sat-orbit',
        filter: ['==', ['get', 'type'], 'orbit-point'],
        paint: {
          'circle-radius': 4,
          'circle-color': '#3b82f6',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      m.addLayer({
        id: 'sat-orbit-labels-layer',
        type: 'symbol',
        source: 'sat-orbit',
        filter: ['==', ['get', 'type'], 'orbit-point'],
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 10,
          'text-offset': [0, 1.2],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#3b82f6',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5
        }
      });
    }

    if (!m.getSource('sat-footprint')) {
      m.addSource('sat-footprint', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      m.addLayer({
        id: 'sat-footprint-layer',
        type: 'fill',
        source: 'sat-footprint',
        paint: {
          'fill-color': ['coalesce', ['get', 'color'], '#3b82f6'],
          'fill-opacity': ['coalesce', ['get', 'opacity'], 0.08]
        }
      });
      m.addLayer({
        id: 'sat-footprint-outline-layer',
        type: 'line',
        source: 'sat-footprint',
        paint: {
          'line-color': ['coalesce', ['get', 'strokeColor'], '#3b82f6'],
          'line-width': 1.5,
          'line-opacity': 0.8
        }
      });
    }

    if (!m.getSource('all-sats')) {
      m.addSource('all-sats', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      m.addLayer({
        id: 'all-sats-glow-layer',
        type: 'circle',
        source: 'all-sats',
        paint: {
          'circle-radius': ['case', ['boolean', ['get', 'isSelected'], false], 12, 6],
          'circle-color': ['case', ['boolean', ['get', 'isVisible'], false], '#10b981', '#3b82f6'],
          'circle-opacity': ['case', ['boolean', ['get', 'isSelected'], false], 0.35, 0.12],
          'circle-stroke-width': ['case', ['boolean', ['get', 'isSelected'], false], 1.5, 0],
          'circle-stroke-color': ['case', ['boolean', ['get', 'isVisible'], false], '#10b981', '#3b82f6']
        }
      });

      m.addLayer({
        id: 'all-sats-point-layer',
        type: 'circle',
        source: 'all-sats',
        paint: {
          'circle-radius': ['case', ['boolean', ['get', 'isSelected'], false], 5, 3],
          'circle-color': ['case', ['boolean', ['get', 'isVisible'], false], '#10b981', '#3b82f6'],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff'
        }
      });

      m.addLayer({
        id: 'all-sats-label-layer',
        type: 'symbol',
        source: 'all-sats',
        minzoom: 2.2,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 9,
          'text-offset': [0, 1.1],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': ['case', ['boolean', ['get', 'isSelected'], false], '#00d0ff', '#cfd8ec'],
          'text-halo-color': '#0d111e',
          'text-halo-width': 1.5
        }
      });
    }
  };

  // Inicialización del mapa
  useEffect(() => {
    if (!config) return;

    const handleErr = (msg: string) => {
      setLogs(prev => [...prev.slice(-4), msg]);
    };

    if (map.current || !mapContainer.current) return;

    try {
      const m = new maplibregl.Map({
        container: mapContainer.current,
        style: config.map.styleUrl,
        center: config.map.center,
        zoom: config.map.zoom,
        minZoom: config.map.minZoom,
      });

      if (config.map.projection) {
        m.on('style.load', () => {
          m.setProjection({
            type: config.map.projection as any
          });
        });
      }

      m.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: false }), 'bottom-right');
      m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

      m.on('load', () => {
        addSatelliteLayers(m);
        setMapLoaded(true);
      });

      // Al hacer clic en el mapa, selecciona el satélite si se hace clic sobre él, de lo contrario mueve el observador
      m.on('click', (e) => {
        const features = m.queryRenderedFeatures(e.point, {
          layers: ['all-sats-glow-layer', 'all-sats-point-layer']
        });

        if (features && features.length > 0 && features[0].properties?.id) {
          const satId = features[0].properties.id;
          setSelectedSatellite(satId);
          const geom = features[0].geometry as any;
          if (geom && geom.coordinates) {
            m.flyTo({ center: geom.coordinates, zoom: 3, duration: 1200 });
          }
        } else {
          setObserverCoords([e.lngLat.lng, e.lngLat.lat]);
        }
      });

      // Cambiar cursor al pasar sobre satélites
      m.on('mouseenter', 'all-sats-glow-layer', () => {
        m.getCanvas().style.cursor = 'pointer';
      });
      m.on('mouseleave', 'all-sats-glow-layer', () => {
        m.getCanvas().style.cursor = '';
      });

      m.on('error', (e) => {
        if (e.error?.message?.includes('Image')) return;
        handleErr(`MapLibre: ${e.error?.message || 'Error de carga'}`);
      });

      map.current = m;
    } catch (e: any) {
      handleErr(`Init map: ${e.message}`);
    }

    return () => { map.current?.remove(); map.current = null; };
  }, [config]);

  // Actualizar posiciones de satélites en tiempo real (segundo a segundo)
  useEffect(() => {
    if (satellitesData.length === 0) return;

    const calculatePositions = () => {
      const positions: Record<string, SatellitePosition> = {};
      const visible: Record<string, boolean> = {};
      const now = new Date();
      const gmst = satellite.gstime(now);

      satellitesData.forEach(sat => {
        try {
          const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
          const positionAndVelocity = satellite.propagate(satrec, now);
          if (positionAndVelocity && positionAndVelocity.position && positionAndVelocity.velocity) {
            const posEci = positionAndVelocity.position as any;
            const velEci = positionAndVelocity.velocity as any;
            const posGd = satellite.eciToGeodetic(posEci, gmst);
            const lng = satellite.degreesLong(posGd.longitude);
            const lat = satellite.degreesLat(posGd.latitude);
            const alt = posGd.height;

            const speed = Math.round(
              Math.sqrt(
                velEci.x * velEci.x +
                velEci.y * velEci.y +
                velEci.z * velEci.z
              ) * 3600
            );

            positions[sat.id] = { lat, lng, alt, speed };

            // Visibilidad desde observador
            const observerGeodetic = {
              longitude: satellite.degreesToRadians(observerCoords[0]),
              latitude: satellite.degreesToRadians(observerCoords[1]),
              height: observerAlt / 1000
            };

            const posEcf = satellite.eciToEcf(posEci, gmst);
            const lookAngles = satellite.ecfToLookAngles(observerGeodetic, posEcf);
            const elevDegrees = lookAngles.elevation * (180 / Math.PI);

            visible[sat.id] = elevDegrees > 0;
          }
        } catch (e) {}
      });

      setSatellitePositions(positions);
      setSatelliteVisible(visible);

      // Compilar y actualizar capa de todos los satélites en tiempo real
      const features = satellitesData.map(sat => {
        const pos = positions[sat.id];
        if (!pos) return null;
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [pos.lng, pos.lat]
          },
          properties: {
            id: sat.id,
            name: sat.name,
            isVisible: visible[sat.id] || false,
            isSelected: sat.id === selectedSatellite
          }
        };
      }).filter(Boolean);

      if (map.current && mapLoaded) {
        const source = map.current.getSource('all-sats') as maplibregl.GeoJSONSource;
        if (source) {
          source.setData({
            type: 'FeatureCollection',
            features: features as any
          });
        }
      }
    };

    calculatePositions();
    const interval = setInterval(calculatePositions, 1000);
    return () => clearInterval(interval);
  }, [satellitesData, observerCoords, observerAlt, selectedSatellite, mapLoaded]);

  // Alternar la visibilidad de la capa con todos los satélites
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const visibility = showAllSatellites ? 'visible' : 'none';
    ['all-sats-glow-layer', 'all-sats-point-layer', 'all-sats-label-layer'].forEach(layerId => {
      if (map.current?.getLayer(layerId)) {
        map.current.setLayoutProperty(layerId, 'visibility', visibility);
      }
    });
  }, [showAllSatellites, mapLoaded]);

  // Calcular pases en las próximas 3 horas para todos los satélites
  useEffect(() => {
    if (satellitesData.length === 0) return;

    const calculateNextPasses = () => {
      const nextPasses: Record<string, Date | null> = {};
      const observerGeodetic = {
        longitude: satellite.degreesToRadians(observerCoords[0]),
        latitude: satellite.degreesToRadians(observerCoords[1]),
        height: observerAlt / 1000
      };

      const now = new Date();

      satellitesData.forEach(sat => {
        try {
          const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
          let foundPassTime: Date | null = null;
          
          // Muestrear las próximas 3 horas (180 minutos) en intervalos de 1.5 minutos para performance
          for (let offset = 0; offset < 180; offset += 1.5) {
            const time = new Date(now.getTime() + offset * 60 * 1000);
            const gmst = satellite.gstime(time);
            const posVel = satellite.propagate(satrec, time);
            
            if (posVel && posVel.position) {
              const pos = posVel.position as any;
              const posEcf = satellite.eciToEcf(pos, gmst);
              const lookAngles = satellite.ecfToLookAngles(observerGeodetic, posEcf);
              const elev = lookAngles.elevation * (180 / Math.PI);

              if (elev > 0) {
                foundPassTime = time;
                break;
              }
            }
          }
          nextPasses[sat.id] = foundPassTime;
        } catch (e) {
          nextPasses[sat.id] = null;
        }
      });

      console.log("Calculated next passes:", nextPasses);
      setNextPassTimes(nextPasses);
    };

    calculateNextPasses();
    // Ejecutar cada 30 segundos
    const interval = setInterval(calculateNextPasses, 30000);
    return () => clearInterval(interval);
  }, [satellitesData, observerCoords, observerAlt]);

  // Dibujar y actualizar la línea orbitalGeoJSON del satélite seleccionado
  useEffect(() => {
    if (!map.current || !mapLoaded || !selectedSatellite || satellitesData.length === 0) return;

    const sat = satellitesData.find(s => s.id === selectedSatellite);
    if (!sat) return;

    try {
      const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
      const orbitCoords: [number, number][] = [];
      const now = new Date();

      // Muestrear 90 minutos de órbita para la línea (ajustando continuidad de longitud)
      for (let i = -45; i <= 45; i += 1.5) {
        const time = new Date(now.getTime() + i * 60 * 1000);
        const gmst = satellite.gstime(time);
        const posVel = satellite.propagate(satrec, time);
        if (posVel && posVel.position) {
          const pos = posVel.position as any;
          const posGd = satellite.eciToGeodetic(pos, gmst);
          let lng = satellite.degreesLong(posGd.longitude);
          const lat = satellite.degreesLat(posGd.latitude);
          
          if (orbitCoords.length > 0) {
            const prevLng = orbitCoords[orbitCoords.length - 1][0];
            while (lng - prevLng > 180) lng -= 360;
            while (lng - prevLng < -180) lng += 360;
          }
          orbitCoords.push([lng, lat]);
        }
      }

      const orbitFeatures: any[] = [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: orbitCoords
          },
          properties: { type: 'orbit-line' }
        }
      ];

      // Obtener la longitud de referencia del satélite para ajustar predicciones
      let refLng = 0;
      const currentPosVel = satellite.propagate(satrec, now);
      if (currentPosVel && currentPosVel.position) {
        const pos = currentPosVel.position as any;
        const gmst = satellite.gstime(now);
        const posGd = satellite.eciToGeodetic(pos, gmst);
        refLng = satellite.degreesLong(posGd.longitude);
      }

      // Añadir puntos de predicción futura para marcar dirección y tiempo (+15m, +30m, +45m)
      [15, 30, 45].forEach(offset => {
        const time = new Date(now.getTime() + offset * 60 * 1000);
        const gmst = satellite.gstime(time);
        const posVel = satellite.propagate(satrec, time);
        if (posVel && posVel.position) {
          const pos = posVel.position as any;
          const posGd = satellite.eciToGeodetic(pos, gmst);
          let lng = satellite.degreesLong(posGd.longitude);
          const lat = satellite.degreesLat(posGd.latitude);
          
          // Ajustar respecto a la referencia de longitud del satélite para evitar saltos
          while (lng - refLng > 180) lng -= 360;
          while (lng - refLng < -180) lng += 360;

          orbitFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [lng, lat]
            },
            properties: {
              type: 'orbit-point',
              label: `+${offset}m`
            }
          });
        }
      });

      const source = map.current.getSource('sat-orbit') as maplibregl.GeoJSONSource;
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: orbitFeatures
        });
      }
    } catch (e) {}
  }, [selectedSatellite, satellitesData, mapLoaded]);

  // Calcular pases futuros del satélite seleccionado
  useEffect(() => {
    if (!selectedSatellite || satellitesData.length === 0) {
      setSatellitePasses([]);
      return;
    }

    const sat = satellitesData.find(s => s.id === selectedSatellite);
    if (!sat) return;

    try {
      const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
      const observerGeodetic = {
        longitude: satellite.degreesToRadians(observerCoords[0]),
        latitude: satellite.degreesToRadians(observerCoords[1]),
        height: observerAlt / 1000
      };

      const calculatedPasses: SatellitePass[] = [];
      let inPass = false;
      let passStart: Date | null = null;
      let maxElev = 0;
      const now = new Date();

      // Muestrear las próximas 24 horas (en intervalos de 1.5 minutos para performance)
      for (let offset = 0; offset < 1440; offset += 1.5) {
        const time = new Date(now.getTime() + offset * 60 * 1000);
        const gmst = satellite.gstime(time);
        const posVel = satellite.propagate(satrec, time);
        if (posVel && posVel.position) {
          const pos = posVel.position as any;
          const posEcf = satellite.eciToEcf(pos, gmst);
          const lookAngles = satellite.ecfToLookAngles(observerGeodetic, posEcf);
          const elev = lookAngles.elevation * (180 / Math.PI);

          if (elev > 0) {
            if (!inPass) {
              inPass = true;
              passStart = time;
              maxElev = elev;
            } else if (elev > maxElev) {
              maxElev = elev;
            }
          } else if (inPass && passStart) {
            inPass = false;
            const duration = Math.round((time.getTime() - passStart.getTime()) / 1000 / 60);
            calculatedPasses.push({
              start: passStart,
              end: time,
              maxElevation: Math.round(maxElev),
              duration
            });
            if (calculatedPasses.length >= 4) break; // Cargar 4 pases principales
          }
        }
      }

      setSatellitePasses(calculatedPasses);
    } catch (e) {}
  }, [selectedSatellite, satellitesData, observerCoords, observerAlt]);

  // Sincronizar marcadores físicos en el mapa (Satélite, Footprint y Observador)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // 1. Marcador del Observador (Ubicación de escucha)
    if (!obsMarker.current) {
      const el = document.createElement('div');
      el.className = 'observer-marker relative bg-primary rounded-full border-2 border-background shadow-md flex items-center justify-center cursor-pointer';
      el.style.width = '12px';
      el.style.height = '12px';
      
      const pulse = document.createElement('div');
      pulse.className = 'absolute w-6 h-6 bg-primary/30 rounded-full animate-ping';
      el.appendChild(pulse);

      obsMarker.current = new maplibregl.Marker({ element: el })
        .setLngLat(observerCoords)
        .addTo(map.current);
    } else {
      obsMarker.current.setLngLat(observerCoords);
    }

    // 2. Marcador del Satélite seleccionado
    if (selectedSatellite && satellitePositions[selectedSatellite]) {
      const pos = satellitePositions[selectedSatellite];
      const coords: [number, number] = [pos.lng, pos.lat];

      if (!satMarker.current) {
        const el = document.createElement('div');
        el.className = 'satellite-marker bg-primary text-primary-foreground p-2 rounded-full border-2 border-background shadow-lg cursor-pointer flex items-center justify-center hover:scale-110 transition-transform relative';
        el.style.width = '34px';
        el.style.height = '34px';
        
        // Add pulsating radar effect
        const pulse = document.createElement('div');
        pulse.className = 'absolute -inset-2 rounded-full bg-primary/20 animate-radar-pulse border border-primary/40';
        el.appendChild(pulse);

        const iconContainer = document.createElement('div');
        iconContainer.className = 'relative z-10';
        iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="4" height="8" x="2" y="12" rx="1"/><rect width="4" height="8" x="18" y="4" rx="1"/><path d="m17 7-3 3"/><path d="m7 14-3 3"/><path d="M14.5 8.5 16 10l-6 6-1.5-1.5z"/><path d="m8 8 8 8"/><path d="M12 5a7 7 0 0 1 7 7"/></svg>';
        el.appendChild(iconContainer);

        satMarker.current = new maplibregl.Marker({ element: el })
          .setLngLat(coords)
          .addTo(map.current);
      } else {
        satMarker.current.setLngLat(coords);
      }

      // Actualizar huella (footprint) como mapa de calor de isolíneas (estilo ARSAT)
      const isGeo = pos.alt > 30000;
      const levels = isGeo ? [
        { elev: 10, color: '#f3e8ff', strokeColor: '#c084fc', opacity: 0.07 },
        { elev: 30, color: '#d8b4fe', strokeColor: '#9333ea', opacity: 0.15 },
        { elev: 45, color: '#a855f7', strokeColor: '#6b21a8', opacity: 0.25 }
      ] : [
        { elev: 0, color: '#f3e8ff', strokeColor: '#c084fc', opacity: 0.07 },
        { elev: 10, color: '#d8b4fe', strokeColor: '#9333ea', opacity: 0.15 },
        { elev: 30, color: '#a855f7', strokeColor: '#6b21a8', opacity: 0.25 }
      ];

      const features: any[] = [];
      levels.forEach(lvl => {
        const radius = getElevationRadiusKm(pos.alt, lvl.elev);
        if (radius > 0) {
          features.push(getCirclePolygon(coords, radius, {
            color: lvl.color,
            opacity: lvl.opacity,
            strokeColor: lvl.strokeColor
          }));
        }
      });

      const source = map.current.getSource('sat-footprint') as maplibregl.GeoJSONSource;
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features
        });
      }
    } else {
      if (satMarker.current) {
        satMarker.current.remove();
        satMarker.current = null;
      }
      const source = map.current.getSource('sat-footprint') as maplibregl.GeoJSONSource;
      if (source) {
        source.setData({ type: 'FeatureCollection', features: [] });
      }
      const orbitSource = map.current.getSource('sat-orbit') as maplibregl.GeoJSONSource;
      if (orbitSource) {
        orbitSource.setData({ type: 'FeatureCollection', features: [] });
      }
    }
  }, [selectedSatellite, satellitePositions, observerCoords, mapLoaded]);

  const selectSatellite = (id: string) => {
    setSelectedSatellite(id);
    const pos = satellitePositions[id];
    if (pos) {
      flyTo([pos.lng, pos.lat], 3);
    }
  };

  const flyTo = (center: [number, number], zoom = 13) =>
    map.current?.flyTo({ center, zoom, duration: 1200 });

  // Pantalla de carga de autenticación
  if (authLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-background text-foreground transition-colors duration-200">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-12 h-12 bg-primary/20 rounded-full animate-ping" />
            <div className="text-primary animate-pulse relative z-10">
              <SatelliteIcon size={40} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-sm font-semibold tracking-tight">Verificando sesión...</span>
            <span className="text-xs text-muted-foreground">Conectando con Tudex Passport</span>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla de inicio de sesión obligatorio
  if (!isAuthenticated) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-background text-foreground relative overflow-hidden p-4 bg-space-grid">
        {/* Background Ambient Glows & Orbit Rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] border border-primary/20 rounded-full animate-radar-pulse pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] border border-primary/15 rounded-full pointer-events-none" />
        
        <Card className="max-w-md w-full border-sidebar-border bg-sidebar/80 backdrop-blur-xl shadow-2xl z-10 relative overflow-hidden scanline-effect cyber-border-glow">
          <div className="h-1 w-full bg-gradient-to-r from-primary via-cyan-400 to-indigo-500" />
          
          <CardHeader className="text-center pt-8 pb-4 space-y-3">
            <div className="relative mx-auto w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-inner">
              <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-sm" />
              <SatelliteIcon size={36} className="relative z-10 cyber-glow" />
            </div>
            
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight text-sidebar-foreground cyber-glow">Tudex Orbit</CardTitle>
              <p className="text-xs text-muted-foreground mt-1 font-medium">Sistema de Telemetría & Rastreación Satelital</p>
            </div>
            
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-sidebar-primary border border-primary/25 mx-auto">
              <Lock size={12} />
              <span>Autenticación OIDC Requerida</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 pb-8 px-6 text-center">
            {authError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/25 text-destructive text-xs text-left flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground leading-relaxed">
              El acceso a esta consola orbital está restringido únicamente a usuarios autorizados mediante <strong>Tudex Passport</strong>.
            </p>

            <Button onClick={() => login()} size="lg" className="w-full font-semibold gap-2.5 cursor-pointer shadow-lg hover:shadow-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99] bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 h-11 text-xs uppercase tracking-wider">
              <ShieldCheck size={18} />
              <span>Iniciar Sesión con Tudex Passport</span>
            </Button>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="p-2 rounded bg-sidebar/30 border border-sidebar-border/40 text-[9px] text-muted-foreground font-mono">
                OIDC 1.0
              </div>
              <div className="p-2 rounded bg-sidebar/30 border border-sidebar-border/40 text-[9px] text-muted-foreground font-mono">
                PKCE S256
              </div>
              <div className="p-2 rounded bg-sidebar/30 border border-sidebar-border/40 text-[9px] text-muted-foreground font-mono">
                SSL/TLS
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pantalla de carga de configuración
  if (!config) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-background text-foreground transition-colors duration-200">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-12 h-12 bg-primary/20 rounded-full animate-ping" />
            <div className="text-primary animate-pulse relative z-10">
              <SatelliteIcon size={40} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-sm font-semibold tracking-tight">Cargando aplicación...</span>
            <span className="text-xs text-muted-foreground">Obteniendo configuración orbital</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background text-foreground font-sans flex transition-colors duration-200">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className={`
        relative z-20 flex flex-col glass-panel text-sidebar-foreground border-r border-sidebar-border shadow-sm transition-all duration-300 ease-in-out scanline-effect
        ${sidebarOpen ? 'w-[340px] min-w-[340px]' : 'w-0 min-w-0 overflow-hidden border-none'}
      `}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="bg-sidebar-primary text-sidebar-primary-foreground p-1.5 rounded-md shadow-sm shrink-0">
              <SatelliteIcon size={18} />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold tracking-tight text-sidebar-foreground cyber-glow truncate">{config.appName}</span>
              <Badge variant="outline" className="text-[9px] font-mono bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20 px-1.5 py-0 flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </Badge>
            </div>
          </div>
          <Button onClick={toggleTheme} variant="ghost" size="icon"
            className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer shrink-0"
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
          <Button onClick={() => setSidebarOpen(false)} variant="ghost" size="icon"
            className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer shrink-0">
            <ChevronLeft size={18} />
          </Button>
        </div>

        {/* Selector de Pestañas (Tabs) con Shadcn */}
        <Tabs value={activeSidebarTab} onValueChange={(val: string) => {
          setActiveSidebarTab(val as 'monitoring' | 'library');
          setSelectedArticleId(null);
        }} className="flex-1 flex flex-col overflow-hidden">
          
          <div className="px-4 py-2 border-b border-sidebar-border bg-sidebar/20">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="monitoring" className="text-xs gap-1.5 font-semibold">
                <Activity size={14} />
                <span>Monitoreo</span>
              </TabsTrigger>
              <TabsTrigger value="library" className="text-xs gap-1.5 font-semibold">
                <BookOpen size={14} />
                <span>Biblioteca</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="monitoring" className="flex-1 flex flex-col overflow-hidden m-0 p-0">
            {/* Search */}
            <div className="px-4 py-3 border-b border-sidebar-border flex items-center gap-2">
              <div className="relative w-full">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sidebar-foreground/50 pointer-events-none z-10" />
                <Input type="text" placeholder="Buscar satélite..."
                  value={searchQuery} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8 text-xs bg-sidebar text-sidebar-foreground border-sidebar-border w-full" />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-5">
                {selectedSatellite ? (
                  // Ficha de Detalles Estilo Google Maps
                  (() => {
                    const sat = satellitesData.find(s => s.id === selectedSatellite);
                    const pos = satellitePositions[selectedSatellite];
                    if (!sat) return null;
                    
                    return (
                      <div className="space-y-4">
                        {/* Botón Volver */}
                        <Button onClick={() => setSelectedSatellite(null)} variant="link" size="sm"
                          className="flex items-center gap-1.5 text-xs font-semibold text-sidebar-primary p-0 h-auto cursor-pointer hover:no-underline">
                          <ChevronLeft size={16} /> Volver al listado
                        </Button>

                        <Card className="overflow-hidden border-sidebar-border bg-sidebar/20 shadow-sm">
                          <img src={sat.image} alt={sat.name}
                            className="w-full h-32 object-cover border-b border-sidebar-border shadow-sm bg-muted" />
                          
                          <div className="p-3.5 space-y-3.5">
                            <div>
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <div className="text-[10px] font-bold text-sidebar-primary uppercase tracking-wider">{sat.category}</div>
                                  <CardTitle className="text-sm font-bold tracking-tight text-sidebar-foreground">{sat.name}</CardTitle>
                                </div>
                                {(() => {
                                  const isVisible = satelliteVisible[sat.id];
                                  const nextPass = nextPassTimes[sat.id];
                                  if (isVisible) {
                                    return (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 font-bold flex items-center gap-1 shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        En el cielo
                                      </Badge>
                                    );
                                  } else if (nextPass) {
                                    const diffMs = nextPass.getTime() - Date.now();
                                    const diffMins = Math.round(diffMs / 1000 / 60);
                                    const displayTime = diffMins < 60 
                                      ? `${diffMins} min` 
                                      : `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
                                    return (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 font-bold flex items-center gap-1 shrink-0 bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400 dark:bg-amber-500/20" title={`Pasa a las ${nextPass.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                        Pasa en {displayTime}
                                      </Badge>
                                    );
                                  } else {
                                    return (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 font-bold flex items-center gap-1 shrink-0 bg-muted text-muted-foreground border-muted-foreground/10">
                                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                                        Invisible
                                      </Badge>
                                    );
                                  }
                                })()}
                              </div>
                            </div>
                            
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{sat.description}</p>
                            
                            {/* Telemetría en Vivo */}
                            {pos && (
                              <Card className="border-sidebar-border bg-sidebar/40 p-2.5 space-y-1.5">
                                <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                  <Activity size={12} className="text-sidebar-primary" />
                                  <span>Telemetría en Vivo</span>
                                </div>
                                <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px]">
                                  <div>Lat: <span className="font-semibold text-sidebar-foreground">{pos.lat.toFixed(4)}°</span></div>
                                  <div>Lng: <span className="font-semibold text-sidebar-foreground">{pos.lng.toFixed(4)}°</span></div>
                                  <div>Altitud: <span className="font-semibold text-sidebar-foreground">{pos.alt.toFixed(0)} km</span></div>
                                  <div>Velocidad: <span className="font-semibold text-sidebar-foreground">{pos.speed.toLocaleString()} km/h</span></div>
                                </div>
                              </Card>
                            )}

                            {/* Canales de Comunicación */}
                            <Card className="border-sidebar-border bg-sidebar/40 p-2.5 space-y-1.5">
                              <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                <Wifi size={12} className="text-sidebar-primary" />
                                <span>Frecuencias de Radio</span>
                              </div>
                              <div className="space-y-1 text-[11px]">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Uplink (Subida):</span>
                                  <span className="font-semibold text-sidebar-foreground">{sat.uplink}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Downlink (Bajada):</span>
                                  <span className="font-semibold text-sidebar-foreground">{sat.downlink}</span>
                                </div>
                                <Separator className="my-1.5 bg-sidebar-border/30" />
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Modulación:</span>
                                  <span className="font-semibold text-sidebar-foreground">{sat.mode}</span>
                                </div>
                              </div>
                            </Card>

                            {/* Próximos Pasos */}
                            <div>
                              <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                                <Compass size={12} className="text-sidebar-primary" />
                                <span>Próximos Pasos (24h)</span>
                              </div>
                              {satellitePasses.length > 0 ? (
                                <div className="space-y-1.5 text-[11px]">
                                  {satellitePasses.map((pass, i) => (
                                    <Card key={i} className="flex justify-between items-center p-2 border-sidebar-border/50 bg-sidebar/20">
                                      <span className="font-medium text-sidebar-foreground">
                                        {pass.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                                      </span>
                                      <span className="text-muted-foreground text-[10px]">
                                        {pass.duration} min (Elev: {pass.maxElevation}°)
                                      </span>
                                    </Card>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-[10px] text-muted-foreground text-center p-2 rounded bg-sidebar/30 border border-dashed border-sidebar-border">
                                  No se detectaron pases visibles en las próximas 24 horas.
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      </div>
                    );
                  })()
                ) : (
                  // Listado de Resultados de Búsqueda
                  <div className="space-y-4">
                    {/* Panel de Control de Constelación y Observador */}
                    <Card className="border-sidebar-border bg-sidebar/20 p-3.5 space-y-3.5 shadow-sm">
                      <div className="flex items-center justify-between border-b border-sidebar-border/30 pb-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-sidebar-foreground">
                          <Activity size={14} className="text-sidebar-primary" />
                          <span>Constelación Global</span>
                        </div>
                        <Switch checked={showAllSatellites} onCheckedChange={setShowAllSatellites} />
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-sidebar-foreground">
                          <MapPin size={14} className="text-sidebar-primary animate-pulse" />
                          <span>Estación Terrestre (Observador)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                          <div>Lat: <span className="font-medium text-sidebar-foreground">{observerCoords[1].toFixed(4)}°</span></div>
                          <div>Lng: <span className="font-medium text-sidebar-foreground">{observerCoords[0].toFixed(4)}°</span></div>
                        </div>
                        <Button onClick={getUserLocation} variant="outline" size="sm"
                          className="w-full text-xs font-medium cursor-pointer flex items-center justify-center gap-1.5 h-8">
                          <Compass size={12} /> Detectar mi ubicación
                        </Button>
                        <p className="text-[10px] text-muted-foreground/80 leading-normal text-center">
                          Haz clic en el mapa para fijar manualmente el punto de observación.
                        </p>
                      </div>
                    </Card>

                    {/* Listado de Satélites */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Satélites Disponibles ({filteredSatellites.length})</p>
                      </div>
                      {filteredSatellites.length > 0 ? (
                        <div className="space-y-2">
                          {sortedFilteredSatellites.map(sat => {
                            const isSelected = selectedSatellite === sat.id;
                            const isVisible = satelliteVisible[sat.id];
                            const pos = satellitePositions[sat.id];
                            const nextPass = nextPassTimes[sat.id];
                            
                            return (
                              <Card key={sat.id} onClick={() => selectSatellite(sat.id)}
                                className={`cursor-pointer w-full flex items-start gap-3 p-3 transition-all text-left ${
                                  isSelected 
                                    ? 'bg-sidebar-primary/20 border-primary/45 text-sidebar-foreground shadow-sm cyber-border-glow'
                                    : 'hover:bg-sidebar-accent/50 border-sidebar-border/60 bg-sidebar/10'
                                }`}>
                                <img src={sat.image} alt={sat.name} className="w-12 h-12 rounded object-cover border border-sidebar-border/60 bg-muted shrink-0 shadow-sm" />
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="text-xs font-bold text-sidebar-foreground truncate">{sat.name}</span>
                                    {(() => {
                                      if (isVisible) {
                                        return (
                                          <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 font-bold flex items-center gap-1 shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/20">
                                            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                            En el cielo
                                          </Badge>
                                        );
                                      } else if (nextPass) {
                                        const diffMs = nextPass.getTime() - Date.now();
                                        const diffMins = Math.round(diffMs / 1000 / 60);
                                        const displayTime = diffMins < 60 
                                          ? `${diffMins} min` 
                                          : `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
                                        return (
                                          <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 font-bold flex items-center gap-1 shrink-0 bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400 dark:bg-amber-500/20" title={`Pasa a las ${nextPass.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}>
                                            <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                            Pasa en {displayTime}
                                          </Badge>
                                        );
                                      } else {
                                        return (
                                          <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 font-bold flex items-center gap-1 shrink-0 bg-muted text-muted-foreground border-muted-foreground/10">
                                            <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                                            Invisible
                                          </Badge>
                                        );
                                      }
                                    })()}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground line-clamp-1">{sat.description}</p>
                                  <div className="text-[9px] text-muted-foreground/80 flex items-center gap-2">
                                    <span className="font-semibold text-sidebar-primary">{sat.category}</span>
                                    {pos && <span>• {pos.alt.toFixed(0)} km</span>}
                                  </div>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground text-center p-6 border border-dashed border-sidebar-border rounded-lg bg-sidebar/20">
                          No se encontraron satélites que coincidan con la búsqueda.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="library" className="flex-1 flex flex-col overflow-hidden m-0 p-0">
            <ScrollArea className="flex-1">
              <div className="p-4">
                {selectedArticleId ? (
                  // Vista de Lector de Artículo
                  (() => {
                    const article = ARTICLES.find(a => a.id === selectedArticleId);
                    if (!article) return null;
                    return (
                      <div className="space-y-4">
                        <Button onClick={() => setSelectedArticleId(null)} variant="link" size="sm"
                          className="flex items-center gap-1.5 text-xs font-semibold text-sidebar-primary p-0 h-auto cursor-pointer hover:no-underline">
                          <ChevronLeft size={16} /> Volver a biblioteca
                        </Button>
                        <Card className="border-sidebar-border bg-sidebar/20 shadow-sm">
                          <CardHeader className="p-4 pb-2">
                            <div>
                              <Badge variant="outline" className="text-[9px] font-bold text-sidebar-primary uppercase tracking-wider bg-sidebar-primary/10 border-sidebar-primary/20">
                                {article.category}
                              </Badge>
                              <CardTitle className="text-sm font-bold tracking-tight text-sidebar-foreground mt-2">{article.title}</CardTitle>
                            </div>
                          </CardHeader>
                          <Separator className="bg-sidebar-border/30" />
                          <CardContent className="p-4 pt-4">
                            {article.content}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })()
                ) : (
                  // Listado de Artículos
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Biblioteca Técnica</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Análisis y evolución de las telecomunicaciones satelitales amateur.</p>
                    </div>
                    <div className="space-y-2.5">
                      {ARTICLES.map(article => (
                        <Card key={article.id} onClick={() => setSelectedArticleId(article.id)}
                          className="w-full flex items-start gap-3.5 p-3.5 rounded-lg border-sidebar-border/60 bg-sidebar/10 hover:bg-sidebar-accent/50 transition-all text-left cursor-pointer">
                          <div className="bg-sidebar-primary/10 text-sidebar-primary p-2 rounded-md border border-sidebar-primary/20 shrink-0 mt-0.5 transition-all">
                            <FileText size={16} />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="text-[9px] font-bold text-sidebar-primary uppercase tracking-wider">{article.category}</div>
                            <span className="text-xs font-bold text-sidebar-foreground block leading-tight">{article.title}</span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        {/* Profile Card & Logout */}
        {user && (
          <div className="px-4 py-2.5 border-t border-sidebar-border bg-sidebar/30 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs shrink-0 overflow-hidden">
                {user.picture ? (
                  <img src={user.picture} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  (user.name || user.preferred_username || user.username || user.email || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-sidebar-foreground truncate leading-tight">
                  {user.name || user.preferred_username || user.username || 'Usuario'}
                </p>
                <p className="text-[9px] text-muted-foreground truncate leading-tight">
                  {user.email || 'Tudex Passport'}
                </p>
              </div>
            </div>
            <Button onClick={logout} variant="ghost" size="icon"
              className="h-7 w-7 text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 cursor-pointer shrink-0"
              title="Cerrar Sesión">
              <LogOut size={14} />
            </Button>
          </div>
        )}

        <div className="px-5 py-2.5 border-t border-sidebar-border bg-sidebar/20 text-sidebar-foreground/40 shrink-0">
          <p className="text-[10px] leading-tight font-medium">{config.footerText}</p>
        </div>
      </aside>

      {/* ── Mapa ───────────────────────────────────────────────────── */}
      <div className="relative flex-1 h-full bg-background">
        {!sidebarOpen && (
          <>
            <Button onClick={() => setSidebarOpen(true)} variant="outline" size="icon"
              className="absolute top-4 left-4 z-10 bg-background/80 backdrop-blur-sm cursor-pointer shadow-sm">
              <Menu size={16} />
            </Button>
            <div className="absolute top-4 left-14 z-10 flex w-72 shadow-sm relative">
              <Input type="text" placeholder="Buscar satélite..."
                value={searchQuery} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="bg-background/80 backdrop-blur-sm text-xs font-medium pl-8 h-9 border-input w-full" />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
            </div>
          </>
        )}

        <div ref={mapContainer} className="w-full h-full" />

        {/* Floating Debug Console */}
        {logs.length > 0 && (
          <Card className="absolute top-16 left-1/2 -translate-x-1/2 z-30 max-w-lg w-full bg-destructive/10 border-destructive/20 text-destructive-foreground p-3.5 shadow-md backdrop-blur-md">
            <div className="flex items-center justify-between mb-2 border-b border-destructive/20 pb-1">
              <span className="text-xs font-bold text-destructive uppercase tracking-widest">Consola de Depuración</span>
              <Button onClick={() => setLogs([])} variant="link" size="sm" className="text-destructive hover:underline text-xs font-semibold p-0 h-auto cursor-pointer">Limpiar</Button>
            </div>
            <div className="space-y-1 font-mono text-[11px] text-foreground max-h-32 overflow-y-auto custom-scrollbar">
              {logs.map((log, idx) => (
                <div key={idx} className="border-b border-border/50 pb-1 last:border-none last:pb-0">{log}</div>
              ))}
            </div>
          </Card>
        )}

        {/* Floating Right Actions */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {user && (
            <div className="hidden sm:flex items-center gap-2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-md border border-input shadow-sm text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-foreground truncate max-w-[120px]">
                {user.name || user.preferred_username || user.username || 'Usuario'}
              </span>
            </div>
          )}
          <Button onClick={toggleTheme} variant="outline" size="icon"
            className="bg-background/80 backdrop-blur-sm cursor-pointer shadow-sm"
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
          {!sidebarOpen && (
            <Button onClick={() => { setSidebarOpen(true); setSelectedSatellite(null); }} variant="outline" size="icon"
              className="bg-background/80 backdrop-blur-sm cursor-pointer shadow-sm"
              title="Satélites">
              <Globe size={16} />
            </Button>
          )}
          <Button onClick={logout} variant="outline" size="icon"
            className="bg-background/80 backdrop-blur-sm cursor-pointer shadow-sm text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Cerrar Sesión">
            <LogOut size={16} />
          </Button>
        </div>

        {/* Floating Zoom Controls */}
        <div className="absolute bottom-6 right-4 z-10 flex flex-col bg-background/80 backdrop-blur-sm rounded-md shadow-sm border border-input overflow-hidden">
          <Button onClick={() => map.current?.zoomIn()} variant="ghost" size="icon" className="rounded-none border-b border-input h-9 w-9 cursor-pointer" title="Acercar">
            <ZoomIn size={16} />
          </Button>
          <Button onClick={() => map.current?.zoomOut()} variant="ghost" size="icon" className="rounded-none h-9 w-9 cursor-pointer" title="Alejar">
            <ZoomOut size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}