import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { PosBillSettings, getThermalReceiptWidthMm } from '../utils/sellerPosBillSettings';
import { ThermalReceiptContent, ReceiptData } from './thermal/ThermalReceiptContent';

interface ThermalReceiptPreviewProps {
  settings: PosBillSettings;
  data?: ReceiptData;
  onTestPrint?: () => void;
}

export const ThermalReceiptPreview: React.FC<ThermalReceiptPreviewProps> = ({
  settings,
  data,
  onTestPrint,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const paperWidthMm = getThermalReceiptWidthMm(settings.paperWidth);
  const is58mm = settings.paperWidth === '58mm';

  const handleTestPrint = () => {
    if (onTestPrint) {
      onTestPrint();
      return;
    }

    setIsPrinting(true);
    document.body.classList.add('is-printing-test-receipt');

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('is-printing-test-receipt');
        setIsPrinting(false);
      }, 1000);
    }, 200);
  };

  return (
    <div className="bg-neutral-900/5 p-4 rounded-3xl border border-neutral-200 shadow-sm flex flex-col items-center">
      {/* Header Bar */}
      <div className="w-full flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
            Live Preview ({settings.paperWidth || '80mm'} / {is58mm ? '2"' : '3"'})
          </span>
        </div>
        <button
          type="button"
          onClick={handleTestPrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 active:scale-95 transition-all shadow"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Test Print</span>
        </button>
      </div>
      <p className="w-full px-1 mb-3 text-[11px] leading-snug text-neutral-500">
        Sample bill to preview your layout. Real bills print with the actual items, customer and totals from POS Orders.
      </p>

      {/* Realistic Thermal Receipt Paper Simulation */}
      <div
        className="w-full flex justify-center py-2"
        style={{ perspective: '1000px' }}
      >
        <div
          className="bg-white text-black shadow-xl rounded-sm transition-all duration-200 border-t-4 border-neutral-400 relative overflow-hidden"
          style={{
            width: is58mm ? '240px' : '330px',
            maxWidth: '100%',
            boxShadow: '0 12px 30px -6px rgba(0,0,0,0.15), 0 8px 12px -6px rgba(0,0,0,0.1)',
          }}
        >
          {/* Subtle paper cut line on top */}
          <div className="w-full h-1 bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 border-b border-neutral-300/40" />

          {/* Unified Receipt Content */}
          <ThermalReceiptContent settings={settings} data={data} isPrint={false} />

          {/* Bottom paper tear simulation */}
          <div
            className="w-full h-2.5 bg-neutral-100 border-t border-dashed border-neutral-300"
            style={{
              backgroundImage:
                'radial-gradient(circle, transparent 40%, #ffffff 45%)',
              backgroundSize: '8px 8px',
            }}
          />
        </div>
      </div>

      <p className="text-[11px] text-neutral-500 mt-4 text-center">
        ⚡ Preview updates live as you customize typography, columns, margins & branding.
      </p>

      {/* Portal for Test Print */}
      {createPortal(
        <>
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @media print {
                  @page { margin: 0; size: auto; }
                  html, body {
                    height: auto !important;
                    overflow: visible !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white !important;
                  }

                  body.is-printing-test-receipt > *:not(.test-receipt-print-wrapper) {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    overflow: hidden !important;
                  }

                  .test-receipt-print-wrapper {
                    display: block !important;
                    visibility: visible !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    background: white !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    z-index: 999999 !important;
                  }

                  .test-receipt-print-wrapper * {
                    visibility: visible !important;
                  }

                  .test-receipt-print-wrapper .receipt-container {
                    width: ${paperWidthMm} !important;
                    max-width: ${paperWidthMm} !important;
                    margin: 0 !important;
                    box-sizing: border-box !important;
                    background: white !important;
                    overflow: hidden !important;
                  }
                }
              `,
            }}
          />
          <div className="hidden test-receipt-print-wrapper bg-white p-0 m-0">
            <ThermalReceiptContent settings={settings} data={data} isPrint={true} />
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default ThermalReceiptPreview;
