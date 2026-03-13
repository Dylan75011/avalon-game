const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome'
  });
  const page = await browser.newPage();
  
  // 登录
  await page.goto('http://47.81.9.246:80');
  await page.fill('#phone', '13900000003');
  await page.click('button:has-text("进入游戏")');
  await page.waitForTimeout(1500);
  
  // 创建房间
  await page.click('button:has-text("创建房间")');
  await page.waitForTimeout(500);
  await page.click('.count-btn:has-text("5人")');
  await page.click('button:has-text("确认创建")');
  await page.waitForTimeout(1500);
  
  // 检查房间
  const roomVisible = await page.locator('#roomScreen').isVisible();
  console.log('房间显示:', roomVisible ? '✅' : '❌');
  
  // 检查元素
  const startBtn = await page.locator('#startBtn').isVisible();
  console.log('开始按钮:', startBtn ? '✅' : '❌');
  
  const inviteCode = await page.locator('#inviteCode').textContent();
  console.log('邀请码:', inviteCode, inviteCode.length === 6 ? '✅' : '❌');
  
  await browser.close();
  console.log('测试完成');
})();
