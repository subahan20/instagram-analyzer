import { supabase } from '../supabase';

/**
 * Scraper Service
 * Handles Instagram profile processing.
 */
const scraperService = {
  /**
   * Helper to extract username from various Instagram URL formats or strings.
   */
  extractUsername(input) {
    if (!input) return '';
    let username = String(input).trim();
    
    try {
      if (username.includes('instagram.com/')) {
        const url = new URL(username.startsWith('http') ? username : `https://${username}`);
        const segments = url.pathname.split('/').filter(Boolean);
        if (['reels', 'p', 'tv'].includes(segments[0])) {
          return ''; 
        }
        username = segments[0];
      } else {
        username = username.replace('@', '');
      }
    } catch (e) {
      username = username.split('instagram.com/').pop()?.split('/')[0] || username.replace('@', '');
    }
    
    return username.toLowerCase().split('?')[0];
  },

  /**
   * Check Update (STAGE 1) - Lightweight
   */
  async checkUpdate(url, options = {}) {
    const { data, error } = await supabase.functions.invoke('post', {
      body: { action: 'check_update', username: url.trim(), ...options },
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      }
    });
    if (error) throw error;
    return data;
  },

  /**
   * Scrape Full (STAGE 2) - Heavy
   */
  async scrapeFull(url, options = {}) {
    const { data, error } = await supabase.functions.invoke('post', {
      body: { action: 'scrape_full', username: url.trim(), ...options },
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      }
    });
    if (error) throw error;
    return data;
  },

  /**
   * Sync Audience (Replaces Operator)
   */
  async syncAudience(influencerId, instagramUrl) {
    const username = this.extractUsername(instagramUrl);
    const { data, error } = await supabase.functions.invoke('fetch-followers', {
      body: { username, influencerId },
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      }
    });
    if (error) throw error;
    return data;
  },

  /**
   * Unified Sync Profile
   */
  async syncProfile(url, userId) {
    return this.scrapeFull(url, { userId });
  }
};

export default scraperService;
