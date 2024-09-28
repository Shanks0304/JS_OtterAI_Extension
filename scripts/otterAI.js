export class OtterAIException extends Error {
    constructor(message) {
        super(message);
        this.name = 'OtterAIException';
    }
}

class OtterAI {
    static API_BASE_URL = 'https://otter.ai/forward/api/v1/';

    constructor() {
        this._cookies = '';
        this._userid = null;
    }

    _isUserIdInvalid() {
        return !this._userid;
    }

    _handleResponse(response, data) {
        return { status: response.status, data };
    }

    async login(username, password) {
        const authUrl = `${OtterAI.API_BASE_URL}login`;
        const response = await fetch(authUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${btoa(username + ':' + password)}`,
            },
            credentials: 'include'
        });

        if (!response.ok) {
            return this._handleResponse(response, await response.json());
        }

        const data = await response.json();
        this._userid = data.userid;
        this._cookies = response.headers.get('set-cookie');
        return this._handleResponse(response, data);
    }

    async getUser() {
        return this._fetchWithAuth('user');
    }

    async getSpeakers() {
        return this._fetchWithAuth('speakers');
    }

    async getSpeeches(folder = 0, pageSize = 45, source = 'all') {
        return this._fetchWithAuth('speeches', { folder, page_size: pageSize, source });
    }

    async getSpeech(otId) {
        return this._fetchWithAuth('speech', { otid: otId });
    }

    async createSpeaker(speakerName) {
        const url = `${OtterAI.API_BASE_URL}create_speaker`;
        const csrfToken = this._cookies.split('=')[1]; // Extract csrftoken  

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrftoken': csrfToken,
            },
            body: JSON.stringify({ userid: this._userid, speaker_name: speakerName })
        });

        return this._handleResponse(response, await response.json());
    }

    async getNotificationSettings() {
        return this._fetchWithAuth('get_notification_settings');
    }

    async listGroups() {
        return this._fetchWithAuth('list_groups');
    }

    async getFolders() {
        return this._fetchWithAuth('folders');
    }

    async _fetchWithAuth(endpoint, params = {}) {
        if (this._isUserIdInvalid()) throw new OtterAIException('userid is invalid');
        const url = new URL(`${OtterAI.API_BASE_URL}${endpoint}`);
        url.search = new URLSearchParams({ userid: this._userid, ...params });

        const response = await fetch(url, {
            headers: {
                'Cookie': this._cookies,
            }
        });

        return this._handleResponse(response, await response.json());
    }
}

export default OtterAI;