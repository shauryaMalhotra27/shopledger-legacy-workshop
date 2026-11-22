'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

function billedOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon);
  return {
    id: 1001,
    items: items,
    coupon: coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice figures match HSN tax and billed totals for a no-coupon order', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  const order = billedOrder(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { tax: invoiceFigures.tax, total: invoiceFigures.total, cgst: invoiceFigures.cgst, sgst: invoiceFigures.sgst },
    { tax: order.tax, total: order.total, cgst: 2.5, sgst: 2.5 }
  );
  assert.deepEqual(
    { gstPercent: invoiceFigures.rows[0].gstPercent, lineTax: invoiceFigures.rows[0].lineTax },
    { gstPercent: 5, lineTax: 5 }
  );
});

test('invoice figures preserve an explicit legacy item GST rate', function () {
  const items = [{ id: 11, name: 'Legacy Item', sku: 'LEGACY-1', price: 100, qty: 1, gstRate: 5 }];
  const fractionalPercentItems = [{ id: 12, name: 'Legacy Fractional Rate', price: 100, qty: 1, gstRate: 0.18 }];
  const onePercentItems = [{ id: 13, name: 'Legacy One Percent Item', price: 100, qty: 1, gstRate: 1 }];
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });
  const fractionalPercentFigures = invoice.computeInvoiceFigures({ items: fractionalPercentItems, coupon: '' });
  const onePercentFigures = invoice.computeInvoiceFigures({ items: onePercentItems, coupon: '' });

  assert.deepEqual(
    { gstPercent: invoiceFigures.rows[0].gstPercent, lineTax: invoiceFigures.rows[0].lineTax, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { gstPercent: 5, lineTax: 5, tax: 5, total: 105 }
  );
  assert.deepEqual(
    { gstPercent: fractionalPercentFigures.rows[0].gstPercent, lineTax: fractionalPercentFigures.rows[0].lineTax, total: fractionalPercentFigures.total },
    { gstPercent: 18, lineTax: 18, total: 118 }
  );
  assert.deepEqual(
    { gstPercent: onePercentFigures.rows[0].gstPercent, lineTax: onePercentFigures.rows[0].lineTax, total: onePercentFigures.total },
    { gstPercent: 1, lineTax: 1, total: 101 }
  );
});

test('invoice figures match capped coupon discount and billed tax', function () {
  const items = [{ id: 8, name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 3000, qty: 1 }];
  const order = billedOrder(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: invoiceFigures.subtotal, discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { subtotal: order.subtotal, discount: order.discount, tax: order.tax, total: order.total }
  );
  assert.equal(invoiceFigures.rows[0].lineTax, order.tax);
});

test('invoice figures match billed line-tax rounding for multiple lines', function () {
  const items = [
    { id: 1, name: 'Rice A', hsn: '1006', price: 0.1, qty: 1 },
    { id: 2, name: 'Rice B', hsn: '1006', price: 0.1, qty: 1 }
  ];
  const order = billedOrder(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.tax, order.tax);
  assert.equal(invoiceFigures.total, order.total);
  assert.deepEqual(invoiceFigures.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
});
