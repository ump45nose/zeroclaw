import { chromium } from '/tmp/pw/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const results = [];
import fs from 'node:fs';
const log = (s) => { console.log(s); fs.appendFileSync('/workspace/deep-2310/proof11661/proof2.log', s + '\n'); results.push(s); };

async function openChat() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:5173/agents', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Dismiss' }).click().catch(() => {});
  await p.getByText('Open chat').click();
  await p.locator('textarea:visible').waitFor();
  await p.waitForFunction(() => { const t = [...document.querySelectorAll('textarea')].find(x => x.getClientRects().length); return t && !t.disabled; });
  return p;
}
const visibleTextarea = (p) => p.locator('textarea:visible');
const focusInfo = (p) => p.evaluate(() => {
  const a = document.activeElement;
  const t = [...document.querySelectorAll('textarea')].find(x => x.getClientRects().length);
  return { activeIsVisibleComposer: a === t, active: a ? (a.tagName + (a.getAttribute('aria-label') ? '[' + a.getAttribute('aria-label') + ']' : '') + (a.textContent ? ' "' + a.textContent.trim().slice(0, 25) + '"' : '')) : null, composerDisabled: t ? t.disabled : null };
});
const waitTurnStart = (p) => p.waitForFunction(() => [...document.querySelectorAll('textarea')].some(x => x.getClientRects().length && x.disabled), null, { timeout: 10000 });
const waitTurnEnd = (p) => p.waitForFunction(() => [...document.querySelectorAll('textarea')].some(x => x.getClientRects().length && !x.disabled), null, { timeout: 30000 });

// A: normal completion
{
  const p = await openChat();
  const ta = visibleTextarea(p);
  await ta.click(); await p.keyboard.type('first message'); await p.keyboard.press('Enter');
  await waitTurnStart(p);
  log('A during turn: ' + JSON.stringify(await focusInfo(p)));
  await waitTurnEnd(p); await p.getByText('Mock reply', { exact: false }).last().waitFor();
  await p.waitForTimeout(300);
  log('A after turn: ' + JSON.stringify(await focusInfo(p)));
  await p.keyboard.type('typed without clicking');
  log('A composer value after typing with no click: ' + JSON.stringify(await ta.inputValue()));
  await p.screenshot({ path: 'v2-A-normal-completion.png' });
  await p.context().close();
}
// B: user moves focus to another control during the turn
{
  const p = await openChat();
  const ta = visibleTextarea(p);
  await ta.click(); await p.keyboard.type('second message'); await p.keyboard.press('Enter');
  await waitTurnStart(p);
  await p.getByRole('button', { name: /Conversation/ }).first().focus();
  log('B focus moved during turn: ' + JSON.stringify(await focusInfo(p)));
  await waitTurnEnd(p); await p.waitForTimeout(500);
  log('B after turn: ' + JSON.stringify(await focusInfo(p)));
  await p.screenshot({ path: 'v2-B-focus-moved.png' });
  await p.context().close();
}
// C: Stop
{
  const p = await openChat();
  const ta = visibleTextarea(p);
  await ta.click(); await p.keyboard.type('third message, will stop'); await p.keyboard.press('Enter');
  await waitTurnStart(p);
  await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'Stop' }).click();
  log('C right after clicking Stop: ' + JSON.stringify(await focusInfo(p)));
  await waitTurnEnd(p); await p.waitForTimeout(500);
  log('C after stopped turn: ' + JSON.stringify(await focusInfo(p)));
  await p.keyboard.type('after stop');
  log('C composer value after typing with no click: ' + JSON.stringify(await ta.inputValue()));
  await p.screenshot({ path: 'v2-C-stop.png' });
  await p.context().close();
}
// D: completion in a hidden pane (switch to a new chat tab during the turn)
{
  const p = await openChat();
  const ta = visibleTextarea(p);
  await ta.click(); await p.keyboard.type('fourth message, then switch tab'); await p.keyboard.press('Enter');
  await waitTurnStart(p);
  const before = await p.locator('textarea').count();
  await p.locator('button:has(svg.lucide-plus)').first().click();
  await p.getByText('Open another').click();
  await p.waitForTimeout(1500);
  log('D textareas before/after new tab: ' + before + '/' + (await p.locator('textarea').count()));
  // Leave focus on the page body in the new tab, i.e. nothing focused.
  await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
  log('D new tab, before hidden turn ends: ' + JSON.stringify(await focusInfo(p)));
  await p.waitForTimeout(6000);
  const hidden = await p.evaluate(() => { const ts = [...document.querySelectorAll('textarea')]; const a = document.activeElement; return { hiddenComposerFocused: ts.some(t => !t.getClientRects().length && t === a), active: a ? a.tagName : null, composers: ts.map(t => ({ visible: !!t.getClientRects().length, disabled: t.disabled })) }; });
  log('D after hidden-pane turn ended: ' + JSON.stringify(hidden));
  await p.screenshot({ path: 'v2-D-hidden-pane.png' });
  await p.context().close();
}
// E: the connection drops mid-turn; refocus waits until the composer is enabled again
{
  const { execSync } = await import('node:child_process');
  const p = await openChat();
  const ta = visibleTextarea(p);
  await ta.click(); await p.keyboard.type('fifth message, gateway restarts'); await p.keyboard.press('Enter');
  await waitTurnStart(p);
  await p.waitForTimeout(800);
  await p.context().setOffline(true);
  await p.waitForTimeout(1500);
  log('E2 offline mid-turn: ' + JSON.stringify(await focusInfo(p)) + ' placeholder=' + JSON.stringify(await ta.getAttribute('placeholder')));
  await p.screenshot({ path: 'v2-E2-offline.png' });
  await p.waitForTimeout(4000);
  log('E2 still offline after the server-side turn would have finished: ' + JSON.stringify(await focusInfo(p)) + ' placeholder=' + JSON.stringify(await ta.getAttribute('placeholder')));
  await p.context().setOffline(false);
  try { await waitTurnEnd(p); } catch (e) { log('E2 composer still disabled 120s after restart; placeholder=' + JSON.stringify(await ta.getAttribute('placeholder')) + ' ' + JSON.stringify(await focusInfo(p))); await p.screenshot({ path: 'v2-E2-after-120s.png' }); process.exit(1); }
  await p.waitForTimeout(500);
  log('E2 after reconnect, composer enabled: ' + JSON.stringify(await focusInfo(p)));
  await p.keyboard.type('after reconnect');
  log('E2 composer value after typing with no click: ' + JSON.stringify(await ta.inputValue()));
  await p.screenshot({ path: 'v2-E2-reconnected.png' });
  await p.context().close();
}
await browser.close();
