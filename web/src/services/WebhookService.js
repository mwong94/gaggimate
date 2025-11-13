/**
 * Service for sending shot data to configured webhooks
 *
 * Sends complete shot data to a user-configured webhook endpoint
 * with optional authentication token.
 */

export class WebhookService {
  /**
   * Get webhook settings from API settings
   * @returns {Promise<Object>} - Webhook URL and auth token
   */
  async getWebhookSettings() {
    try {
      const response = await fetch('/api/settings');
      const settings = await response.json();
      return {
        url: settings.webhookUrl || '',
        authToken: settings.webhookAuthToken || '',
      };
    } catch (error) {
      console.error('Failed to fetch webhook settings:', error);
      return { url: '', authToken: '' };
    }
  }

  /**
   * Format shot data for webhook payload
   * @param {Object} shot - Shot data from gaggimate
   * @param {Object} notes - Shot notes
   * @returns {Object} - Formatted payload
   */
  formatWebhookPayload(shot, notes = null) {
    if (!shot) {
      throw new Error('Invalid shot data: shot is required');
    }

    // Create a clean payload with all shot data
    const payload = {
      id: shot.id,
      timestamp: shot.timestamp,
      profile: shot.profile,
      profileId: shot.profileId,
      duration: shot.duration,
      volume: shot.volume,
      incomplete: shot.incomplete || false,
      samples: shot.samples || [],
      notes: notes || shot.notes || null,
    };

    return payload;
  }

  /**
   * Send shot data to webhook
   * @param {Object} shot - Shot data from gaggimate
   * @param {Object} notes - Shot notes
   * @param {string} webhookUrl - Webhook URL (optional, will fetch from settings if not provided)
   * @param {string} authToken - Auth token (optional, will fetch from settings if not provided)
   * @returns {Promise<Object>} - Webhook response
   */
  async sendWebhook(shot, notes = null, webhookUrl = null, authToken = null) {
    // Fetch settings if not provided
    let url = webhookUrl;
    let token = authToken;

    if (!url || !token) {
      const settings = await this.getWebhookSettings();
      url = url || settings.url;
      token = token || settings.authToken;
    }

    // Check if webhook is configured
    if (!url || url.trim() === '') {
      throw new Error('Webhook URL is not configured');
    }

    const payload = this.formatWebhookPayload(shot, notes);

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'GaggiMate-WebUI/1.0',
    };

    // Add authorization header if token is provided
    if (token && token.trim() !== '') {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Check if it's an authentication error
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed - please check your auth token');
        }

        // Check if it's a validation error
        if (response.status === 422) {
          throw new Error('Data validation failed - the webhook server rejected the data format');
        }

        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // Try to parse JSON response, but don't fail if it's not JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return { success: true, status: response.status };
    } catch (fetchError) {
      if (fetchError.name === 'TypeError') {
        throw new Error('Network error: Unable to connect to webhook URL');
      }
      throw fetchError;
    }
  }

  /**
   * Validate webhook configuration
   * @param {string} url - Webhook URL
   * @returns {boolean} - True if valid
   */
  validateWebhookUrl(url) {
    if (!url || url.trim() === '') {
      return false;
    }

    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }
}

export const webhookService = new WebhookService();

