import OtterAIHandler from '../scripts/otteraiFetcher.js';
import { handleAddSheets } from '../scripts/sheetsUploader.js';

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension Installed');
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("action type:", request);
    if (request.action === 'GoogleAccount') {
        console.log('Received Google Account action');
        // connectGoogleAccount(sendResponse);

        if (request.type === 'connect') {
            connectGoogleAccount(sendResponse);
        } else if (request.type === 'disconnect') {
            disconnectGoogleAccount(sendResponse);
        }

        return true;
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
    try {
        // Check first if there's an existing token  
        chrome.storage.local.get('googleAuthToken', (result) => {
            if (result.googleAuthToken) {
                console.log('Token already available:', result.googleAuthToken);
                // Fetch user info with existing token
                fetchGoogleUserInfo(result.googleAuthToken)
                    .then(userInfo => {
                        sendResponse({
                            status: 'connected',
                            message: 'Already connected to Google Account',
                            userInfo: userInfo
                        });
                    })
                    .catch(error => {
                        console.error('Error fetching user info:', error);
                        // If fetching fails, clear token and trigger new auth
                        chrome.storage.local.remove(['googleAuthToken', 'googleUserInfo'], () => {
                            connectGoogleAccount(sendResponse);
                        });
                    });
                return;
            }

            // If not, attempt to retrieve one  
            chrome.identity.getAuthToken({ interactive: true }, async (token) => {
                if (chrome.runtime.lastError || !token) {
                    console.error('Error getting auth token:', chrome.runtime.lastError);
                    sendResponse({ message: 'Failed to authenticate: ' + (chrome.runtime.lastError?.message || 'Unknown Error') });
                    return;
                }
                console.log('Token obtained:', token);

                fetchGoogleUserInfo(token)
                    .then(userInfo => {
                        chrome.storage.local.set({
                            googleAuthToken: token,
                            googleUserInfo: userInfo
                        }, () => {
                            sendResponse({
                                status: 'connected',
                                message: 'Successfully connected Google Account',
                                userInfo: userInfo
                            });
                        });
                    })
                    .catch(error => {
                        console.error('Error fetching user info:', error);
                        sendResponse({
                            status: 'error',
                            message: 'Failed to fetch user info: ' + error.message
                        });
                    });
            });
        });
    } catch (error) {
        console.error('Error in connectGoogleAccount:', error);
        sendResponse({
            status: 'error',
            message: 'Failed to authenticate: ' + error.message
        });
    }
}

async function fetchGoogleUserInfo(token) {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google API Error:', response.status, errorText);
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('User info fetched:', data);
        return data;
    } catch (error) {
        console.error('Error in fetchGoogleUserInfo:', error);
        throw new Error('Failed to fetch user info: ' + error.message);
    }
}

async function disconnectGoogleAccount(sendResponse) {
    try {
        chrome.storage.local.get('googleAuthToken', async (result) => {
            if (result.googleAuthToken) {
                try {
                    const response = await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${result.googleAuthToken}`);
                    if (!response.ok) {
                        console.warn('Token revocation returned:', response.status);
                    }
                } catch (error) {
                    console.warn('Error revoking token:', error);
                }

                // Always clear storage, even if revocation fails
                await chrome.storage.local.remove(['googleAuthToken', 'googleUserInfo']);
                sendResponse({
                    status: 'disconnected',
                    message: 'Successfully disconnected Google Account'
                });
            } else {
                sendResponse({
                    status: 'disconnected',
                    message: 'No active Google Account connection'
                });
            }
        });
    } catch (error) {
        console.error('Error in disconnectGoogleAccount:', error);
        sendResponse({
            status: 'error',
            message: 'Failed to disconnect: ' + error.message
        });
    }
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
