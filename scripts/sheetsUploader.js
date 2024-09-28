import OpenAIChatHandler from './chatHandler.js';

export async function handleCreateSheet(sendResponse) {
    const tokenResult = await chromeStorageGet('googleAuthToken');
    const token = tokenResult.googleAuthToken;
    if (!token) {
        console.error('No token found. Please connect your Google Account first.');
        sendResponse({ message: 'No token found. Please connect your Google Account first.' });
        return;
    }

    const spreadsheetResult = await chromeStorageGet('new_spreadsheetId');
    const spreadsheetId = spreadsheetResult.new_spreadsheetId;
    if (spreadsheetId) {
        console.log('Spreadsheet already exists:', spreadsheetId);
        sendResponse({ message: 'Spreadsheet already exists' });
        return;
    }

    try {
        await createSpreadsheet(token, sendResponse);
        console.log('Spreadsheet is created successfully!');
        sendResponse({ message: 'Spreadsheet is created successfully!' });
    } catch (error) {
        if (error.message.includes('Unauthorized')) {
            // Trigger re-authentication and retrying  
            handleAuthTokenExpiration(token, sendResponse, () => handleCreateSheet(sendResponse));
        } else {
            sendResponse({ message: 'Failed to update spreadsheet: ' + error.message });
        }
    }
}
async function createSpreadsheet(accessToken, sendResponse) {
    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            properties: {
                title: 'Master Spreadsheet',
            },
        }),
    });

    const data = await response.json();
    if (response.ok) {
        console.log('Spreadsheet created with ID:', data.spreadsheetId);
        chrome.storage.local.set({ new_spreadsheetId: data.spreadsheetId }, () => {
            sendResponse({ message: 'New SpreadSheet is created successfully.' });
        });
        return;
    } else {
        console.error('Failed to create spreadsheet:', error);
        throw new Error('Failed to create spreadsheet. Status code: ' + response.status + ', Message: ' + errorResult.error.message);
    }
}

export async function handleAddSheets(request, sendResponse) {
    const chatHandler = new OpenAIChatHandler();
    const index = request.index;

    // Retrieve cached otterResult  
    try {
        const result = await chromeStorageGet('otterResult');
        if (result.otterResult) {
            console.log('The meeting data is available');
            const number_index = parseInt(index);
            const meeting_detail = result.otterResult[number_index];
            console.log('selected dataset: ', meeting_detail);

            const chat_response = await chatHandler.getResponse(meeting_detail.transcript);
            console.log('OpenAI response:', chat_response);
            meeting_detail.transcript = chat_response;

            const tokenResult = await chromeStorageGet('googleAuthToken');
            const token = tokenResult.googleAuthToken;
            if (!token) {
                sendResponse({ message: 'No token found. Please connect your Google Account first.' });
                return;
            }

            const spreadsheetResult = await chromeStorageGet('new_spreadsheetId');
            const spreadsheetId = spreadsheetResult.new_spreadsheetId;
            if (spreadsheetId) {
                console.log('Spreadsheet already exists:', spreadsheetId);
                try {
                    await populateSpreadsheet(token, spreadsheetId, meeting_detail);
                    console.log('Spreadsheet is updated successfully!');
                    sendResponse({ message: 'Spreadsheet is updated successfully!' });
                } catch (error) {
                    console.error(error.message);
                    if (error.message.includes('invalid')) {
                        // Trigger re-authentication and retrying  
                        handleAuthTokenExpiration(token, sendResponse, () => handleAddSheets(request, sendResponse));
                    } else {
                        sendResponse({ message: 'Failed to update spreadsheet: ' + error.message });
                    }
                }
            } else {
                sendResponse({ message: 'No spreadsheet found. Please create a new spreadsheet first.' });
            }
        } else {
            sendResponse({ message: 'The meeting data is not available. Please get this by submitting email and password of Otter.ai.' });
        }
    } catch (error) {
        console.error('Error handling request:', error);
        sendResponse({ message: 'An error occurred: ' + error.message });
    }
}

async function populateSpreadsheet(accessToken, spreadsheetId, jsonData) {
    console.log('Populate Spreadsheet with JSON data.');
    let date = new Date(jsonData.end_time * 1000);
    const sheetTitle = date.toString() + `_${jsonData.title}`;

    // Fetch existing sheets
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorResult = await response.json();
        if (errorResult.error.status !== 'UNAVAILABLE') {
            throw new Error('Failed to fetch spreadsheet metadata. Status code: ' + errorResult.error.status + ', Message: ' + errorResult.error.message);
        } else {
            throw new Error('Try again later. The service might be temporarily unavailable.')
        }
    }

    const existingSheets = await response.json();
    const sheetExists = existingSheets.sheets.some(sheet => sheet.properties.title === sheetTitle);
    console.log('Existing sheets: ', sheetExists);
    // Add new sheet if it doesn't exist  
    if (!sheetExists) {
        console.log('There is no matched sheet on master spread. Will create new sheet.');
        const result = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                requests: [{
                    addSheet: {
                        properties: {
                            title: sheetTitle,
                        },
                    },
                }],
            }),
        });

        if (!result.ok) {
            const errorResult = await result.json();
            throw new Error('Failed to add a new sheet. Status code: ' + errorResult.error.status + ', Message: ' + errorResult.error.message);
        }
        console.log('Created new sheet.');
    }

    console.log('Delete previous data from Sheet.');
    // Clear the existing data on the sheet
    const clearRange = `${sheetTitle}!A1:Z`;
    const clearResult = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            ranges: [clearRange]
        }),
    });
    if (!clearResult.ok) {
        const errorResult = await clearResult.json();
        throw new Error('Failed to delete values to the sheet. Status code: ' + errorResult.error.status + ', Message: ' + errorResult.error.message);
    }

    console.log('Start adding JSON data onto the Sheet from here.');
    // Process and append values to the sheet  
    for (const [key, records] of Object.entries(jsonData.transcript)) {
        if (Array.isArray(records)) {
            const sheetValues = formatJsonDataForSheet(records, key);
            const range = `${encodeURIComponent(sheetTitle)}!A1`;  // simplified range  

            const appendResult = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=RAW`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    values: sheetValues,
                }),
            });
            if (!appendResult.ok) {
                const errorResult = await appendResult.json();
                throw new Error('Failed to append values to the sheet. Status code: ' + errorResult.error.status + ', Message: ' + errorResult.error.message);
            }
            console.log('Finish adding JSON data onto Sheet.');
        }
    }
}

function formatJsonDataForSheet(tableArray, title) {
    console.log('Title', title);
    console.log('Table Array', tableArray);
    const template = {
        'Scope Items': ['Status', 'Priority', 'Details', 'Owner', 'Relevant Notes',],
        'Action Items': ['Date Identified', 'Due Date', 'Status', 'Details', 'Owners', 'Notes'],
        'Client Challenges': ['Status', 'Priority', 'Details', 'Owner', 'Notes'],
        'Meeting Notes': ['Date', 'Meeting', 'Attendees', 'Notes'],
        'Deliverables': ['Deliverable', 'Due', 'Status', 'Status', 'Notes'],
        'Contacts': ['Name', 'Focus Area', 'Role', 'Notes'],
        'Risks and Issues': ['Type', 'Details', 'Impact', 'Status', 'Owner', 'Probabilitiy']
    }
    const sheetData = [[title]];
    let headers;
    if (tableArray.length === 0) {
        headers = template[title];
    } else {
        headers = Object.keys(tableArray[0]);
    }

    // Add the title as the first row  

    // Add column headers as the second row  
    sheetData.push(['No', ...headers]);

    // Add each record as a row beneath the headers
    if (tableArray.length !== 0) {
        tableArray.forEach((record, index) => {
            const row = [index + 1];  // Adding the No (number) column  
            headers.forEach(header => {
                row.push(
                    convertToString(record[header])
                );
            });
            sheetData.push(row);
        });
    }

    // Adding a blank row after the table for separation  
    sheetData.push([]);

    return sheetData;
}

function handleAuthTokenExpiration(expiredToken, sendResponse, retryOperation) {
    chrome.identity.removeCachedAuthToken({ token: expiredToken }, () => {
        console.log('Expired token removed.');

        chrome.identity.getAuthToken({ interactive: true }, (newToken) => {
            if (chrome.runtime.lastError || !newToken) {
                sendResponse({ message: 'Re-authentication failed: ' + (chrome.runtime.lastError?.message || 'Unknown error') });
                return;
            }

            chrome.storage.local.set({ googleAuthToken: newToken }, () => {
                console.log('Stored new access token.');
                retryOperation();
            });
        });
    });
}

async function chromeStorageGet(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(key, (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError));
            } else {
                resolve(result);
            }
        });
    });
}

function convertToString(value) {
    // Check for null and undefined explicitly  
    if (value === null) {
        return "null";
    }
    if (typeof value === "undefined") {
        return "undefined";
    }

    // Check if the value is an object or an array  
    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch (error) {
            // If there's an error with JSON.stringify (circular reference, for instance)  
            return "[object Object]";
        }
    }

    // Use toString for other primitives (strings, numbers, booleans, symbols)  
    return String(value);
}