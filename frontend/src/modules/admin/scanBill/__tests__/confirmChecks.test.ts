import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmIssues, isBillEmpty } from '../confirmChecks';

const base = (o: any = {}) => ({ docType: 'purchase', party: {}, items: [], totals: {}, ...o });

test('empty purchase: items, supplier and total are all missing', () => {
  assert.deepEqual(confirmIssues(base() as any), ['Add at least one item', 'Enter the supplier', 'Enter the grand total']);
});

test('complete purchase passes', () => {
  const bill = base({ party: { name: 'Sri Lakshmi Traders' }, items: [{ name: 'Salt', quantity: 2, action: 'link', productId: 'p1' }], totals: { grandTotal: 50 } });
  assert.deepEqual(confirmIssues(bill as any), []);
});

test('line problems, bad date, unknown type', () => {
  const bill = base({ docType: 'unknown', party: { name: 'X' }, items: [{ name: 'Salt', quantity: 0, action: 'link' }, { name: '', quantity: 1, action: 'create' }, { name: 'skip me', action: 'skip' }], totals: { grandTotal: 10 } });
  assert.deepEqual(confirmIssues(bill as any, { dateTextInvalid: true }), [
    'Choose the bill type', 'Line 1: enter the quantity', 'Line 1: pick the product', 'Line 2: name the new product', 'Fix the bill date (DD/MM/YYYY)',
  ]);
});

test('expense needs only a total; stock slip needs no total', () => {
  assert.deepEqual(confirmIssues(base({ docType: 'expense' }) as any), ['Enter the grand total']);
  assert.deepEqual(confirmIssues(base({ docType: 'stock_slip', items: [{ name: 'a', quantity: 1, action: 'link', productId: 'p' }] }) as any), []);
});

test('isBillEmpty', () => {
  assert.equal(isBillEmpty(base() as any), true);
  assert.equal(isBillEmpty(base({ items: [{ name: '', quantity: 1, action: 'skip' }] }) as any), true);
  assert.equal(isBillEmpty(base({ invoiceNumber: 'A1' }) as any), false);
  assert.equal(isBillEmpty(base({ totals: { grandTotal: 0 } }) as any), false);
  assert.equal(isBillEmpty(base({ items: [{ name: 'Salt', action: 'skip' }] }) as any), false);
  assert.equal(isBillEmpty(null), true);
});
