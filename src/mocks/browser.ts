import { setupWorker, rest } from 'msw';

// 創建一個模擬的登入 API 響應
const worker = setupWorker(
  rest.post('/api/login', (req, res, ctx) => {
    // 這裡可以添加您的登入邏輯
    return res(
      ctx.delay(150),
      ctx.json({
        success: true,
        user: {
          id: 'test-user-123',
          name: '測試用戶',
          email: 'test@example.com',
          token: 'test-token-123456'
        }
      })
    );
  })
);

export { worker };
