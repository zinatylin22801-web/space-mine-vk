(function () {
  const bridge = window.vkBridge || window.VKBridge || null;

  function isVKEnvironment() {
    try {
      if (bridge) return true;
      const params = new URLSearchParams(location.search);
      if (params.has('vk_app_id') || params.has('vk_ref')) return true;
      if (/VKWebApp|VKApp|VKMobile/i.test(navigator.userAgent)) return true;
      if (/(^|\.)vk\.com$/i.test(location.hostname)) return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  async function safeSend(method, params = {}) {
    if (!bridge || typeof bridge.send !== 'function') throw new Error('VK Bridge not loaded');
    return await bridge.send(method, params);
  }

  async function trySend(methods, params = {}) {
    let lastError = null;
    for (const method of methods) {
      try { return await safeSend(method, params); }
      catch (error) { lastError = error; }
    }
    throw lastError || new Error('No bridge method available');
  }

  const Platform = {
    name: 'web', vk: false, ready: false, initialized: false, bridge,
    isVK: isVKEnvironment,

    async init() {
      if (this.initialized) return this;
      this.initialized = true;
      this.vk = isVKEnvironment();
      this.name = this.vk ? 'vk' : 'web';
      if (this.vk && bridge) {
        try { await safeSend('VKWebAppInit'); this.ready = true; }
        catch (e) { this.ready = false; }
      } else { this.ready = true; }
      return this;
    },

    async ensureInit() { if (!this.initialized) await this.init(); return this; },

    async showRewardedAd() {
      await this.ensureInit();
      if (!this.vk || !bridge) return false;
      try {
        const result = await trySend(['VKWebAppShowRewardedVideo', 'VKWebAppShowRewarded', 'VKWebAppShowRewardedAd'], {});
        if (result && result.data) {
          if ('rewarded' in result.data) return Boolean(result.data.rewarded);
          if ('isRewarded' in result.data) return Boolean(result.data.isRewarded);
          if ('success' in result.data) return Boolean(result.data.success);
        }
        return true;
      } catch (e) { return false; }
    },

    async showInterstitialAd() {
      await this.ensureInit();
      if (!this.vk || !bridge) return false;
      try {
        await trySend(['VKWebAppShowInterstitial', 'VKWebAppShowInterstitialVideo', 'VKWebAppShowInterstitialAd'], {});
        return true;
      } catch (e) { return false; }
    },

    async share(link, title, text) {
      await this.ensureInit();
      if (this.vk && bridge) {
        try { await safeSend('VKWebAppShare', { link, title, text }); return 'vk'; } catch (e) {}
      }
      if (navigator.share) {
        try { await navigator.share({ title, text, url: link }); return 'system'; } catch (e) {}
      }
      try { await navigator.clipboard.writeText(link); return 'copied'; } catch (e) { return 'failed'; }
    },

    async getUser() {
      await this.ensureInit();
      if (!this.vk || !bridge) return null;
      try { const res = await safeSend('VKWebAppGetUserInfo', {}); return res && res.data ? res.data : null; }
      catch (e) { return null; }
    },

    getParam(name) { try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; } },
    storageGet(key, fallback = null) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } },
    storageSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } }
  };

  window.Platform = Platform;
})();
