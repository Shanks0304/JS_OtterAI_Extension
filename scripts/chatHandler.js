class OpenAIChatHandler {
    constructor() {
        this.apiKey = "YOUR_OPEN_AI_KEY"
    }

    /**  
     * Sends a message to the OpenAI API and retrieves the response.  
     * @param {string} inputText - The text input to send to the OpenAI model.  
     * @returns {Promise<string>} - The response from the OpenAI model.  
     */
    getResponse(inputText) {
        const url = 'https://api.openai.com/v1/chat/completions';

        const payload = {
            model: 'gpt-4o-2024-08-06',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert at structured data extraction. You will be given unstructured text from a meeting transcript and should convert it into the given structure. Don't remain placeholder even if items not applicable.`,
                },
                {
                    role: 'user',
                    content: `${inputText}`
                }],
            response_format: {
                'type': 'json_schema',
                'json_schema': {
                    'name': 'meeting_extraction',
                    'schema': {
                        'type': 'object',
                        'properties': {
                            'Scope Items': {
                                'type': 'array',
                                'items': {
                                    'type': 'object',
                                    'properties': {
                                        'Status': { 'type': 'string' },
                                        'Priority': { 'type': 'string' },
                                        'Details': { 'type': 'string' },
                                        'Owner': { 'type': 'string' },
                                        'Relevant Notes': { 'type': 'string' }
                                    },
                                    'required': [
                                        'Status', 'Priority', 'Details', 'Owner', 'Relevant Notes'
                                    ],
                                    'additionalProperties': false
                                }
                            },
                            'Action Items': {
                                'type': 'array',
                                'items': {
                                    'type': 'object',
                                    'properties': {
                                        'Date Identified': { 'type': 'string' },
                                        'Due Date': { 'type': 'string' },
                                        'Status': { 'type': 'string' },
                                        'Details': { 'type': 'string' },
                                        'Owners': { 'type': 'string' },
                                        'Notes': { 'type': 'string' }
                                    },
                                    'required': [
                                        'Date Identified', 'Due Date', 'Status', 'Details', 'Owners', 'Notes'
                                    ],
                                    'additionalProperties': false
                                }
                            },
                            'Client Challenges': {
                                'type': 'array',
                                'items': {
                                    'type': 'object',
                                    'properties': {
                                        'Status': { 'type': 'string' },
                                        'Priority': { 'type': 'string' },
                                        'Details': { 'type': 'string' },
                                        'Owner': { 'type': 'string' },
                                        'Notes': { 'type': 'string' }
                                    },
                                    'required': [
                                        'Status', 'Priority', 'Details', 'Owner', 'Notes'
                                    ],
                                    'additionalProperties': false
                                },

                            },
                            'Meeting Notes': {
                                'type': 'array',
                                'items': {
                                    'type': 'object',
                                    'properties': {
                                        'Date': { 'type': 'string' },
                                        'Meeting': { 'type': 'string' },
                                        'Attendees': { 'type': 'string' },
                                        'Notes': { 'type': 'string' },
                                    },
                                    'required': [
                                        'Date', 'Meeting', 'Attendees', 'Notes'
                                    ],
                                    'additionalProperties': false
                                }
                            },
                            'Deliverables': {
                                'type': 'array',
                                'items': {
                                    'type': 'object',
                                    'properties': {
                                        'Deliverable': { 'type': 'string' },
                                        'Due': { 'type': 'string' },
                                        'Status': { 'type': 'string' },
                                        'Status Notes': { 'type': 'string' }
                                    },
                                    'required': [
                                        'Deliverable', 'Due', 'Status', 'Status Notes'
                                    ],
                                    'additionalProperties': false
                                }
                            },
                            'Contacts': {
                                'type': 'array',
                                'items': {
                                    'type': 'object',
                                    'properties': {
                                        'Name': { 'type': 'string' },
                                        'Focus Area': { 'type': 'string' },
                                        'Role': { 'type': 'string' },
                                        'Notes': { 'type': 'string' }
                                    },
                                    'required': [
                                        'Name', 'Focus Area', 'Role', 'Notes'
                                    ],
                                    'additionalProperties': false
                                }
                            },
                            'Risks and Issues': {
                                'type': 'array',
                                'items': {
                                    'type': 'object',
                                    'properties': {
                                        'Type': { 'type': 'string' },
                                        'Details': { 'type': 'string' },
                                        'Impact': { 'type': 'string' },
                                        'Status': { 'type': 'string' },
                                        'Owner': { 'type': 'string' },
                                        'Probability': { 'type': 'string' }
                                    },
                                    'required': [
                                        'Type', 'Details', 'Impact', 'Status', 'Owner', 'Probability'
                                    ],
                                    'additionalProperties': false
                                }
                            },
                        },
                        'required': [
                            'Scope Items', 'Action Items', 'Client Challenges', 'Meeting Notes', 'Deliverables', 'Contacts', 'Risks and Issues'
                        ],
                        'additionalProperties': false
                    },
                    'strict': true
                }
            }
        };

        return fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
            .then(response => {
                if (!response.ok) {
                    console.error(response);
                    throw new Error('Failed to reach OpenAI API');
                }
                return response.json();
            })
            .then(data => {
                if (data.choices && data.choices.length > 0) {
                    const content = data.choices[0].message.content;
                    try {
                        return JSON.parse(content);
                    } catch (parseError) {
                        console.error('Failed to parse response as JSON:', parseError);
                        throw new Error('The response was not valid JSON.');
                    }
                } else {
                    throw new Error('No valid response from OpenAI API');
                }
            })
            .catch(error => {
                console.error('OpenAI API error:', error);
                throw error;
            });
    }
}

export default OpenAIChatHandler;