const { chromium } = require('playwright');

async function test() {
  console.log('=== Playwright 界面测试 ===\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome'
  });
  const page = await browser.newPage();
  
  // 1. 访问首页
  console.log('【1】访问首页...');
  await page.goto('http://47.81.9.246:80');
  await page.waitForLoadState('networkidle');
  
  const title = await page.title();
  console.log(`  标题: ${title} ${title.includes('阿瓦隆') ? '✅' : '❌'}`);
  
  // 2. 检查登录界面
  console.log('\n【2】检查登录界面...');
  const h2 = await page.locator('h2').first().textContent();
  console.log(`  标题: ${h2}`);
  
  // 3. 测试登录
  console.log('\n【3】测试登录...');
  await page.fill('#phone', '13900000001');
  await page.fill('#username', '测试玩家');
  await page.click('button:has-text("进入游戏")');
  await page.waitForTimeout(1500);
  
  // 4. 检查大厅
  console.log('\n【4】检查大厅...');
  const lobbyVisible = await page.locator('#lobbyScreen').isVisible();
  console.log(`  大厅: ${lobbyVisible ? '✅' : '❌'}`);
  
  // 5. 创建房间
  console.log('\n【5】创建房间...');
  await page.click('button:has-text("创建房间")');
  await page.waitForTimeout(500);
  
  const modal = await page.locator('#createRoomModal').isVisible();
  console.log(`  弹窗: ${modal ? '✅' : '❌'}`);
  
  if (modal) {
    await page.click('.count-btn:has-text("5人")');
    await page.click('button:has-text("确认创建")');
    await page.waitForTimeout(1500);
    
    const room = await page.locator('#roomScreen').isVisible();
    console.log(`  房间: ${room ? '✅' : '❌'}`);
  }
  
  await browser.close();
  console.log('\n=== 测试完成 ===');
}

test().catch(e => {
  console.error('错误:', e.message);
  process.exit(1);
});
