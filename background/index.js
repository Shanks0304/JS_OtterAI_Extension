import OtterAIHandler from '../scripts/otteraiFetcher.js';
import { handleAddSheets, handleCreateSheet } from '../scripts/sheetsUploader.js';

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension Installed');
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("action type:", request);
    if (request.action === 'connectGoogleAccount') {
        console.log('Received connectAccount action');
        connectGoogleAccount(sendResponse);
        return true; // This indicates that sendResponse will be async  
    } else if (request.action === 'createSheet') {
        console.log('Received createSpreadSheet action');
        handleCreateSheet(sendResponse);
        return true; // This indicates that sendResponse will be async  
    } else if (request.action === 'fetchOtter') {
        console.log('Received fetchOtter action');
        chrome.storage.local.remove('otterResult', () => {
            handleFetchOtter(request, sendResponse);
        })
        return true;

    } else if (request.action === 'buttonClicked') {
        console.log('Button Index: ', request.index);
        handleAddSheets(request, sendResponse);
        return true;
    } else {
        console.warn('Unknown action:', request.action);
        sendResponse({ message: 'Unknown action' });
    }

});

// Function to get and store auth token  
function connectGoogleAccount(sendResponse) {
    // Check first if there's an existing token  
    chrome.storage.local.get('googleAuthToken', (result) => {
        if (result.googleAuthToken) {
            console.log('Token already available:', result.googleAuthToken);
            sendResponse({ message: 'Already connected to Google Account' });
            return;
        }

        // If not, attempt to retrieve one  
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError || !token) {
                console.error('Error getting auth token:', chrome.runtime.lastError);
                sendResponse({ message: 'Failed to authenticate: ' + (chrome.runtime.lastError?.message || 'Unknown Error') });
                return;
            }
            console.log('Token obtained:', token);

            chrome.storage.local.set({ googleAuthToken: token }, () => {
                sendResponse({ message: 'Successfully connected Google Account' });
            });
        });
    });
}

async function handleFetchOtter(request, sendResponse) {
    chrome.storage.local.get('otterResult', async (result) => {
        if (result.otterResult) {
            console.log('The meeting data is already available:', result.otterResult);
            sendResponse({ message: 'Already existed meeting data', "data": result.otterResult });
            return;
        }
        const email = request.email;
        const password = request.password;

        const otterAIHandler = new OtterAIHandler();
        const otterAIResults = [];

        try {
            await otterAIHandler.login(email, password);
            const speeches = await otterAIHandler.fetchSpeeches();

            for (const speech of speeches) {
                const otid = speech.otid;
                const title = speech.title;
                const end_time = speech.end_time;
                const speechResponse = await otterAIHandler.fetchSpeech(otid);
                const transcripts = speechResponse || [];

                const formattedTranscripts = transcripts.map(transcript =>
                    `${transcript.speaker_id} : ${transcript.transcript}`
                ).join('\n');
                // console.log("OtterAI fetch result: ", formattedTranscripts);
                otterAIResults.push({
                    "title": title,
                    "id": otid,
                    "end_time": end_time,
                    "transcript": formattedTranscripts,
                });
            }

            console.log(otterAIResults);
            chrome.storage.local.set({ otterResult: otterAIResults }, () => {
                sendResponse({
                    message: "OtterAI result", data: otterAIResults
                })
            });

        } catch (error) {
            console.error(error);
            sendResponse({ message: error.message });
        }
    });
}
