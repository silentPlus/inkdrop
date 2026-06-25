/**
 * analytics — 数据埋点（轻量实现）
 *
 * 事件通过 navigator.sendBeacon 或 fetch 上报。
 * 生产环境可替换为 Google Analytics / 自建服务。
 */
type EventParams = Record<string, string | number>;

const ENDPOINT = ''; // 替换为实际数据收集端点

function send(event: string, params?: EventParams) {
  const payload = {
    event,
    params: params ?? {},
    timestamp: Date.now(),
    url: window.location.href,
  };

  // 开发环境打印到控制台
  if (import.meta.env.DEV) {
    console.log('[analytics]', event, params);
    return;
  }

  // 生产环境用 sendBeacon
  if (ENDPOINT && navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, JSON.stringify(payload));
  }
}

export const analytics = {
  /** 关卡开始 */
  levelStart(levelId: string) {
    send('level_start', { level_id: levelId });
  },

  /** 关卡通关 */
  levelComplete(levelId: string, steps: number, stars: number) {
    send('level_complete', { level_id: levelId, steps, stars });
  },

  /** 关卡失败 */
  levelFail(levelId: string) {
    send('level_fail', { level_id: levelId });
  },

  /** 撤销操作 */
  undoUsed(levelId: string) {
    send('undo_used', { level_id: levelId });
  },

  /** 重试 */
  retryUsed(levelId: string) {
    send('retry_used', { level_id: levelId });
  },

  /** 广告展示 (预留) */
  adImpression(placement: string) {
    send('ad_impression', { placement });
  },

  /** 广告点击 (预留) */
  adClicked(placement: string) {
    send('ad_clicked', { placement });
  },
};
