import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(source, mocks = {}) {
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'exports', code)(name => name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : mocks[name] || {}, exports);
  return exports;
}
const source = readFileSync(new URL('./bank-domain-panels.tsx', import.meta.url), 'utf8');
const walk = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(walk)];
const text = node => walk(node).flatMap(n => [n.props?.children].flat(Infinity)).filter(x => typeof x === 'string').join(' ');

test('ambiguous confirmation preserves the same preview/key and disables Back after a money attempt', async () => {
  const calls = [], changes = [], states = [false, '', false]; let cursor = 0;
  const react = { useState: () => { const i = cursor++; return [states[i], value => changes.push({ i, value })]; }, useEffect: () => {} };
  const { BankInstructionReview } = load(source, {
    react, './bank-verification': { useBankVerification: () => ({ keyFor: async intent => { calls.push(['key', intent]); return 'same-intent-key'; }, confirm: async (...args) => { calls.push(['verify', ...args]); return 'proof'; } }) },
    '../actions/banking': { submitTransferAction: async (...args) => { calls.push(['submit', ...args]); return { ok: false, error: 'Response lost' }; } }, '../lib/format': { fmt: () => '$10.00' },
  });
  const preview = { previewId: 'signed-preview', amount: { amount: 1000, currency: 'USD' }, fee: { amount: 0, currency: 'USD' }, total: { amount: 1000, currency: 'USD' }, from: {}, to: {} };
  const tree = BankInstructionReview({ preview, onBack() {}, onDone() { throw new Error('An ambiguous response cannot be success'); } });
  const confirm = walk(tree).find(n => n.type === 'button' && text(n).includes('Confirm bank instruction'));
  await confirm.props.onClick(); await confirm.props.onClick();
  assert.deepEqual(calls.filter(c => c[0] === 'submit').map(c => c.slice(1, 3)), [['signed-preview', 'same-intent-key'], ['signed-preview', 'same-intent-key']]);
  assert(changes.some(c => c.i === 2 && c.value === true));
  states[1] = 'Response lost'; states[2] = true; cursor = 0;
  const after = BankInstructionReview({ preview, onBack() {}, onDone() {} });
  const back = walk(after).find(n => n.type === 'button' && text(n) === 'Back'); assert.equal(back.props.disabled, true);
});

test('request detail offers no second pay action for processing and derives full payment from the server request', async () => {
  const calls = [], states = [{ id: 'request', status: 'processing', direction: 'incoming', amount: { amount: 1000, currency: 'USD' }, counterparty: { name: 'Requester' }, expiresAt: '2026-10-30' }, 'my-funding', null, '', false, '']; let cursor = 0;
  const { BankRequestDetail } = load(source, {
    react: { useState: () => { const i = cursor++; return [states[i], () => {}]; }, useEffect: () => {} },
    '../actions/banking': { bankRequestPreviewAction: async body => { calls.push(body); return { ok: true, data: { previewId: 'review' } }; } },
    '../lib/format': { fmt: () => '$10.00', fmtDate: () => 'Oct 30', accountLabel: a => a.name },
  });
  let tree = BankRequestDetail({ requestId: 'request', shareToken: 'private-capability', accounts: [] });
  assert.match(text(tree), /Do not pay this request again/); assert(!walk(tree).some(n => n.type === 'button' && text(n).includes('Review full payment'))); assert.equal(calls.length, 0);
  states[0].status = 'open'; cursor = 0; tree = BankRequestDetail({ requestId: 'request', shareToken: 'private-capability', accounts: [] });
  await walk(tree).find(n => n.type === 'button' && text(n).includes('Review full payment')).props.onClick();
  assert.deepEqual(calls, [{ requestId: 'request', shareToken: 'private-capability', fromAccountId: 'my-funding' }]);
});

test('shared entry discloses no request before sign-in and retains capability only on its original bank URL', async () => {
  const page = readFileSync(new URL('../../../app/banking/requests/[id]/page.tsx', import.meta.url), 'utf8');
  let signedIn = false, redirected = '';
  const { default: Page } = load(page, { '@/lib/auth': { getSession: async () => ({ signedIn }) }, '@/lib/guards': { requireModule: async () => {} }, '@/modules/money/api/adapter': { usesEngineBanking: () => true }, 'next/navigation': { notFound() { throw new Error('404'); }, redirect(url) { redirected = url; throw new Error('redirect'); } } });
  const id = '000000000000000000000001', token = 'x'.repeat(43), props = { params: Promise.resolve({ id }), searchParams: Promise.resolve({ token }) };
  const tree = await Page(props); assert.match(text(tree), /No request details are shown before sign-in/);
  const login = walk(tree).find(n => n.type === 'a' && n.props.href === '/login'); assert(login); assert.equal(login.props.target, '_blank'); assert.match(login.props.rel, /noreferrer/);
  signedIn = true; await assert.rejects(() => Page(props), /redirect/); assert.equal(redirected, `/account/banking/requests/${id}?token=${token}`);
});
