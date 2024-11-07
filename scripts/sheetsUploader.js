import OpenAIChatHandler from './chatHandler.js';

// export async function handleCreateSheet(sendResponse) {
//     const tokenResult = await chromeStorageGet('googleAuthToken');
//     const token = tokenResult.googleAuthToken;
//     if (!token) {
//         console.error('No token found. Please connect your Google Account first.');
//         sendResponse({ message: 'No token found. Please connect your Google Account first.' });
//         return;
//     }

//     const spreadsheetResult = await chromeStorageGet('new_spreadsheetId');
//     const spreadsheetId = spreadsheetResult.new_spreadsheetId;
//     if (spreadsheetId) {
//         console.log('Spreadsheet already exists:', spreadsheetId);
//         sendResponse({ message: 'Spreadsheet already exists' });
//         return;
//     }

//     try {
//         await createSpreadsheet(token, sendResponse);
//         console.log('Spreadsheet is created successfully!');
//         sendResponse({ message: 'Spreadsheet is created successfully!' });
//     } catch (error) {
//         if (error.message.includes('Unauthorized')) {
//             // Trigger re-authentication and retrying
//             handleAuthTokenExpiration(token, sendResponse, () => handleCreateSheet(sendResponse));
//         } else {
//             sendResponse({ message: 'Failed to update spreadsheet: ' + error.message });
//         }
//     }
// }

async function createSpreadsheet(title, accessToken, dataset) {
    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            properties: {
                title: title,
            },
            sheets: [{
                properties: {
                    title: 'Scope Items'
                }
            }, {
                properties: {
                    title: 'Action Items'
                }
            }, {
                properties: {
                    title: 'Client Challenges'
                }
            }, {
                properties: {
                    title: 'Meeting Notes'
                }
            }, {
                properties: {
                    title: 'Deliverables'
                }
            }, {
                properties: {
                    title: 'Contacts'
                }
            }, {
                properties: {
                    title: 'Risks and Issues'
                }
            }
            ]
        }),
    });

    const data = await response.json();
    if (response.ok) {
        console.log('Spreadsheet created with ID:', data.spreadsheetId);
        await updateSpreadSheet(data.spreadsheetId, accessToken, dataset)
        return;
    } else {
        const errorResult = await response.json();
        if (errorResult.error.status !== 'UNAVAILABLE') {
            throw new Error('Failed to fetch spreadsheet metadata. Status code: ' + errorResult.error.status + ', Message: ' + errorResult.error.message);
        } else {
            throw new Error('Try again later. The service might be temporarily unavailable.')
        }
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

            const tokenResult = await chromeStorageGet('googleAuthToken');
            const token = tokenResult.googleAuthToken;
            if (!token) {
                sendResponse({
                    success: false,
                    error: 'No token found. Please connect your Google Account first.'
                });
                return;
            }
            // Get OpenAI response
            try {
                const chat_response = await chatHandler.getResponse(meeting_detail.transcript);
                console.log('OpenAI response:', chat_response);
                meeting_detail.transcript = chat_response;

                // Generate and populate spreadsheet
                try {
                    await populateSpreadsheet(token, meeting_detail);
                    console.log('Spreadsheet is updated successfully!');
                    sendResponse({
                        success: true,
                        message: 'Successfully created and populated spreadsheet'
                    });
                } catch (error) {
                    console.error('Spreadsheet error:', error);
                    if (error.message.includes('invalid')) {
                        // Handle token expiration
                        handleAuthTokenExpiration(token, sendResponse, () => handleAddSheets(request, sendResponse));
                    } else {
                        sendResponse({
                            success: false,
                            error: `Failed to update spreadsheet: ${error.message}`
                        });
                    }
                }
            } catch (error) {
                console.error('OpenAI error:', error);
                sendResponse({
                    success: false,
                    error: `Failed to process meeting with OpenAI: ${error.message}`
                });
            }
        } else {
            sendResponse({
                success: false,
                error: 'The meeting data is not available. Please submit Otter.ai credentials first.'
            });
            return;
        }
    } catch (error) {
        console.error('General error:', error);
        sendResponse({
            success: false,
            error: `An unexpected error occurred: ${error.message}`
        });
    }
}

async function populateSpreadsheet(accessToken, jsonData) {
    console.log('Populate Spreadsheet with JSON data.');
    let date = new Date(jsonData.end_time * 1000);
    const masterTitle = `${jsonData.title}__` + date.toString();
    try {
        const exists = await checkSpreadsheet(masterTitle, accessToken);
        if (exists) {
            const spreadsheetId = await retrieveSpreadsheetId(masterTitle, accessToken);
            console.log('Existing SpreadSheet ID: ', spreadsheetId);
            await updateSpreadSheet(spreadsheetId, accessToken, jsonData);
        } else {
            await createSpreadsheet(masterTitle, accessToken, jsonData);
        }
    } catch (error) {
        console.error(error);
        throw new Error(error.message)
    }

}

async function updateSpreadSheet(spreadsheetId, accessToken, dataset) {
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;

    // Fetch spreadsheet to get the sheet information  
    const sheetsResponse = await fetch(`${baseUrl}?fields=sheets.properties`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    const sheetsData = await sheetsResponse.json();
    console.log("Sheets Data Response: ", sheetsData);
    if (!sheetsResponse.ok) {
        if (sheetsData.error.status !== 'UNAVAILABLE') {
            throw new Error('Failed to fetch spreadsheet metadata. Status code: ' + sheetsData.error.status + ', Message: ' + sheetsData.error.message);
        } else {
            throw new Error('Try again later. The service might be temporarily unavailable.')
        }
    }
    const sheets = sheetsData.sheets;

    // Clear each sheet  
    const requests = sheets.map(sheet => ({
        updateCells: {
            range: {
                sheetId: sheet.properties.sheetId
            },
            fields: 'userEnteredValue'
        }
    }));

    const clearResponse = await fetch(`${baseUrl}:batchUpdate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ requests })
    });
    const clearData = await clearResponse.json();
    console.log("Clear Response: ", clearData);

    if (!clearResponse.ok) {
        if (clearData.error.status !== 'UNAVAILABLE') {
            throw new Error('Failed to fetch spreadsheet metadata. Status code: ' + clearData.error.status + ', Message: ' + clearData.error.message);
        } else {
            throw new Error('Try again later. The service might be temporarily unavailable.')
        }
    }

    console.log('Start adding JSON data onto the Sheet from here.');
    // Process and append values to the sheet  
    for (const [key, records] of Object.entries(dataset.transcript)) {
        if (Array.isArray(records)) {
            const range = `${encodeURIComponent(key)}!A1`;  // simplified range  
            const sheetValues = formatJsonDataForSheet(records, key);

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
    const template = {
        'Scope Items': ['Status', 'Priority', 'Details', 'Owner', 'Relevant Notes',],
        'Action Items': ['Date Identified', 'Due Date', 'Status', 'Details', 'Owners', 'Notes'],
        'Client Challenges': ['Status', 'Priority', 'Details', 'Owner', 'Notes'],
        'Meeting Notes': ['Date', 'Meeting', 'Attendees', 'Notes'],
        'Deliverables': ['Deliverable', 'Due', 'Status', 'Status', 'Notes'],
        'Contacts': ['Name', 'Focus Area', 'Role', 'Notes'],
        'Risks and Issues': ['Type', 'Details', 'Impact', 'Status', 'Owner', 'Probabilitiy']
    }
    let headers;
    if (tableArray.length === 0) {
        headers = template[title];
    } else {
        headers = Object.keys(tableArray[0]);
    }

    const sheetData = [];

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

async function checkSpreadsheet(fileName, accessToken) {
    const query = `name='${fileName}' and mimeType='application/vnd.google-apps.spreadsheet'`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const errorInfo = await response.json();
        if (errorInfo.error.status !== 'UNAVAILABLE') {
            throw new Error('Failed to fetch spreadsheet metadata. Status code: ' + errorInfo.error.status + ', Message: ' + errorInfo.error.message);
        } else {
            throw new Error('Try again later. The service might be temporarily unavailable.')
        }
    }

    const data = await response.json();

    if (data.files.length > 0) {
        console.log('Spreadsheet found:', data.files);
        return true; // File exists  
    } else {
        console.log('No spreadsheet found with the given name.');
        return false; // File does not exist  
    }
}
async function retrieveSpreadsheetId(title, authToken) {
    const url = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(title)}' and mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });

    const data = await response.json();

    if (data.files && data.files.length > 0) {
        return data.files[0].id; // Return the first match if there are multiple  
    } else {
        throw new Error(`No spreadsheet found with title: ${title}`);
    }
}