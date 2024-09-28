import OtterAI, { OtterAIException } from './otterAI.js';

class OtterAIHandler {
    constructor() {
        this.otterAI = new OtterAI();
    }

    async login(username, password) {
        try {
            const response = await this.otterAI.login(username, password);
            if (response.status !== 200) {
                throw new Error(response.data.message);
            }
        } catch (error) {
            this.handleApiError(error.message);
        }
    }

    async fetchSpeeches() {
        try {
            const response = await this.otterAI.getSpeeches();
            return response.data?.speeches || [];
        } catch (error) {
            return this.handleApiError(error.message);
        }
    }

    async fetchSpeech(otid) {
        try {
            const response = await this.otterAI.getSpeech(otid);
            return response.data?.speech.transcripts || [];
        } catch (error) {
            return this.handleApiError(error.message);
        }
    }

    handleApiError(error) {
        throw new Error(error);
    }
}

export default OtterAIHandler;