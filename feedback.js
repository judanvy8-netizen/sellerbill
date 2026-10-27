'use strict';
window.ORVANTRO_ANALYTICS = { site: 'sellerbill' };
document.querySelector('#feedback form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const product = String(data.get('product') || 'SellerBill').slice(0, 100);
  const rating = String(data.get('rating') || '').slice(0, 50);
  const email = String(data.get('email') || '(없음)').slice(0, 254);
  const body = String(data.get('body') || '').slice(0, 2000);
  const subject = encodeURIComponent('[ORVANTRO 베타 피드백] ' + product + ' / ' + rating);
  const message = encodeURIComponent(`제품: ${product}\n만족도: ${rating}\n회신 이메일: ${email}\n\n피드백:\n${body}\n\n— ${location.origin}${location.pathname}`);
  window.location.href = 'mailto:judanvy8@gmail.com?subject=' + subject + '&body=' + message;
});
