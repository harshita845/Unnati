import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React-Leaflet
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom store icons
const activeStoreIcon = new L.DivIcon({
  html: `<div style="font-size: 28px; text-align: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🏪</div>`,
  className: 'store-marker-active',
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

const otherStoreIcon = new L.DivIcon({
  html: `<div style="font-size: 22px; text-align: center; opacity: 0.75;">📍</div>`,
  className: 'store-marker-other',
  iconSize: [26, 26],
  iconAnchor: [13, 13]
});

export interface SellerLocationItem {
  _id: string;
  storeName: string;
  latitude: number;
  longitude: number;
  serviceRadiusKm?: number;
}

interface SellerServiceMapProps {
  latitude: number;
  longitude: number;
  radiusKm: number;
  storeName: string;
  allSellers?: SellerLocationItem[];
  selectedSellerId?: string;
  onSelectSeller?: (seller: SellerLocationItem) => void;
}

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center[0], center[1], zoom, map]);
  return null;
}

export default function SellerServiceMap({
  latitude,
  longitude,
  radiusKm,
  storeName,
  allSellers = [],
  selectedSellerId,
  onSelectSeller,
}: SellerServiceMapProps) {
  const position: [number, number] = [latitude, longitude];
  const radiusMeters = radiusKm * 1000;

  return (
    <div className="w-full h-full min-h-[300px] rounded-lg overflow-hidden border border-neutral-200 shadow-sm">
      <MapContainer
        center={position}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <ChangeView center={position} zoom={12} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Selected Store Marker */}
        <Marker position={position} icon={activeStoreIcon}>
          <Popup>
            <div className="font-semibold text-sm">{storeName}</div>
            <div className="text-xs text-neutral-600 mt-0.5">Service Radius: {radiusKm} km</div>
          </Popup>
        </Marker>

        {/* Service Radius Circle */}
        <Circle
          center={position}
          radius={radiusMeters}
          pathOptions={{
            color: 'var(--primary-color, #e11d48)',
            fillColor: 'var(--primary-color, #e11d48)',
            fillOpacity: 0.2,
            weight: 2
          }}
        />

        {/* Other Stores Markers */}
        {allSellers.map((seller) => {
          if (seller._id === selectedSellerId || !seller.latitude || !seller.longitude) return null;
          return (
            <Marker
              key={seller._id}
              position={[seller.latitude, seller.longitude]}
              icon={otherStoreIcon}
              eventHandlers={{
                click: () => onSelectSeller?.(seller),
              }}
            >
              <Popup>
                <div className="font-medium text-xs">{seller.storeName}</div>
                <button
                  onClick={() => onSelectSeller?.(seller)}
                  className="mt-1 text-[11px] text-blue-600 underline font-semibold cursor-pointer"
                >
                  View Details & Service Area
                </button>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
