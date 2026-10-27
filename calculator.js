'use strict';

function calculateSellerBill(lines) {
  if (!Array.isArray(lines) || lines.length > 100) throw new RangeError('lines');
  const rows = lines.map((line, index) => {
    const sales = Number(line.sales);
    const feePct = Number(line.feePct);
    if (line.sales === '' || line.sales == null || !Number.isFinite(sales) || sales < 0 || sales > 1e12) throw new RangeError(index + ':sales');
    if (line.feePct === '' || line.feePct == null || !Number.isFinite(feePct) || feePct < 0 || feePct > 100) throw new RangeError(index + ':feePct');
    const channel = String(line.channel || '채널').replace(/[\r\n\t]/g, ' ').slice(0, 100);
    const fee = sales * feePct / 100;
    return { channel, sales, feePct, fee, take: sales - fee, vat: sales - sales / 1.1 };
  });
  const totals = rows.reduce((sum, row) => ({ sales: sum.sales + row.sales, fee: sum.fee + row.fee, net: sum.net + row.take, vat: sum.vat + row.vat }), { sales: 0, fee: 0, net: 0, vat: 0 });
  return { rows, totals };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { calculateSellerBill };

if (typeof document !== 'undefined') {
  const $ = (id) => document.getElementById(id);
  const won = (value) => Math.round(value).toLocaleString('ko-KR') + '원';
  let lines = [
    { channel: '스마트스토어', sales: 4200000, feePct: 3.3 },
    { channel: '쿠팡', sales: 3100000, feePct: 5.8 },
    { channel: '자사몰', sales: 980000, feePct: 0 },
  ];
  const linesEl = $('lines');
  function renderInputs() {
    linesEl.replaceChildren(...lines.map((line, index) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.dataset.i = String(index);
      for (const [key, label] of [['channel', '채널'], ['sales', '매출 (VAT 포함)'], ['feePct', '수수료율 (%)'], ['preview', '미리보기 순수령']]) {
        const group = document.createElement('div');
        const name = document.createElement('label');
        const input = document.createElement('input');
        input.id = `line-${index}-${key}`;
        name.htmlFor = input.id;
        name.textContent = label;
        input.dataset.k = key;
        if (key === 'preview') {
          input.readOnly = true;
          input.value = '—';
        } else {
          input.value = String(line[key]);
          if (key === 'channel') input.maxLength = 100;
          else {
            input.type = 'number';
            input.min = '0';
            input.max = key === 'sales' ? '1000000000000' : '100';
            input.step = key === 'sales' ? '1' : '0.1';
          }
        }
        group.append(name, input);
        row.append(group);
      }
      const group = document.createElement('div');
      group.className = 'del';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-danger';
      button.dataset.del = String(index);
      button.textContent = '삭제';
      button.setAttribute('aria-label', `${index + 1}번 채널 삭제`);
      group.append(button);
      row.append(group);
      return row;
    }));
    $('addLine').disabled = lines.length >= 100;
  }
  function readInputs() {
    lines = [...linesEl.querySelectorAll('.row')].map((row) => Object.fromEntries(['channel', 'sales', 'feePct'].map((key) => [key, row.querySelector(`[data-k="${key}"]`).value])));
  }
  function calc() {
    readInputs();
    linesEl.querySelectorAll('input').forEach((input) => input.removeAttribute('aria-invalid'));
    let result;
    try {
      result = calculateSellerBill(lines);
    } catch (error) {
      const [index, key] = error.message.split(':');
      const input = $(`line-${index}-${key}`);
      if (input) input.setAttribute('aria-invalid', 'true');
      $('calcError').textContent = '매출은 0~1조 원, 수수료율은 0~100% 범위로 입력해 주세요.';
      ['totalSales', 'totalFee', 'vatOut', 'net'].forEach((id) => $(id).textContent = '—');
      $('tbody').replaceChildren();
      $('copyBox').value = '';
      $('copySummary').disabled = true;
      linesEl.querySelectorAll('[data-k="preview"]').forEach((input) => input.value = '—');
      return false;
    }
    $('calcError').textContent = '';
    $('copySummary').disabled = false;
    const { rows, totals } = result;
    $('totalSales').textContent = won(totals.sales);
    $('totalFee').textContent = won(totals.fee);
    $('vatOut').textContent = won(totals.vat);
    $('net').textContent = won(totals.net);
    $('tbody').replaceChildren(...rows.map((item, index) => {
      $(`line-${index}-preview`).value = won(item.take);
      const row = document.createElement('tr');
      [item.channel, won(item.sales), won(item.fee), won(item.take)].forEach((value, col) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        if (col) cell.className = 'num';
        row.append(cell);
      });
      return row;
    }));
    $('copyBox').value = [
      '[SellerBill 월간 정산 요약]',
      ...rows.map((row) => `- ${row.channel}: 매출 ${won(row.sales)} / 수수료 ${won(row.fee)} / 순수령 ${won(row.take)}`),
      `합계 매출: ${won(totals.sales)}`, `합계 수수료: ${won(totals.fee)}`,
      `매출 부가세(추정): ${won(totals.vat)}`, `순수령 추정: ${won(totals.net)}`,
      '※ 모든 매출에 10% 부가세가 포함되었다고 가정합니다. 매입세액·기타 공제는 반영하지 않았습니다.',
      '※ 세무 신고용 최종값이 아닙니다. 참고용 메모입니다.',
    ].join('\n');
    return true;
  }
  linesEl.addEventListener('input', calc);
  linesEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-del]');
    if (!button) return;
    readInputs();
    lines.splice(Number(button.dataset.del), 1);
    if (!lines.length) lines = [{ channel: '채널', sales: 0, feePct: 0 }];
    renderInputs();
    calc();
  });
  $('addLine').addEventListener('click', () => {
    readInputs();
    if (lines.length >= 100) return;
    lines.push({ channel: '새 채널', sales: 0, feePct: 3.3 });
    renderInputs();
    calc();
    $(`line-${lines.length - 1}-channel`).focus();
  });
  $('recalc').addEventListener('click', calc);
  $('copySummary').addEventListener('click', async () => {
    if (!calc()) return;
    try {
      await navigator.clipboard.writeText($('copyBox').value);
      $('copyStatus').textContent = '요약을 복사했습니다.';
    } catch (_) {
      $('copyBox').focus();
      $('copyBox').select();
      $('copyStatus').textContent = '자동 복사를 사용할 수 없습니다. 선택된 요약을 직접 복사해 주세요.';
    }
  });
  renderInputs();
  calc();
}
