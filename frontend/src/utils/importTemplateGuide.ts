import * as XLSX from "xlsx";
import { fieldGuideRows } from "./productImportFields";

/**
 * Adds a "How to add images" sheet to the bulk-import template: how to use photos from the
 * computer and how to give each variant its own picture, with a filled example.
 */
export function addImageGuideSheet(wb: XLSX.WorkBook) {
  const rows: (string | number)[][] = [
    ["How to add product images"],
    [],
    ["Where", "What to write", "Example"],
    ["29. Main Image", "The product's main photo (used for every variant without its own photo): a link, a file name, or a path on your computer", "D:\\Images\\basmati-rice.jpg"],
    ["30–32. Gallery Image 1–3", "More photos of the product (same choices)", "basmati-rice-back.jpg"],
    ["40. Variation Images", "A variant's own photo: variant: photo, separated by ; (leave empty to use the Main Image)", "500g: rice-500g.jpg; 1kg: rice-1kg.jpg"],
    [],
    ["Photos from your computer"],
    ["1. Put the photo file names (or full paths) in the image columns, e.g. rice.jpg or D:\\Images\\rice.jpg"],
    ["2. In Bulk Import, choose this Excel file, then click 'Select images folder' (or 'Select image files') and pick your photos"],
    ["3. The import shows which photos it found; it uploads them and creates the products"],
    ["Photos are matched by file name (capital letters don't matter). Links (https://...) still work as before."],
    [],
    ["Products with variants: one row per variant"],
    ["Write the same Category and Product Name on each row, the variant in 28. Variations, and that variant's price, stock and SKU."],
    ["The rows become one product with all its variants. An exported product list can be imported back the same way."],
    [],
    ["1. Category", "4. Product Name", "5. SKU", "17. Sell Price", "19. Stock", "28. Variations", "29. Main Image", "40. Variation Images"],
    ["Grocery", "Basmati Rice", "RICE-500", 60, 25, "Weight: 500g", "basmati-rice.jpg", "500g: rice-500g.jpg"],
    ["Grocery", "Basmati Rice", "RICE-1KG", 110, 15, "Weight: 1kg", "basmati-rice.jpg", "1kg: rice-1kg.jpg"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 26 }, { wch: 70 }, { wch: 42 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 22 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, ws, "How to add images");
}

/** "Field guide" sheet: what to type in each column (names, Yes/No, dates, tax visibility ...) */
export function addFieldGuideSheet(wb: XLSX.WorkBook) {
  const rows: (string | number)[][] = [
    ["Field guide: what to type in each column"],
    ["Blank cells are fine. Yes/No columns take Yes or No. Names (category, brand, tax, header category, store) must match what is set up in the admin panel; anything not found is left blank and the import tells you."],
    [],
    ...fieldGuideRows(),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 36 }, { wch: 80 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, "Field guide");
}
