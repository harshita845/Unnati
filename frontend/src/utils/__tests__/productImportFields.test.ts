import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXTRA_FIELDS, extraFieldCells, extraFieldHeaders, readProductFields, normalizeDateCell, clearDashPlaceholders, fieldGuideRows, EXTRA_FIELD_FIRST_NUMBER,
} from '../productImportFields';

test('every extra field has a unique header and key, numbered from 41', () => {
  const names = extraFieldHeaders(false);
  assert.equal(new Set(names).size, names.length);
  assert.equal(new Set(EXTRA_FIELDS.map((f) => f.key)).size, EXTRA_FIELDS.length);
  assert.equal(extraFieldHeaders(true)[0], `${EXTRA_FIELD_FIRST_NUMBER}. Short Description`);
  assert.equal(fieldGuideRows().length, 1 + 12 + EXTRA_FIELDS.length);
});

test('every field of the client list is covered by a column', () => {
  const required = ['Short Description', 'Product Video', 'Popular', 'Deal of the Day', 'Enquiry Only', 'Header Category', 'Tax Visibility', 'Shop by Store Only',
    'Tags', 'SEO Title', 'SEO Keywords', 'SEO Description', 'SEO Image Alt', 'Manufacturer', 'Made In', 'FSSAI Lic No', 'Returnable', 'Max Allowed Qty', 'Warranty Type'];
  const have = new Set(extraFieldHeaders(false));
  for (const r of required) assert.ok(have.has(r), `missing column ${r}`);
});

test('reads numbered, plain and alias headers; Yes/No, numbers, enums, tags', () => {
  const { payload, warnings } = readProductFields({
    '41. Short Description': 'Fresh rice', 'Product Video': 'https://youtu.be/x', 'Header Category': 'Grocery',
    'Tax Visibility Label': 'Inclusive', Popular: 'yes', 'deal_of_the_day': 'No', 'Enquiry Only Mode': 'Y', 'Show in Shop by Store only?': 'No',
    Tags: 'rice, basmati ; grain', 'SEO Title': 'Buy rice', 'SEO Image Alt': 'rice pack', Manufacturer: 'India Gate', 'Made In': 'India',
    'FSSAI Lic No': '10019022003456', Returnable: 'Yes', 'Max Allowed Qty': '12', 'Warranty Type': 'guarantee', 'Max Return Days': '7',
  });
  assert.deepEqual(warnings, []);
  assert.equal(payload.smallDescription, 'Fresh rice');
  assert.equal(payload.video, 'https://youtu.be/x');
  assert.equal(payload.headerCategoryId, 'Grocery');
  assert.equal(payload.taxPreference, 'included');
  assert.equal(payload.popular, true);
  assert.equal(payload.dealOfDay, false);
  assert.equal(payload.isEnquiryOnly, true);
  assert.equal(payload.isShopByStoreOnly, false);
  assert.deepEqual(payload.tags, ['rice', 'basmati', 'grain']);
  assert.equal(payload.isReturnable, true);
  assert.equal(payload.totalAllowedQuantity, 12);
  assert.equal(payload.maxReturnDays, 7);
  assert.equal(payload.warrantyType, 'Guarantee');
  assert.equal(payload.fssaiLicNo, '10019022003456');
});

test('blank cells are left out; bad values warn and are left out', () => {
  const { payload, warnings } = readProductFields({ Popular: '', 'Short Description': '', Returnable: 'maybe', 'Max Allowed Qty': 'lots', 'Warranty Type': 'lifetime', 'Tax Visibility': 'sometimes' });
  assert.deepEqual(payload, {});
  assert.equal(warnings.length, 4);
  assert.ok(warnings.some((w) => w.field === "Returnable" && /Yes or No/.test(w.message)));
  assert.ok(warnings.some((w) => w.field === 'Max Allowed Qty' && /number/.test(w.message)));
});

test('original columns: sub cat, brand, tax, pack, description, dates (Excel serial, dd/mm/yyyy, ISO)', () => {
  const { payload } = readProductFields({ '2. Sub Cat': 'Rice', '23. Brand': 'India Gate', '13. Tax Cat': 'GST 5%', '10. Unit': '1 kg', '7. Desc': 'Aged rice', '33. Mfg Date': 46000, '34. Expiry Date': '31/12/2027' });
  assert.deepEqual(payload, { subcategory: 'Rice', brand: 'India Gate', tax: 'GST 5%', pack: '1 kg', description: 'Aged rice', mfgDate: '2025-12-09', expiryDate: '2027-12-31' });
  assert.equal(normalizeDateCell('2026-10-09T00:00:00.000Z'), '2026-10-09');
  assert.equal(normalizeDateCell('9-10-26'), '2026-10-09');
  assert.equal(normalizeDateCell('Dec 2026'), 'Dec 2026');
  assert.equal(normalizeDateCell(''), '');
});

test('"-" placeholders from an export become blanks', () => {
  const row = clearDashPlaceholders({ '9. HSN': '-', '18. Del. Time': ' - ', '4. Product Name': 'Rice', Notes: '-5' });
  assert.deepEqual(row, { '9. HSN': '', '18. Del. Time': '', '4. Product Name': 'Rice', Notes: '-5' });
});

test('export cells read back to the same values (round trip)', () => {
  const product = {
    smallDescription: 'Fresh rice', video: 'https://youtu.be/x', headerCategoryName: 'Grocery', taxPreference: 'excluded', popular: true, dealOfDay: false, isEnquiryOnly: true,
    isShopByStoreOnly: true, shopName: 'Pooja Store', tags: ['rice', 'basmati'], seoTitle: 'Buy rice', seoKeywords: 'rice, basmati', seoDescription: 'Premium rice', seoImageAlt: 'pack',
    manufacturer: 'India Gate', madeIn: 'India', marketer: 'care@x.com', shelfLife: '12 months', fssaiLicNo: '10019022003456', isReturnable: true, maxReturnDays: 7,
    returnPolicyText: 'Unopened only', warrantyType: 'Warranty', warrantyDuration: '1 year', totalAllowedQuantity: 12,
  };
  const headers = extraFieldHeaders(false);
  const cells = extraFieldCells(product);
  assert.equal(cells.length, headers.length);
  const row: Record<string, unknown> = {};
  headers.forEach((h, i) => (row[h] = cells[i]));
  const { payload, warnings } = readProductFields(row);
  assert.deepEqual(warnings, []);
  assert.equal(payload.taxPreference, 'excluded');
  assert.equal(payload.popular, true);
  assert.equal(payload.dealOfDay, false);
  assert.equal(payload.shopId, 'Pooja Store');
  assert.deepEqual(payload.tags, ['rice', 'basmati']);
  assert.equal(payload.maxReturnDays, 7);
  assert.equal(payload.warrantyType, 'Warranty');
  for (const k of ['smallDescription', 'video', 'seoTitle', 'seoKeywords', 'seoDescription', 'seoImageAlt', 'manufacturer', 'madeIn', 'marketer', 'shelfLife', 'fssaiLicNo', 'returnPolicyText', 'warrantyDuration', 'totalAllowedQuantity']) {
    assert.equal((payload as any)[k], (product as any)[k], k);
  }
});
