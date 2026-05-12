import { execSync } from 'child_process';
import fs from 'fs';

/**
 * 🛰️ GeoCore Sovereignty Bootstrapper
 * Downloads and imports local map data to PostGIS
 */

const OSM_URL = 'http://download.geofabrik.de/south-america/argentina-latest.osm.pbf';
const DATA_DIR = './data';
const PBF_FILE = `${DATA_DIR}/argentina.osm.pbf`;

const bootstrap = async () => {
  console.log('🚀 [Sovereignty] Starting data import...');

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

  // 1. Download data if not exists (using curl to be fast)
  if (!fs.existsSync(PBF_FILE)) {
    console.log('📥 Downloading OSM data for Argentina (this may take a while)...');
    execSync(`curl -L -o ${PBF_FILE} ${OSM_URL}`, { stdio: 'inherit' });
  }

  // 2. Import to PostGIS via osm2pgsql docker container
  console.log('🏗️ Importing to PostGIS...');
  const dockerCmd = `
    docker run --rm \
      --network mapstudexnetworkscom_default \
      -v ${process.cwd()}/data:/data \
      openmaptiles/osm2pgsql \
      osm2pgsql -d postgresql://geocore:geocore_password@db:5432/geocore \
      --create --slim -G --hstore /data/argentina.osm.pbf
  `;
  
  try {
    execSync(dockerCmd, { stdio: 'inherit' });
    console.log('✅ [Sovereignty] Data imported successfully!');
  } catch (err) {
    console.error('❌ [Sovereignty] Import failed:', err.message);
  }
};

bootstrap();
