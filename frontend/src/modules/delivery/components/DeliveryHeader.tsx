import { useNavigate } from 'react-router-dom';
import { useDeliveryStatus } from '../context/DeliveryStatusContext';
import { useDeliveryUser } from '../context/DeliveryUserContext';

interface DeliveryHeaderProps {
  userName?: string;
}

export default function DeliveryHeader({ userName }: DeliveryHeaderProps) {
  const navigate = useNavigate();
  const { isOnline, setIsOnline } = useDeliveryStatus();
  const { userName: contextUserName } = useDeliveryUser();
  const displayName = userName || contextUserName;

  return (
    <div className="bg-white shadow-sm sticky top-0 z-[40]">
      <style>{`
        .custom-switch-btn {
          position: relative !important;
          width: 48px !important;
          height: 24px !important;
          border-radius: 9999px !important;
          border: none !important;
          cursor: pointer !important;
          padding: 0 !important;
          display: block !important;
          box-sizing: border-box !important;
          transition: background-color 0.3s ease !important;
        }
        .custom-switch-handle {
          position: absolute !important;
          top: 2px !important;
          left: 2px !important;
          width: 20px !important;
          height: 20px !important;
          border-radius: 50% !important;
          background-color: #ffffff !important;
          transition: transform 0.3s ease !important;
          box-sizing: border-box !important;
          display: block !important;
        }
      `}</style>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="px-4 py-2 bg-neutral-500 text-white text-xs font-medium text-center">
          Offline
        </div>
      )}

      {/* Header Content */}
      <div className="px-4 py-3">
        {/* User Info Bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Profile Icon */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${
              isOnline ? 'bg-green-600' : 'bg-neutral-400'
            }`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="8" r="4" stroke="white" strokeWidth="2" fill="none"/>
                <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-neutral-700 text-sm">Hello</span>
              <span className="text-neutral-900 text-xs font-medium truncate">{displayName}</span>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            onClick={() => setIsOnline(!isOnline)}
            className="custom-switch-btn shrink-0"
            style={{
              backgroundColor: isOnline ? '#22c55e' : '#cbd5e1',
            }}
          >
            <div
              className="custom-switch-handle"
              style={{
                transform: isOnline ? 'translateX(24px)' : 'translateX(0)'
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}




