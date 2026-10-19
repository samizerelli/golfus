// leaflet.markercluster attend un « L » global : on l'expose avant de l'importer.
import L from 'leaflet';

(window as unknown as { L: typeof L }).L = L;
export default L;
