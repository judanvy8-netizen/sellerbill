const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { calculateSellerBill } = require('../calculator.js');
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS', name); }
check('known VAT-inclusive example', () => {
  const { totals } = calculateSellerBill([{ channel: 'A', sales: 11000, feePct: 10 }]);
  assert.equal(totals.sales, 11000);
  assert.equal(totals.fee, 1100);
  assert.equal(totals.net, 9900);
  assert.ok(Math.abs(totals.vat - 1000) < 0.000001);
});
check('multiple channels sum independently', () => {
  const { totals } = calculateSellerBill([{ channel: 'A', sales: 1000, feePct: 10 }, { channel: 'B', sales: 2000, feePct: 5 }]);
  assert.equal(totals.net, 2800);
});
check('zero and 100% fees are valid', () => assert.equal(calculateSellerBill([{ sales: 1000, feePct: 100 }, { sales: 0, feePct: 0 }]).totals.net, 0));
for (const [key, value] of [['sales', -1], ['sales', Infinity], ['sales', ''], ['sales', 1e13], ['feePct', NaN], ['feePct', -1], ['feePct', 101]]) {
  check('reject invalid ' + key + ':' + value, () => assert.throws(() => calculateSellerBill([{ sales: 1, feePct: 1, [key]: value }]), RangeError));
}
check('bound line count', () => assert.throws(() => calculateSellerBill(Array.from({ length: 101 }, () => ({ sales: 1, feePct: 1 }))), RangeError));
check('channel multiline input cannot forge summary rows', () => assert.equal(calculateSellerBill([{ channel: 'A\n합계: 0', sales: 1, feePct: 0 }]).rows[0].channel, 'A 합계: 0'));

const elements = new Map();
function matches(el, selector) {
  if (selector === 'input') return el.tagName === 'input';
  if (selector.startsWith('.')) return el.className.split(' ').includes(selector.slice(1));
  const key = selector.match(/^\[data-([a-z]+)(?:="([^"]+)")?\]$/);
  return key && el.dataset[key[1]] !== undefined && (key[2] === undefined || el.dataset[key[1]] === key[2]);
}
function element(tagName) {
  return { tagName, value: '', textContent: '', className: '', children: [], dataset: {}, listeners: {}, attrs: {},
    set id(value) { this._id = value; elements.set(value, this); }, get id() { return this._id; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    removeAttribute(name) { delete this.attrs[name]; }, setAttribute(name, value) { this.attrs[name] = value; },
    replaceChildren(...children) { this.children = children; }, append(...children) { this.children.push(...children); },
    querySelectorAll(selector) { return this.children.flatMap((child) => [...(matches(child, selector) ? [child] : []), ...child.querySelectorAll(selector)]); },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    closest(selector) { return matches(this, selector) ? this : null; }, focus() { this.focused = true; }, select() { this.selected = true; },
    set innerHTML(_) { throw new Error('Unsafe HTML sink used'); }
  };
}
for (const id of ['lines', 'addLine', 'recalc', 'copySummary', 'copyBox', 'copyStatus', 'calcError', 'totalSales', 'totalFee', 'vatOut', 'net', 'tbody']) { const el = element('div'); el.id = id; }
const context = { document: { getElementById: (id) => elements.get(id), createElement: element }, navigator: { clipboard: { writeText: async () => { throw new Error('Denied'); } } } };
vm.runInNewContext(readFileSync(require.resolve('../calculator.js'), 'utf8'), context);
check('initial page renders three channels', () => assert.equal(elements.get('lines').children.length, 3));
check('malicious channel is rendered only as literal text and input retains focus', () => {
  const field = elements.get('line-0-channel');
  const attack = '<img src=x onerror=alert(document.cookie)>';
  field.value = attack;
  elements.get('lines').listeners.input();
  assert.equal(elements.get('tbody').children[0].children[0].textContent, attack);
  assert.equal(elements.get('line-0-channel'), field);
  assert.equal(elements.get('tbody').children[0].children[0].children.length, 0);
});
check('invalid input clears all results and disables copying', () => {
  elements.get('line-0-sales').value = '-10';
  elements.get('lines').listeners.input();
  assert.equal(elements.get('net').textContent, '—');
  assert.equal(elements.get('copyBox').value, '');
  assert.equal(elements.get('copySummary').disabled, true);
});
check('corrected value restores results', () => {
  elements.get('line-0-sales').value = '1000';
  elements.get('lines').listeners.input();
  assert.equal(elements.get('copySummary').disabled, false);
});
check('add line preserves current edits and updates totals', () => {
  const field = elements.get('line-0-channel').value;
  elements.get('addLine').listeners.click();
  assert.equal(elements.get('lines').children.length, 4);
  assert.equal(elements.get('line-0-channel').value, field);
  assert.equal(elements.get('line-3-channel').focused, true);
});
(async () => {
  await elements.get('copySummary').listeners.click();
  check('clipboard refusal gives manual copy instructions', () => {
    assert.equal(elements.get('copyBox').selected, true);
    assert.ok(elements.get('copyStatus').textContent.includes('직접 복사'));
  });
  console.log(`${checks} regression checks passed.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
