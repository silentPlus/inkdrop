/**
 * AdManager — 广告抽象层
 *
 * 统一管理插屏/激励/横幅广告的展示逻辑。
 * Web 端当前使用占位实现，后续接入真实 SDK 只需替换 WebAdProvider。
 */

export interface AdProvider {
  init(): Promise<void>;
  showInterstitial(placement: string): Promise<boolean>;
  showRewarded(placement: string): Promise<boolean>;
  showBanner(placement: string): void;
  hideBanner(placement: string): void;
}

class WebAdProvider implements AdProvider {
  async init(): Promise<void> {
    // Web 广告 SDK 初始化预留
  }

  async showInterstitial(placement: string): Promise<boolean> {
    // 占位：关卡间插屏广告
    console.log(`[Ads] Interstitial: ${placement}`);
    return true;
  }

  async showRewarded(placement: string): Promise<boolean> {
    // 占位：激励视频
    console.log(`[Ads] Rewarded: ${placement}`);
    return true;
  }

  showBanner(placement: string): void {
    // 占位：底部横幅
    console.log(`[Ads] Banner show: ${placement}`);
  }

  hideBanner(placement: string): void {
    console.log(`[Ads] Banner hide: ${placement}`);
  }
}

class AdManager {
  private provider: AdProvider = new WebAdProvider();
  private initialized = false;
  private lastInterstitialLevel = 0;

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.provider.init();
    this.initialized = true;
  }

  /** 关卡间插屏：每通关 2 关展示一次 */
  async showLevelInterstitial(currentLevel: number): Promise<void> {
    if (currentLevel - this.lastInterstitialLevel >= 2) {
      await this.provider.showInterstitial('level_complete');
      this.lastInterstitialLevel = currentLevel;
    }
  }

  /** 激励广告：提示 */
  async showHintRewarded(): Promise<boolean> {
    return this.provider.showRewarded('hint');
  }

  /** 显示底部横幅 */
  showBottomBanner(): void {
    this.provider.showBanner('bottom');
  }

  /** 隐藏底部横幅 */
  hideBottomBanner(): void {
    this.provider.hideBanner('bottom');
  }
}

export const adManager = new AdManager();
