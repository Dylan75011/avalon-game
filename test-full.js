const { chromium } = require('playwright');

(async () => {
  console.log('=== 完整游戏测试 ===\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome'
  });
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const page = await context.newPage();
  
  // 1. 首页
  await page.goto('http://47.81.9.246:80');
  await page.waitForLoadState('networkidle');
  console.log('1. 首页加载 ✅');
  
  // 2. 登录
  await page.fill('#phone', '13900000111');
  await page.fill('#username', '测试1');
  await page.click('button:has-text("进入游戏")');
  await page.waitForTimeout(1500);
  const lobby = await page.locator('#lobbyScreen').isVisible();
  console.log('2. 登录进入大厅', lobby ? '✅' : '❌');
  
  // 3. 个人中心
  await page.click('a:has-text("個人")');
  await page.waitForTimeout(300);
  const profile = await page.locator('#profileModal').isVisible();
  console.log('3. 个人中心', profile ? '✅' : '❌');
  if (profile) await page.click('.close');
  
  // 4. 规则
  await page.click('a:has-text("规则")');
  await page.waitForTimeout(300);
  const rules = await page.locator('#rulesModal').isVisible();
  console.log('4. 游戏规则', rules ? '✅' : '❌');
  if (rules) await page.click('.close');
  
  // 5. 创建房间
  await page.click('button:has-text("创建房间")');
  await page.waitForTimeout(500);
  const modal = await page.locator('#createRoomModal').isVisible();
  console.log('5. 创建房间弹窗', modal ? '✅' : '❌');
  
  await page.click('.count-btn:has-text("5人")');
  await page.click('button:has-text("确认创建")');
  await page.waitForTimeout(1500);
  
  const room = await page.locator('#roomScreen').isVisible();
  console.log('6. 进入房间', room ? '✅' : '❌');
  
  const code = await page.locator('#inviteCode').textContent();
  console.log('7. 邀请码:', code);
  
  // 8. 离开房间
  await page.click('button:has-text("离开房间")');
  await page.waitForTimeout(500);
  const backLobby = await page.locator('#lobbyScreen').isVisible();
  console.log('8. 离开房间', backLobby ? '✅' : '❌');
  
  await browser.close();
  console.log('\n=== 测试完成 ===');
})();
