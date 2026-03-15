const { chromium } = require('playwright');

async function runTest(playerName, phone) {
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome'
  });
  const page = await browser.newPage();
  
  try {
    // 1. 访问首页
    await page.goto('http://47.81.9.246:80');
    await page.waitForLoadState('networkidle');
    
    // 2. 登录
    await page.fill('#phone', phone);
    await page.fill('#username', playerName);
    await page.click('button:has-text("进入游戏")');
    await page.waitForTimeout(1500);
    
    // 3. 检查大厅
    const lobbyVisible = await page.locator('#lobbyScreen').isVisible();
    console.log(`[${playerName}] 大厅: ${lobbyVisible ? '✅' : '❌'}`);
    if (!lobbyVisible) throw new Error('未进入大厅');
    
    // 4. 检查个人中心
    await page.click('a:has-text("個人")');
    await page.waitForTimeout(300);
    const profileVisible = await page.locator('#profileModal').isVisible();
    console.log(`[${playerName}] 个人中心: ${profileVisible ? '✅' : '❌'}`);
    await page.click('.close');
    
    // 5. 检查规则
    await page.click('a:has-text("规则")');
    await page.waitForTimeout(300);
    const rulesVisible = await page.locator('#rulesModal').isVisible();
    console.log(`[${playerName}] 规则: ${rulesVisible ? '✅' : '❌'}`);
    await page.click('.close');
    
    // 6. 创建房间
    await page.click('button:has-text("创建房间")');
    await page.waitForTimeout(500);
    await page.click('.count-btn:has-text("5人")');
    await page.click('button:has-text("确认创建")');
    await page.waitForTimeout(1500);
    
    const roomVisible = await page.locator('#roomScreen').isVisible();
    console.log(`[${playerName}] 房间: ${roomVisible ? '✅' : '❌'}`);
    if (!roomVisible) throw new Error('未进入房间');
    
    const inviteCode = await page.locator('#inviteCode').textContent();
    console.log(`[${playerName}] 邀请码: ${inviteCode}`);
    
    await browser.close();
    return { success: true, inviteCode };
  } catch (e) {
    console.log(`[${playerName}] ❌ ${e.message}`);
    await browser.close();
    return { success: false, error: e.message };
  }
}

async function main() {
  console.log('=== 自动游戏测试 ===\n');
  
  // 玩家1创建房间
  console.log('--- 玩家1创建房间 ---');
  const p1 = await runTest('玩家1', '13900000011');
  
  if (p1.success) {
    console.log('\n测试通过！');
  } else {
    console.log('\n测试失败:', p1.error);
    process.exit(1);
  }
}

main();
