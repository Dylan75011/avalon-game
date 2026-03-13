const { chromium } = require('playwright');

async function test() {
  console.log('=== Playwright 完整界面测试 ===\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome'
  });
  const page = await browser.newPage();
  const results = [];
  
  function check(name, ok) {
    results.push(ok);
    console.log(`${ok ? '✅' : '❌'} ${name}`);
  }
  
  // 1. 首页
  await page.goto('http://47.81.9.246:80');
  await page.waitForLoadState('networkidle');
  check('访问首页', await page.title().then(t => t.includes('阿瓦隆')));
  
  // 2. 登录
  await page.fill('#phone', '13900000002');
  await page.fill('#username', '测试');
  await page.click('button:has-text("进入游戏")');
  await page.waitForTimeout(1500);
  check('登录成功', await page.locator('#lobbyScreen').isVisible());
  
  // 3. 大厅元素
  check('大厅-创建房间按钮', await page.locator('button:has-text("创建房间")').isVisible());
  check('大厅-加入房间', await page.locator('#joinCode').isVisible());
  
  // 4. 创建房间
  await page.click('button:has-text("创建房间")');
  await page.waitForTimeout(500);
  check('人数选择弹窗', await page.locator('#createRoomModal').isVisible());
  
  await page.click('.count-btn:has-text("5人")');
  await page.click('button:has-text("确认创建")');
  await page.waitForTimeout(1500);
  check('房间创建', await page.locator('#roomScreen').isVisible());
  
  // 5. 房间元素
  check('邀请码显示', await page.locator('#inviteCode').isVisible());
  check('开始按钮', await page.locator('#startBtn').isVisible());
  
  // 6. 离开房间
  await page.click('button:has-text("离开房间")');
  await page.waitForTimeout(500);
  check('返回大厅', await page.locator('#lobbyScreen').isVisible());
  
  // 7. 规则弹窗
  await page.click('a:has-text("游戏规则")');
  await page.waitForTimeout(300);
  check('规则弹窗', await page.locator('#rulesModal').isVisible());
  await page.click('.close');
  
  // 8. 排行榜
  await page.click('a:has-text("排行榜")');
  await page.waitForTimeout(300);
  check('排行榜', await page.locator('#rankingModal').isVisible());
  await page.click('.close');
  
  // 9. 个人中心
  await page.click('a:has-text("个人中心")');
  await page.waitForTimeout(300);
  check('个人中心', await page.locator('#profileModal').isVisible());
  
  await browser.close();
  
  const passed = results.filter(r => r).length;
  console.log(`\n=== 结果: ${passed}/${results.length} 通过 ===`);
}

test().catch(e => {
  console.error('错误:', e.message);
  process.exit(1);
});
