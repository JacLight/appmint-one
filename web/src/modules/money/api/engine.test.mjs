import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Exercise the actual adapter without Next server-only/auth runtime or a live bank.
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const typesUrl = moduleUrl(readFileSync(new URL("./types.ts", import.meta.url), "utf8"));
const { EngineBankingApi, engineAccount, engineCard, engineTransaction } = await import(moduleUrl(readFileSync(new URL("./engine.ts", import.meta.url), "utf8").replace('"./types"', JSON.stringify(typesUrl))));
const { customerAuthorization } = await import(moduleUrl(readFileSync(new URL("./authorization.ts", import.meta.url), "utf8")));
const account = (sk, data = {}) => ({ sk, createdate: "2026-10-23", data: { kind: "checking", status: "open", currency: "USD", accountNumber: "1234567890", balances: { posted: 200, available: 150, held: 50 }, ...data } });
const profile = async () => ({ customerId: "customer", firstName: "Test", lastName: "Customer", email: "test@example.test", handle: "", since: "2026-10-23" });

test("custom bank authorization has exactly one scheme for raw and already-prefixed tokens", () => {
  assert.equal(customerAuthorization("token"), "Bearer token");
  assert.equal(customerAuthorization("Bearer token"), "Bearer token");
  assert.equal(customerAuthorization(" bearer Bearer token "), "Bearer token");
  assert.equal(customerAuthorization(null), undefined); assert.equal(customerAuthorization("  "), undefined);
});

test("account projection masks numbers, preserves pending state, and uses ledger balances", () => {
  const result = engineAccount(account("a", { status: "pending", holderNotes: "private" }));
  assert.equal(result.mask, "7890"); assert.equal(result.status, "pending");
  assert.equal(result.balances.available.amount, 150); assert.equal(result.balances.pending.amount, 50);
  assert.ok(!JSON.stringify(result).includes("1234567890")); assert.ok(!JSON.stringify(result).includes("private"));
});
test("unsupported currencies and missing ledger balances are not fabricated as dollars or zero", () => {
  assert.throws(() => engineAccount(account("a", { currency: "EUR" })), /currency/);
  assert.throws(() => engineAccount(account("a", { balances: {} })), /balances/);
});
test("server totals exclude loan debt and internal ledgers", async () => {
  const bank = new EngineBankingApi(async () => [account("a"), account("b"), account("debt", { kind: "loan" }), account("internal", { kind: "internal" })], profile);
  const result = await bank.listAccounts();
  assert.deepEqual(result.items.map(a => a.id), ["a", "b"]); assert.equal(result.total.available.amount, 300);
});
test("card mapping preserves unknown limits and usage and prevents editing unsupported controls", () => {
  const record = { sk: "card", data: { account: "a", status: "lost", controls: { dailySpend: 500 }, processorId: "private" } };
  const card = engineCard(record);
  assert.equal(card.status, "closed"); assert.equal(card.freezeEditable, false); assert.equal(card.limitsEditable, false);
  assert.equal(card.limits.purchasesDaily.limit.amount, 500); assert.equal(card.limits.purchasesDaily.max, null);
  assert.equal(card.limits.atmDaily.limit, null); assert.equal(card.limits.purchasesDaily.used, undefined);
  assert.ok(!JSON.stringify(card).includes("private"));
});
test("real lock/unlock use engine routes, never the incompatible freeze endpoints", async () => {
  const calls = [];
  const bank = new EngineBankingApi(async (method, path) => { calls.push([method, path]); return { sk: "card", data: { status: path.endsWith("/lock") ? "locked" : "active" } }; }, profile);
  assert.equal((await bank.freezeCard("card")).status, "frozen"); assert.equal((await bank.unfreezeCard("card")).status, "active");
  assert.deepEqual(calls, [["POST", "cards/card/lock"], ["POST", "cards/card/unlock"]]);
});
test("transaction history reads every backend page before filtering and cursor paging", async () => {
  const calls = [];
  const bank = new EngineBankingApi(async (_method, path, _body, q) => {
    calls.push([path, q.page]);
    const sk = q.page === 1 ? "first" : "second";
    return { total: 2, data: [{ sk, createdate: "2026-10-23", data: { account: "a", amount: 500, currency: "USD", direction: "in", status: "posted", description: sk } }] };
  }, profile);
  const result = await bank.listTransactions({ accountId: "a", q: "second", limit: 1 });
  assert.deepEqual(calls, [["accounts/a/transactions", 1], ["accounts/a/transactions", 2]]);
  assert.equal(result.items[0].id, "second"); assert.equal(result.total, 1); assert.equal(result.nextCursor, null);
});
test("failed and reversed transactions retain their actual state", () => {
  for (const status of ["failed", "reversed"]) assert.equal(engineTransaction({ sk: "t", data: { account: "a", amount: 100, currency: "USD", status } }).status, status);
});
test("book transfers remain discoverable through the transfers category", () => {
  const row = engineTransaction({ sk: "t", data: { account: "a", amount: 100, currency: "USD", kind: "transfer", rail: "book", direction: "out", status: "posted" } });
  assert.equal(row.kind, "internal");
  assert.equal(row.category, "transfers");
});
test("returned cursors can browse beyond 200 rows and end without duplicates", async () => {
  const records = Array.from({ length: 251 }, (_, i) => ({ sk: `t${String(i).padStart(3, "0")}`, createdate: "2026-10-23", data: { account: "a", amount: 100, currency: "USD", direction: "in", status: "posted" } }));
  const bank = new EngineBankingApi(async (_method, _path, _body, q) => ({ total: records.length, data: records.slice((q.page - 1) * q.pageSize, q.page * q.pageSize) }), profile);
  const seen = [];
  let cursor;
  do {
    const page = await bank.listTransactions({ accountId: "a", limit: 50, cursor });
    seen.push(...page.items.map(t => t.id));
    cursor = page.nextCursor;
    assert.ok(seen.length <= 251, "cursor did not advance");
  } while (cursor);
  assert.equal(seen.length, 251);
  assert.equal(new Set(seen).size, 251);
});
test("transaction detail forwards the viewing account and preserves its inbound projection", async () => {
  let query;
  const bank = new EngineBankingApi(async (_method, _path, _body, q) => { query = q; return { sk: "t", data: { account: "receiver", direction: "in", amount: 123, currency: "USD", status: "posted" } }; }, profile);
  const row = await bank.getTransaction("t", "receiver");
  assert.deepEqual(query, { account: "receiver" }); assert.equal(row.accountId, "receiver"); assert.equal(row.direction, "credit");
});
test("unsupported generic security-code flows refuse before sending any mutation", async () => {
  let calls = 0;
  const bank = new EngineBankingApi(async () => { calls++; }, profile);
  await assert.rejects(bank.startStepUp("card_limits"), /Security codes/);
  await assert.rejects(bank.setCardLimits("card", { purchasesDaily: 9999 }, {}), /security verification/);
  assert.equal(calls, 0);
});
test("own transfer preview and submission retain server-issued preview and idempotency keys", async () => {
  const calls = [];
  const bank = new EngineBankingApi(async (method, path, body) => { calls.push({ method, path, body }); return {}; }, profile);
  const input = { kind: "own", fromAccountId: "a", toAccountId: "b", amount: { amount: 123, currency: "USD" } };
  await bank.previewTransfer(input); await bank.submitTransfer("server-preview", "same-key");
  assert.deepEqual(calls, [{ method: "POST", path: "portal/transfers/preview", body: input }, { method: "POST", path: "portal/transfers", body: { previewId: "server-preview", idempotencyKey: "same-key", stepUp: undefined } }]);
});
test("statement list uses bank-provided period figures and authenticated bank PDF route", async () => {
  const bank = new EngineBankingApi(async (_method, path) => path === "accounts/a" ? account("a") : [{ sk: "s", data: { periodStart: "2026-09-01", periodEnd: "2026-09-30", openingBalance: 100, closingBalance: 200, credits: 150, debits: 50 } }], profile);
  const [statement] = await bank.listStatements({ accountId: "a", year: 2026 });
  assert.equal(statement.closingBalance.amount, 200); assert.equal(statement.totalIn.amount, 150); assert.equal(statement.pdfUrl, "/account/banking/documents/statement/s?account=a");
  await assert.rejects(bank.getStatement("s"), /Detailed printable/);
});


test("account detail accepts the actual account-plus-gaps server envelope", async () => {
  const api = new EngineBankingApi(async () => ({account:account("a"),gaps:[]}),profile);
  assert.equal((await api.getAccount("a")).id,"a");
});
test("statement archive reads every page and preserves PDF ownership path", async () => {
  const pages=[];
  const api=new EngineBankingApi(async (_method,path,_body,query)=> {
    if(path==="accounts/a") return {account:account("a"),gaps:[]};
    pages.push(query.page);
    return {total:2,data:[{sk:`s${query.page}`,data:{periodStart:"2026-09-01",periodEnd:"2026-09-30",openingBalance:100,closingBalance:200,credits:100,debits:0}}]};
  },profile);
  const statements=await api.listStatements({accountId:"a"});assert.deepEqual(pages,[1,2]);assert.equal(statements.length,2);assert.match(statements[1].pdfUrl,/statement\/s2\?account=a$/);
});
test("loan, application and dispute archives adapt existing paged endpoints", async () => {
  const paths=[];
  const api=new EngineBankingApi(async (_method,path,_body,query)=> {paths.push([path,query.page]);return {total:2,data:[path==="disputes"?{sk:`d${query.page}`,data:{status:"submitted"}}:{sk:`l${query.page}`,owed:100}]};},profile);
  assert.equal((await api.listLoans()).length,2);assert.equal((await api.listLoanApplications()).length,2);assert.equal((await api.listDisputes())[1].id,"d2");assert.deepEqual(paths.map(x=>x[1]),[1,2,1,2,1,2]);
});
test("customer transaction actions are server decisions and servicing writes use existing routes", async () => {
  const calls=[];
  const api=new EngineBankingApi(async (method,path,body)=>{calls.push([method,path,body]);return {};},profile);
  const row=engineTransaction({sk:"t",data:{account:"a",direction:"out",amount:100,currency:"USD",status:"posted",actions:{dispute:true,cancel:false}}});
  assert.deepEqual(row.actions,{dispute:true,cancel:false});
  await api.withdrawDispute("claim");await api.withdrawLoanApplication("application");await api.answerLoanCounteroffer("application",true);
  assert.deepEqual(calls,[["POST","disputes/claim/withdraw",{}],["POST","loans/applications/application/withdraw",{}],["POST","loans/applications/application/counteroffer",{accept:true}]]);
});

test("payee enrollment and verification reuse customerpayee routes and expose only last four", async () => {
 const calls=[];const record={sk:"payee",data:{holderName:"Example",name:"Payee",accountLast4:"1234",verification:{status:"pending"},status:"active"}};
 const api=new EngineBankingApi(async(method,path,body)=>{calls.push([method,path,body]);return record;},profile);
 const payee=await api.addRecipient({kind:"external",name:"Example",routingNumber:"021000021",accountNumber:"12345678",accountType:"checking"});
 assert.equal(payee.verificationStatus,"pending");assert.equal(payee.external.accountMask,"1234");
 await api.startPayeeVerification("payee");await api.confirmPayeeVerification("payee",[12,34]);
 assert.equal(calls[0][1],"payees");assert.deepEqual(calls[2],["POST","payees/payee/confirm",{amounts:[12,34]}]);
 assert.ok(!JSON.stringify(payee).includes("12345678"));
});
test("personal card limits preserve bank ceilings and use the existing controls endpoint", async () => {
 const calls=[];const record={sk:"card",data:{account:"a",status:"active",controls:{perTransaction:200,dailySpend:500,dailyAtm:null},bankLimits:{perTransaction:1000,dailySpend:2000,dailyAtm:null}}};
 const api=new EngineBankingApi(async(method,path,body)=>{calls.push([method,path,body]);return record;},profile);
 const card=engineCard(record);assert.equal(card.limitsEditable,true);assert.equal(card.limits.purchasesDaily.max.amount,2000);assert.equal(card.limits.atmDaily.max,null);
 await api.setPersonalCardLimits("card",{dailySpend:null});assert.deepEqual(calls,[["PUT","cards/card/controls",{dailySpend:null}]]);
});
test("application edits and evidence use safe customer adapters without condition approval writes",async()=>{
 const calls=[];const api=new EngineBankingApi(async(method,path,body)=>{calls.push([method,path,body]);return {};},profile);
 await api.updateLoanApplication("application",{income:{grossMonthly:10000}});await api.attachLoanDocument("application",{path:"banking/photo.jpg"});await api.respondToLoanCondition("application",2,{text:"Evidence provided"});
 assert.deepEqual(calls,[["PUT","loans/applications/application",{income:{grossMonthly:10000}}],["POST","loans/applications/application/documents",{path:"banking/photo.jpg"}],["POST","loans/applications/application/conditions/2/respond",{text:"Evidence provided"}]]);
});

test("deposit opening and account preferences use existing authenticated account routes",async()=>{
 const calls=[];const api=new EngineBankingApi(async(method,path,body)=>{calls.push([method,path,body]);return {};},profile);
 await api.openBankAccount({product:"product",business:{legalName:"Example LLC"}});await api.renameBankAccount("account","Savings");await api.setBankOverdraft("account",false);
 assert.deepEqual(calls,[["POST","accounts",{product:"product",business:{legalName:"Example LLC"}}],["PUT","accounts/account/nickname",{nickname:"Savings"}],["PUT","accounts/account/overdraft",{optedIn:false}]]);
});
test("pending account details reuse actual ledger balances and retain server opening gaps",async()=>{
 const api=new EngineBankingApi(async(_method,path)=>path==="accounts/a"?{account:{sk:"a",data:{status:"pending",kind:"checking",currency:"USD"}},gaps:["Identity pending"]}:[account("a",{status:"pending"})],profile);
 const value=await api.getAccount("a");assert.equal(value.status,"pending");assert.equal(value.balances.available.amount,150);assert.deepEqual(value.gaps,["Identity pending"]);
});
test("card order, shipped activation and replacement use existing lifecycle routes",async()=>{
 const calls=[];const api=new EngineBankingApi(async(method,path,body)=>{calls.push([method,path,body]);return {};},profile);
 const shipping={address:{street1:"100 Example St",city:"Austin",state:"TX",zip:"78701",country:"US"}};
 await api.orderBankCard("account",{form:"physical",shipping});await api.activateBankCard("card","1234");await api.replaceBankCard("card","lost",shipping);
 assert.deepEqual(calls,[["POST","accounts/account/cards",{form:"physical",shipping}],["POST","cards/card/activate",{last4:"1234"}],["POST","cards/card/replace",{why:"lost",shipping}]]);
 assert.equal(engineCard({sk:"card",data:{status:"shipped"}}).issuanceStatus,"shipped");
});

test('bank authenticator reviews, verification, rotation and portal proof use real scoped adapters', async () => {
  const calls = [];
  const api = new EngineBankingApi(async (method, path, body) => { calls.push([method, path, body]); return {}; }, profile);
  await api.bankSecurityStatus();
  await api.bankSecurityReview('loan_payment', { id: 'loan', idempotencyKey: 'same' });
  await api.bankSecurityVerify('review', '123456');
  await api.bankPortalReview('signed-preview', 'old-proof');
  await api.bankSecurityRotate({ factorId: 'own-factor', bankingProof: 'proof' });
  await api.submitTransfer('signed-preview', 'key', { challengeId: '', code: '', proof: 'proof' });
  assert.deepEqual(calls.map(c => c.slice(0, 2)), [['GET', 'security/status'], ['POST', 'security/reviews'], ['POST', 'security/reviews/review/verify'], ['POST', 'portal/transfers/security-review'], ['POST', 'security/rotate'], ['POST', 'portal/transfers']]);
  assert.equal(calls[3][2].bankingProof, 'old-proof'); assert.equal(calls[5][2].stepUp.proof, 'proof');
});
test('loan payment, cancellation and dispute withdrawal carry the same opaque proof and stable intent key', async () => {
  const calls = [], auth = { idempotencyKey: 'same', bankingProof: 'proof' };
  const api = new EngineBankingApi(async (method, path, body) => { calls.push([method, path, body]); return {}; }, profile);
  await api.payLoan('loan', { from: 'source', amount: 100, ...auth });
  await api.cancelTransaction('txn', auth); await api.withdrawDispute('claim', auth);
  assert.deepEqual(calls.map(c => c[1]), ['loans/loan/payments', 'transactions/txn/cancel', 'disputes/claim/withdraw']);
  for (const call of calls) { assert.equal(call[2].idempotencyKey, 'same'); assert.equal(call[2].bankingProof, 'proof'); }
});

test('automatic payments use existing signed agreement/status adapter without a fake enabled toggle', async () => {
  const calls = [];
  const api = new EngineBankingApi(async (method, path, body) => { calls.push([method, path, body]); return { available: false, status: 'off' }; }, profile);
  await api.bankAutopay('loan');
  for (const action of ['agreement', 'confirm', 'revoke']) await api.bankAutopayAction(action, 'loan', { bankingProof: 'proof', idempotencyKey: 'stable' });
  assert.deepEqual(calls.map(c => c.slice(0, 2)), [['GET', 'loans/loan/autopay'], ['POST', 'loans/loan/autopay/agreement'], ['POST', 'loans/loan/autopay/confirm'], ['POST', 'loans/loan/autopay/revoke']]);
  for (const call of calls.slice(1)) assert.equal(call[2].enabled, undefined);
});

test('owner receiving details retain omitted bank fields and use local privacy without a fake OTP', async () => {
  const calls = [];
  const api = new EngineBankingApi(async (method, path) => { calls.push([method, path]); return { accountId:'own',accountNumber:'12345',notes:['Confirm supported instructions with the bank.'] }; }, profile);
  const result = await api.receiveDetails('own');
  assert.equal(result.revealRequiresVerification,false); assert.equal(result.accountNumber,'12345');
  assert.equal(result.bankAddress,undefined); assert.equal(result.wireRoutingNumber,undefined);
  assert.deepEqual(calls,[['GET','accounts/own/receive-details']]);
});
test('member resolution, opt-in preferences and requests reuse scoped bank adapters and signed previews', async () => {
  const calls=[];
  const api=new EngineBankingApi(async(method,path,body,query)=>{calls.push([method,path,body,query]);return {};},profile);
  await api.bankReceivingStatus(); await api.bankReceivingUpdate({enabled:true,account:'own',revision:'previous'});
  await api.lookupMember('exact-username'); await api.bankRequestsList('incoming',2);
  await api.bankRequestGet('request','capability'); await api.bankRequestCreate({toAccountId:'own',amount:{amount:100,currency:'USD'}});
  await api.bankRequestClose('request','decline'); await api.bankRequestShare('request');
  await api.bankMemberPreview({recipientToken:'opaque',fromAccountId:'source',amount:{amount:100,currency:'USD'}});
  await api.bankRequestPreview({requestId:'request',fromAccountId:'source'});
  assert.deepEqual(calls.map(c=>c[1]),['receiving','receiving','members/resolve','requests','requests/request','requests','requests/request/decline','requests/request/share','portal/transfers/preview','portal/transfers/preview']);
  assert.deepEqual(calls[3][3],{direction:'incoming',page:2,pageSize:25});assert.equal(calls[4][3].token,'capability');
  assert.equal(calls[8][2].kind,'internal');assert.equal(calls[8][2].recipientToken,'opaque');assert.equal(calls[9][2].kind,'request');
});
test('legacy request archive paging retains requested direction instead of silently loading outgoing', async () => {
  const queries=[];
  const api=new EngineBankingApi(async(_method,_path,_body,query)=>{queries.push(query);return {total:2,data:[{id:String(query.page),status:query.page===1?'processing':'cancelled'}]};},profile);
  const rows=await api.listRequests('incoming'); assert.equal(rows.length,2);assert.equal(rows[0].status,'processing');assert.equal(rows[1].status,'canceled');
  assert.deepEqual(queries.map(q=>q.direction),['incoming','incoming']);
});
