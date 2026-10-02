import { useEffect, useRef, useState } from "react";

const JSBARCODE_URL = "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js";
let loader: Promise<void> | null = null;

/** Load JsBarcode once (same CDN build the product barcode preview uses). */
export const loadJsBarcode = (): Promise<void> => {
  if ("JsBarcode" in window) return Promise.resolve();
  if (!loader) {
    loader = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = JSBARCODE_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loader = null;
        reject(new Error("Failed to load barcode library"));
      };
      document.body.appendChild(script);
    });
  }
  return loader;
};

/** PNG data URL of a Code 128 barcode, e.g. for jsPDF.addImage. Null if the library can't load. */
export const code128DataUrl = async (value: string): Promise<string | null> => {
  try {
    await loadJsBarcode();
    const canvas = document.createElement("canvas");
    (window as any).JsBarcode(canvas, value, { format: "CODE128", width: 2, height: 60, displayValue: false, margin: 0 });
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
};

export default function Code128Barcode({ value, height = 56 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [loaded, setLoaded] = useState("JsBarcode" in window);

  useEffect(() => {
    if (!loaded) loadJsBarcode().then(() => setLoaded(true)).catch(() => undefined);
  }, [loaded]);

  useEffect(() => {
    if (loaded && ref.current && value) {
      try {
        (window as any).JsBarcode(ref.current, value, {
          format: "CODE128",
          width: 1.6,
          height,
          displayValue: true,
          fontSize: 13,
          margin: 0,
        });
      } catch (err) {
        console.error("Failed to render barcode", err);
      }
    }
  }, [loaded, value, height]);

  return <svg ref={ref} className="max-w-full" />;
}
