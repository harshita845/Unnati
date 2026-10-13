import React from 'react';
import {
  PosBillSettings,
  getThermalReceiptFontFamily,
  getThermalReceiptBaseFontSizePx,
  getThermalReceiptFontWeightValue,
  getThermalReceiptLineHeight,
  getThermalReceiptLetterSpacing,
  getThermalReceiptWidthMm,
  formatBillDate,
  cleanBillItemName,
} from '../../utils/sellerPosBillSettings';
import { amountToIndianWords } from '../../utils/amountInWords';

export interface ReceiptItem {
  productName: string;
  sku?: string;
  qty: number;
  price: number;
  customPrice?: number;
  compareAtPrice?: number;
  warrantyType?: string;
  warrantyDuration?: string;
  /** Printed under the item on a tax invoice */
  hsnCode?: string;
  /** GST % (prices are GST-inclusive, as everywhere in POS) */
  gst?: number;
  [key: string]: any;
}

export interface ReceiptData {
  invoiceNum?: string;
  date?: string;
  time?: string;
  /** How it was paid: Cash, UPI, Card, Credit… */
  paymentMethod?: string;
  /** Paid / Pending / Unpaid. Derived from the payment method when not given */
  paymentStatus?: string;
  customerName?: string;
  customerPhone?: string;
  sellerName?: string;
  /** Saved customers only: printed when present */
  customerAddress?: string;
  customerGst?: string;
  items: ReceiptItem[];
  total?: number;
  subtotal?: number;
  savings?: number;
  savingPercent?: string | number;
  totalQty?: number;
  totalMrp?: number;
  isEstimated?: boolean;
  cashTendered?: number | string;
  cashReturn?: number | string;
}

export const DEFAULT_SAMPLE_DATA: ReceiptData = {
  invoiceNum: '7514',
  date: formatBillDate(new Date()),
  time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
  paymentMethod: 'Cash',
  customerName: 'Rahul Sharma',
  customerPhone: '9876543210',
  items: [
    { productName: 'BULBUL NANO RS20', sku: 'BLB-001', qty: 6, price: 20, compareAtPrice: 20, hsnCode: '3605', gst: 18 },
    { productName: 'BULBUL KHUTI RS20', sku: 'BLB-002', qty: 1, price: 150, compareAtPrice: 160, hsnCode: '3605', gst: 18 },
    { productName: 'BULBUL MINI RS5', sku: 'BLB-003', qty: 10, price: 5, compareAtPrice: 5, hsnCode: '3605', gst: 18 },
  ],
  totalQty: 17,
  totalMrp: 330,
  total: 320,
  savings: 10,
  savingPercent: 3,
  isEstimated: true,
};

export interface ThermalReceiptContentProps {
  settings?: PosBillSettings | null;
  data?: ReceiptData;
  isPrint?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const ThermalReceiptContent: React.FC<ThermalReceiptContentProps> = ({
  settings,
  data = DEFAULT_SAMPLE_DATA,
  isPrint = false,
  className = '',
  style = {},
}) => {
  const paperWidthMm = getThermalReceiptWidthMm(settings?.paperWidth);
  const is58mm = settings?.paperWidth === '58mm';
  const fontName = getThermalReceiptFontFamily(settings?.fontFamily);
  const baseSize = getThermalReceiptBaseFontSizePx(settings?.fontSize);
  const baseWeight = getThermalReceiptFontWeightValue(settings?.fontWeight);
  const lineHeight = getThermalReceiptLineHeight(settings?.lineSpacing);
  const letterSpacing = getThermalReceiptLetterSpacing(settings?.letterSpacing);

  const regularWeight = baseWeight;
  const mediumWeight = Math.min(baseWeight + 100, 800);
  const boldWeight = Math.min(baseWeight + 300, 900);

  const titleSize = Math.round(baseSize * 1.55);
  const metaSize = baseSize;
  const itemSize = baseSize;
  const headerColSize = baseSize;
  const notesSize = Math.max(baseSize - 1.5, 9);
  const termsSize = Math.max(baseSize - 2, 8.5);

  const grandTotalMultiplier =
    settings?.grandTotalSize === 'large'
      ? 1.5
      : settings?.grandTotalSize === 'medium'
      ? 1.35
      : 1.25;
  const grandTotalSize = Math.round(baseSize * grandTotalMultiplier);

  // Margins
  const margins = settings?.margins || { top: 2, right: 3, bottom: 4, left: 2 };
  const marginTop = Math.max(0, Math.min(margins.top ?? 2, 8));
  const marginRight = Math.max(0, Math.min(margins.right ?? 3, 8));
  const marginBottom = Math.max(0, Math.min(margins.bottom ?? 4, 8));
  const marginLeft = Math.max(0, Math.min(margins.left ?? 2, 8));

  // Alignments
  const headerAlign = settings?.headerAlignment || 'left';
  const headerTextAlign =
    headerAlign === 'center'
      ? 'text-center'
      : headerAlign === 'right'
      ? 'text-right'
      : 'text-left';

  // Divider styling
  const dividerStyle = settings?.dividerStyle || 'single';
  const dividerSpacingClass = settings?.dividerSpacing === 'compact' ? 'my-1' : 'my-1.5';

  const renderDivider = (isThick: boolean = false) => {
    if (dividerStyle === 'none') return null;
    let borderClass = 'border-black';
    if (dividerStyle === 'double') borderClass += ' border-b-2 border-double';
    else if (dividerStyle === 'dashed') borderClass += isThick ? ' border-b-2 border-dashed' : ' border-b border-dashed';
    else if (dividerStyle === 'dotted') borderClass += isThick ? ' border-b-2 border-dotted' : ' border-b border-dotted';
    else borderClass += isThick ? ' border-b-2' : ' border-b';

    return <div className={`w-full ${borderClass} ${dividerSpacingClass}`} />;
  };

  // Columns visibility
  const cols = settings?.tableColumns || {
    showIndex: true,
    showQty: true,
    showMrp: true,
    showSp: true,
    showDiscount: true,
    showTotal: true,
    showWarranty: true,
  };

  // Calculations for items
  const items = data.items || [];
  let calculatedQty = 0;
  let calculatedMRP = 0;
  let calculatedBill = 0;

  items.forEach((item) => {
    const qty = Number(item.qty) || 0;
    const sp = item.customPrice !== undefined ? Number(item.customPrice) : Number(item.price) || 0;
    const mrp = item.compareAtPrice && Number(item.compareAtPrice) > sp ? Number(item.compareAtPrice) : sp;
    calculatedQty += qty;
    calculatedMRP += mrp * qty;
    calculatedBill += sp * qty;
  });

  const totalQty = data.totalQty !== undefined ? data.totalQty : calculatedQty;
  const totalMRP = data.totalMrp !== undefined ? data.totalMrp : calculatedMRP;
  const finalBill = data.total !== undefined ? data.total : calculatedBill;
  const savings = data.savings !== undefined ? data.savings : Math.max(0, totalMRP - finalBill);
  const savingPercent =
    data.savingPercent !== undefined
      ? data.savingPercent
      : totalMRP > 0
      ? ((savings / totalMRP) * 100).toFixed(0)
      : '0';

  // Bill type: a GST-registered store prints a TAX INVOICE; otherwise (or when the caller says so) an ESTIMATE
  const gstRegistered = !!(settings?.gst?.enabled && settings?.gst?.text?.trim());
  const isTaxInvoice = gstRegistered && data.isEstimated !== true;
  const showBillTitle = isTaxInvoice || settings?.showEstimatedBillHeader !== false;
  const isA4 = settings?.paperWidth === 'A4';

  // Payment: how it was paid and whether it is settled are two different things
  const method = (data.paymentMethod || '').trim();
  const isCredit = /credit|pay ?later|udhar/i.test(method);
  const paymentStatus = data.paymentStatus || (method ? (isCredit ? 'Unpaid' : 'Paid') : '');

  // GST summary (prices include GST): taxable value and CGST/SGST per rate
  const gstByRate = new Map<number, { taxable: number; tax: number }>();
  if (isTaxInvoice) {
    items.forEach((item) => {
      const rate = Number(item.gst);
      if (!Number.isFinite(rate) || rate <= 0) return;
      const sp = item.customPrice !== undefined ? Number(item.customPrice) : Number(item.price) || 0;
      const lineTotal = sp * (Number(item.qty) || 0);
      const tax = (lineTotal * rate) / (100 + rate);
      const row = gstByRate.get(rate) || { taxable: 0, tax: 0 };
      row.taxable += lineTotal - tax;
      row.tax += tax;
      gstByRate.set(rate, row);
    });
  }
  const gstRows = [...gstByRate.entries()].sort((a, b) => a[0] - b[0]);
  const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const amountWords = Number(finalBill) > 0 ? amountToIndianWords(Number(finalBill)) : '';

  // QR Code
  const qrUrl = settings?.qrSettings?.url || settings?.qrCode;
  const showQr = settings?.qrSettings?.enabled !== false && !!qrUrl;
  const qrSizePx =
    settings?.qrSettings?.size === 'large'
      ? 80
      : settings?.qrSettings?.size === 'small'
      ? 48
      : 64;
  const qrAlign = settings?.qrSettings?.alignment || 'center';

  // Logo
  const showLogo = settings?.logo?.enabled && !!settings?.logo?.url;
  const logoHeightPx =
    settings?.logo?.size === 'large' ? 64 : settings?.logo?.size === 'small' ? 36 : 48;
  const logoAlign = settings?.logo?.alignment || 'center';
  const logoAlignClass =
    logoAlign === 'left' ? 'justify-start' : logoAlign === 'right' ? 'justify-end' : 'justify-center';

  // Calculate safe padding: in print use exact mm; in preview convert to px with safe minimum
  const padTop = isPrint ? `${marginTop}mm` : `${Math.max(Math.round(marginTop * 3.78), 6)}px`;
  const padRight = isPrint ? `${marginRight}mm` : `${Math.max(Math.round(marginRight * 3.78), 10)}px`;
  const padBottom = isPrint ? `${marginBottom}mm` : `${Math.max(Math.round(marginBottom * 3.78), 8)}px`;
  const padLeft = isPrint ? `${marginLeft}mm` : `${Math.max(Math.round(marginLeft * 3.78), 8)}px`;

  return (
    <div
      className={`receipt-container receipt-font-scope text-black bg-white box-border select-none ${className}`}
      style={{
        width: isPrint ? paperWidthMm : '100%',
        maxWidth: isPrint ? paperWidthMm : '100%',
        padding: `${padTop} ${padRight} ${padBottom} ${padLeft}`,
        fontFamily: fontName,
        fontSize: `${baseSize}px`,
        fontWeight: regularWeight,
        lineHeight: lineHeight,
        letterSpacing: letterSpacing,
        boxSizing: 'border-box',
        overflow: 'hidden',
        color: '#000000',
        ['--receipt-font-family' as any]: fontName,
        ['--receipt-letter-spacing' as any]: letterSpacing,
        ...style,
      }}
    >
      <style>{`
        .receipt-font-scope,
        .receipt-font-scope * {
          font-family: ${fontName} !important;
        }
      `}</style>

      {/* 1. STORE LOGO */}
      {showLogo && (
        <div className={`flex w-full mb-1.5 ${logoAlignClass}`}>
          <img
            src={settings.logo!.url}
            alt="Store Logo"
            className="object-contain"
            style={{
              maxHeight: `${logoHeightPx}px`,
              maxWidth: is58mm ? '120px' : '160px',
            }}
          />
        </div>
      )}

      {/* 2. STORE HEADER */}
      <div className={`w-full ${headerTextAlign}`}>
        <h1
          className="uppercase tracking-tight leading-tight break-words"
          style={{
            fontSize: `${titleSize}px`,
            fontWeight: boldWeight,
          }}
        >
          {settings?.shopName || 'STORE NAME'}
        </h1>
        {settings?.address && (
          <p
            className="whitespace-pre-wrap leading-tight mt-0.5 break-words"
            style={{ fontSize: `${notesSize}px`, fontWeight: regularWeight }}
          >
            {settings.address}
          </p>
        )}
        {settings?.phone && (
          <p className="mt-0.5 break-words" style={{ fontSize: `${notesSize}px`, fontWeight: mediumWeight }}>
            Ph: {settings.phone}
          </p>
        )}
        {settings?.gst?.enabled && settings?.gst?.text && (
          <p className="break-words text-neutral-800" style={{ fontSize: `${notesSize}px`, fontWeight: mediumWeight }}>
            GST: {settings.gst.text}
          </p>
        )}
        {settings?.fssai?.enabled && settings?.fssai?.text && (
          <p className="break-words text-neutral-800" style={{ fontSize: `${notesSize}px`, fontWeight: mediumWeight }}>
            FSSAI: {settings.fssai.text}
          </p>
        )}
      </div>

      {renderDivider(true)}

      {/* 3. BILL TITLE */}
      {showBillTitle && (
        <div className="text-center uppercase tracking-wider mb-1" style={{ fontSize: `${headerColSize + 1}px`, fontWeight: boldWeight }}>
          {isTaxInvoice ? 'Tax Invoice' : 'Estimate'}
        </div>
      )}

      {/* 4. INVOICE METADATA */}
      <div className="space-y-0.5" style={{ fontSize: `${metaSize}px` }}>
        <div className="flex items-center justify-between gap-2">
          <span className="shrink" style={{ fontWeight: mediumWeight }}>{isTaxInvoice ? 'Invoice No.:' : 'Bill No.:'}</span>
          <span className="shrink-0 text-right" style={{ fontWeight: regularWeight }}>{data.invoiceNum || '7514'}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="shrink" style={{ fontWeight: mediumWeight }}>Date:</span>
          <span className="shrink-0 text-right" style={{ fontWeight: regularWeight }}>
            {formatBillDate(data.date)} {data.time || ''}
          </span>
        </div>
        {method && (
          <div className="flex items-center justify-between gap-2">
            <span className="shrink" style={{ fontWeight: mediumWeight }}>Payment Mode:</span>
            <span className="shrink-0 text-right" style={{ fontWeight: regularWeight }}>{method}</span>
          </div>
        )}
        {paymentStatus && (
          <div className="flex items-center justify-between gap-2">
            <span className="shrink" style={{ fontWeight: mediumWeight }}>Status:</span>
            <span className="shrink-0 text-right" style={{ fontWeight: boldWeight }}>{paymentStatus}</span>
          </div>
        )}
        {data.customerName && (
          <div className="flex items-center justify-between gap-2">
            <span className="shrink" style={{ fontWeight: mediumWeight }}>Customer Name:</span>
            <span className="truncate text-right" style={{ fontWeight: regularWeight }}>{data.customerName}</span>
          </div>
        )}
        {data.customerPhone && (
          <div className="flex items-center justify-between gap-2">
            <span className="shrink" style={{ fontWeight: mediumWeight }}>Mobile:</span>
            <span className="shrink-0 text-right" style={{ fontWeight: regularWeight }}>{data.customerPhone}</span>
          </div>
        )}
        {settings?.showSellerName !== false && data.sellerName && (
          <div className="flex items-center justify-between gap-2">
            <span className="shrink" style={{ fontWeight: mediumWeight }}>Seller Name:</span>
            <span className="truncate text-right" style={{ fontWeight: regularWeight }}>{data.sellerName}</span>
          </div>
        )}
        {data.customerAddress && (
          <div className="flex items-start justify-between gap-2">
            <span className="shrink-0" style={{ fontWeight: mediumWeight }}>Address:</span>
            <span className="text-right" style={{ fontWeight: regularWeight }}>{data.customerAddress}</span>
          </div>
        )}
        {data.customerGst && (
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0" style={{ fontWeight: mediumWeight }}>Customer GSTIN:</span>
            <span className="shrink-0 text-right" style={{ fontWeight: regularWeight }}>{data.customerGst}</span>
          </div>
        )}
      </div>

      {renderDivider(true)}

      {/* 5 & 6. ITEM TABLE (Fixed table layout prevents any horizontal clipping or column merging) */}
      <table className="w-full table-fixed border-collapse my-1">
        <thead>
          <tr className="border-b-2 border-black" style={{ fontSize: `${headerColSize}px`, fontWeight: boldWeight }}>
            <th className="text-left pb-1 overflow-hidden" style={{ width: is58mm ? '46%' : '40%' }}>
              Item
            </th>
            {cols.showQty && (
              <th className="text-center pb-1" style={{ width: is58mm ? '16%' : '14%' }}>
                Qty
              </th>
            )}
            {cols.showMrp && (!is58mm || isA4) && (
              <th className="text-right pb-1" style={{ width: '15%' }}>
                MRP
              </th>
            )}
            {cols.showSp && (
              <th className="text-right pb-1" style={{ width: is58mm ? '19%' : '15%' }}>
                Rate
              </th>
            )}
            {cols.showTotal && (
              <th className="text-right pb-1" style={{ width: is58mm ? '19%' : '16%' }}>
                Total
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const sp = item.customPrice !== undefined ? Number(item.customPrice) : Number(item.price) || 0;
            const mrp = item.compareAtPrice && Number(item.compareAtPrice) > sp ? Number(item.compareAtPrice) : sp;
            const total = sp * Number(item.qty || 1);

            return (
              <React.Fragment key={idx}>
                <tr className="leading-tight align-top" style={{ fontSize: `${itemSize}px`, fontWeight: regularWeight }}>
                  <td
                    className="py-0.5 text-left pr-1"
                    style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                  >
                    {cols.showIndex ? `(${idx + 1}) ` : ''}
                    {cleanBillItemName(item.productName)}
                    {isTaxInvoice && (item.hsnCode || Number(item.gst) > 0) && (
                      <div className="text-neutral-700" style={{ fontSize: `${Math.max(baseSize - 2.5, 8)}px` }}>
                        {item.hsnCode ? `HSN ${item.hsnCode}` : ''}
                        {item.hsnCode && Number(item.gst) > 0 ? ' · ' : ''}
                        {Number(item.gst) > 0 ? `GST ${Number(item.gst)}%` : ''}
                      </div>
                    )}
                  </td>
                  {cols.showQty && (
                    <td className="py-0.5 text-center px-0.5 whitespace-nowrap">{item.qty}</td>
                  )}
                  {cols.showMrp && (!is58mm || isA4) && (
                    <td className="py-0.5 text-right px-0.5 whitespace-nowrap">{mrp > 0 ? mrp : '-'}</td>
                  )}
                  {cols.showSp && (
                    <td className="py-0.5 text-right px-0.5 whitespace-nowrap">{sp}</td>
                  )}
                  {cols.showTotal && (
                    <td className="py-0.5 text-right pl-0.5 whitespace-nowrap" style={{ fontWeight: boldWeight }}>
                      {total}
                    </td>
                  )}
                </tr>
                {cols.showWarranty && item.warrantyType && item.warrantyType !== 'None' && (
                  <tr>
                    <td colSpan={is58mm ? 4 : 5} className="pb-1 text-[9px] text-neutral-600 pl-2">
                      {item.warrantyType}: {item.warrantyDuration}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {renderDivider(true)}

      {/* 7. SUMMARY STATS */}
      <div className="space-y-0.5" style={{ fontSize: `${metaSize}px` }}>
        <div className="flex items-center justify-between gap-2">
          <span className="shrink" style={{ fontWeight: regularWeight }}>Total Qty.: {totalQty}</span>
          <span className="shrink-0 text-right" style={{ fontWeight: boldWeight }}>Total MRP: ₹{money(Number(totalMRP))}</span>
        </div>
        {Number(savings) > 0 && (
          <div
            className="flex items-center justify-between gap-2 bg-neutral-200 px-1 py-0.5 my-1 border border-black uppercase"
            style={{
              fontSize: `${Math.max(baseSize - 1, 9)}px`,
              fontWeight: boldWeight,
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
          >
            <span className="shrink">YOU SAVED {savingPercent}%</span>
            <span className="shrink-0 text-right">₹{money(Number(savings))}</span>
          </div>
        )}
      </div>

      {renderDivider(true)}

      {/* 8. GST SUMMARY (tax invoice) */}
      {gstRows.length > 0 && (
        <>
          <table className="w-full table-fixed border-collapse my-1" style={{ fontSize: `${Math.max(baseSize - 1.5, 8.5)}px` }}>
            <thead>
              <tr style={{ fontWeight: boldWeight }}>
                <th className="text-left">GST</th>
                <th className="text-right">Taxable</th>
                <th className="text-right">CGST</th>
                <th className="text-right">SGST</th>
              </tr>
            </thead>
            <tbody>
              {gstRows.map(([rate, row]) => (
                <tr key={rate}>
                  <td className="text-left">{rate}%</td>
                  <td className="text-right">{money(row.taxable)}</td>
                  <td className="text-right">{money(row.tax / 2)}</td>
                  <td className="text-right">{money(row.tax / 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-neutral-700" style={{ fontSize: `${Math.max(baseSize - 2.5, 8)}px` }}>
            Prices include GST. Total tax ₹{money(gstRows.reduce((t, [, r]) => t + r.tax, 0))}
          </div>
          {renderDivider()}
        </>
      )}

      {/* 9. GRAND TOTAL */}
      <div
        className="flex items-center justify-between gap-2 py-1 border-y-2 border-black my-1"
        style={{
          fontSize: `${Math.min(grandTotalSize, 17)}px`,
          fontWeight: boldWeight,
        }}
      >
        <span className="shrink">{isTaxInvoice ? 'Grand Total:' : 'Total bill amount:'}</span>
        <span className="shrink-0 text-right">₹{money(Number(finalBill))}</span>
      </div>
      {amountWords && (
        <p className="leading-tight break-words" style={{ fontSize: `${notesSize}px`, fontStyle: 'italic' }}>
          {amountWords}
        </p>
      )}

      {/* 10. FOOTER CONTENT (Strictly hidden if disabled) */}
      <div className="mt-2.5 space-y-1">
        {/* Custom Slogan / Tagline */}
        {settings?.footerSlogan?.enabled && settings?.footerSlogan?.text && (
          <p
            className={`leading-tight ${
              settings.footerSlogan.alignment === 'left'
                ? 'text-left'
                : settings.footerSlogan.alignment === 'right'
                ? 'text-right'
                : 'text-center'
            } ${settings.footerSlogan.bold !== false ? 'font-bold' : 'font-normal'}`}
            style={{
              fontSize:
                settings.footerSlogan.fontSize === 'large'
                  ? `${baseSize + 1}px`
                  : settings.footerSlogan.fontSize === 'small'
                  ? `${baseSize - 2}px`
                  : `${baseSize - 1}px`,
            }}
          >
            {settings.footerSlogan.text}
          </p>
        )}

        {/* Footer Notes */}
        {settings?.notes?.enabled && settings?.notes?.text && (
          <p
            className={`whitespace-pre-wrap leading-tight ${
              settings.notes.alignment === 'left'
                ? 'text-left'
                : settings.notes.alignment === 'right'
                ? 'text-right'
                : 'text-center'
            }`}
            style={{ fontSize: `${notesSize}px` }}
          >
            {settings.notes.text}
          </p>
        )}

        {/* Terms & Conditions */}
        {settings?.terms?.enabled && settings?.terms?.text && (
          <p
            className={`whitespace-pre-wrap leading-tight text-neutral-600 ${
              settings.terms.alignment === 'left'
                ? 'text-left'
                : settings.terms.alignment === 'right'
                ? 'text-right'
                : 'text-center'
            }`}
            style={{
              fontSize:
                settings.terms.fontSize === 'large'
                  ? `${termsSize + 1}px`
                  : settings.terms.fontSize === 'small'
                  ? `${termsSize - 1}px`
                  : `${termsSize}px`,
            }}
          >
            {settings.terms.text}
          </p>
        )}

        {/* QR Code */}
        {showQr && (
          <div className={`mt-2 flex flex-col ${qrAlign === 'left' ? 'items-start' : qrAlign === 'right' ? 'items-end' : 'items-center'}`}>
            <span className="mb-0.5 uppercase tracking-wide" style={{ fontSize: `${notesSize}px`, fontWeight: boldWeight }}>
              Scan to pay
            </span>
            <img
              src={qrUrl}
              alt="QR Code"
              className="object-contain border border-black/10 p-0.5 rounded-sm bg-white"
              style={{
                width: `${qrSizePx}px`,
                height: `${qrSizePx}px`,
                aspectRatio: '1 / 1',
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ThermalReceiptContent;
