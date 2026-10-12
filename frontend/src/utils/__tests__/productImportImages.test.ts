import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyImageUrls, checkImageRefs, imageFileKey, isRemoteImage, mergeVariantRows, parseVariationImages,
  variantMatches, variationImageCell, findColumnKey,
} from '../productImportImages';

const file = (name: string) => ({ name } as unknown as File);

test('file key: laptop paths, folders, case, quotes', () => {
  assert.equal(imageFileKey('D:\\Images\\Rice 1kg.JPG'), 'rice 1kg.jpg');
  assert.equal(imageFileKey('/Users/siva/Pictures/atta.png'), 'atta.png');
  assert.equal(imageFileKey('"oil.webp"'), 'oil.webp');
  assert.equal(imageFileKey('salt.jpg'), 'salt.jpg');
  assert.equal(isRemoteImage('https://res.cloudinary.com/x/y.jpg'), true);
  assert.equal(isRemoteImage('D:\\Images\\a.jpg'), false);
});

test('variation images: names, laptop paths, links, "=" form, type prefix', () => {
  const e = parseVariationImages('500g: rice-500.jpg; 1kg: D:\\Images\\rice 1kg.jpg; 2kg = https://res.cloudinary.com/a/b.jpg; Weight: 5kg: https://x.com/c.png');
  assert.deepEqual(e, [
    { value: '500g', ref: 'rice-500.jpg' },
    { value: '1kg', ref: 'D:\\Images\\rice 1kg.jpg' },
    { value: '2kg', ref: 'https://res.cloudinary.com/a/b.jpg' },
    { value: 'Weight: 5kg', ref: 'https://x.com/c.png' },
  ]);
  assert.deepEqual(parseVariationImages(''), []);
  assert.deepEqual(parseVariationImages('no image here'), []);
});

test('variant label matching', () => {
  const v = { variationType: 'Weight', value: '500g' };
  assert.equal(variantMatches('500g', v), true);
  assert.equal(variantMatches('Weight: 500g', v), true);
  assert.equal(variantMatches('500G', v), true);
  assert.equal(variantMatches('1kg', v), false);
});

test('header aliases: numbered, plain, export-style', () => {
  assert.equal(findColumnKey({ '40. Variation Images': 'x' }, ['40. Variation Images']), '40. Variation Images');
  assert.equal(findColumnKey({ 'Variation Images': 'x' }, ['40. Variation Images']), 'Variation Images');
  assert.equal(findColumnKey({ 'Main Image': 'x' }, ['29. Main Image']), 'Main Image');
});

test('check refs: what is needed, what was selected, what is missing', () => {
  const rows = [
    { '29. Main Image': 'D:\\Images\\rice.jpg', '30. Gallery Image 1': 'https://res.cloudinary.com/a.jpg', '40. Variation Images': '500g: rice-500.jpg; 1kg: rice-1kg.jpg' },
    { 'Main Image': 'rice.jpg' }, // same file again: counted once
  ];
  const r = checkImageRefs(rows, [file('Rice.JPG'), file('rice-500.jpg'), file('unrelated.png')]);
  assert.deepEqual([...r.localRefs.keys()].sort(), ['rice-1kg.jpg', 'rice-500.jpg', 'rice.jpg']);
  assert.deepEqual([...r.matched.keys()].sort(), ['rice-500.jpg', 'rice.jpg']);
  assert.deepEqual(r.missing, ['rice-1kg.jpg']);
});

test('apply uploaded links to every image cell, links untouched', () => {
  const urls = new Map([['rice.jpg', 'https://cdn/rice.jpg'], ['rice-500.jpg', 'https://cdn/r500.jpg']]);
  const [out] = applyImageUrls([{ '29. Main Image': 'D:\\Images\\rice.jpg', '30. Gallery Image 1': 'https://keep/me.jpg', '40. Variation Images': '500g: rice-500.jpg; 1kg: missing.jpg' }], urls);
  assert.equal(out['29. Main Image'], 'https://cdn/rice.jpg');
  assert.equal(out['30. Gallery Image 1'], 'https://keep/me.jpg');
  assert.equal(out['40. Variation Images'], '500g: https://cdn/r500.jpg; 1kg: missing.jpg');
});

const pending = (row: number, name: string, variant: any, extraRaw: any = {}, extraPayload: any = {}) => ({
  row, label: name,
  rawRow: { '1. Category': 'Grocery', '4. Product Name': name, ...extraRaw },
  payload: { productName: name, mainImage: 'https://cdn/main.jpg', variations: variant ? [variant] : [], ...extraPayload },
});

test('merge: export-style rows (one per variant) become one product with its variants', () => {
  const { products, duplicates } = mergeVariantRows([
    pending(2, 'Rice', { variationType: 'Weight', value: '500g', price: 60, stock: 10, sku: 'R5' }, { '40. Variation Images': '500g: https://cdn/r500.jpg' }),
    pending(3, 'Rice', { variationType: 'Weight', value: '1kg', price: 110, stock: 4, sku: 'R1' }, { '40. Variation Images': 'Weight: 1kg: https://cdn/r1kg.jpg' }),
    pending(4, 'Atta', { variationType: 'Weight', value: '5kg', price: 300, stock: 2 }),
  ]);
  assert.equal(products.length, 2);
  const rice = products[0];
  assert.deepEqual(rice.rows, [2, 3]);
  assert.deepEqual(rice.payload.variations.map((v: any) => [v.value, v.price, v.stock, v.sku, v.mainImage]), [
    ['500g', 60, 10, 'R5', 'https://cdn/r500.jpg'],
    ['1kg', 110, 4, 'R1', 'https://cdn/r1kg.jpg'],
  ]);
  assert.equal(duplicates.length, 0);
});

test('merge: one row with several variants gets each variant its own picture', () => {
  const p = {
    row: 2, label: 'Oil', rawRow: { '4. Product Name': 'Oil', '40. Variation Images': '1L: https://cdn/1l.jpg; 5L: https://cdn/5l.jpg' },
    payload: { productName: 'Oil', variations: [{ variationType: 'Size', value: '1L' }, { variationType: 'Size', value: '5L' }] },
  };
  const { products } = mergeVariantRows([p]);
  assert.deepEqual(products[0].payload.variations.map((v: any) => v.mainImage), ['https://cdn/1l.jpg', 'https://cdn/5l.jpg']);
});

test('merge: older exports with a different Main Image per variant row keep it per variant', () => {
  const { products } = mergeVariantRows([
    pending(2, 'Tea', { variationType: 'Weight', value: '250g' }, {}, { mainImage: 'https://cdn/t250.jpg' }),
    pending(3, 'Tea', { variationType: 'Weight', value: '1kg' }, {}, { mainImage: 'https://cdn/t1kg.jpg' }),
  ]);
  assert.deepEqual(products[0].payload.variations.map((v: any) => v.mainImage), ['https://cdn/t250.jpg', 'https://cdn/t1kg.jpg']);
});

test('variants without their own picture get the row Main Image and gallery', () => {
  const { products } = mergeVariantRows([{
    row: 2, label: 'Oil', rawRow: { '4. Product Name': 'Oil', '40. Variation Images': '5L: https://cdn/5l.jpg' },
    payload: { productName: 'Oil', mainImage: 'https://cdn/oil.jpg', galleryImages: ['https://cdn/back.jpg'], variations: [{ variationType: 'Size', value: '1L' }, { variationType: 'Size', value: '5L' }] },
  }]);
  assert.deepEqual(products[0].payload.variations.map((v: any) => [v.mainImage, v.galleryImages]), [
    ['https://cdn/oil.jpg', ['https://cdn/back.jpg']],
    ['https://cdn/5l.jpg', ['https://cdn/back.jpg']],
  ]);
});

test('merge: a repeated variant is reported, rows without variants are never merged', () => {
  const { products, duplicates } = mergeVariantRows([
    pending(2, 'Salt', { variationType: 'Weight', value: '1kg' }),
    pending(3, 'Salt', { variationType: 'Weight', value: '1kg' }),
    pending(4, 'Soap', null),
    pending(5, 'Soap', null),
  ]);
  assert.equal(products.length, 3);
  assert.equal(products[0].payload.variations.length, 1);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].row, 3);
});

test('export cell', () => {
  assert.equal(variationImageCell('500g', 'https://cdn/a.jpg'), '500g: https://cdn/a.jpg');
  assert.equal(variationImageCell('500g', ''), '');
});
