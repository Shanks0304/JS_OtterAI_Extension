# Meeting Manager Chrome Extension

A Chrome extension that automates the process of converting Otter.ai meeting transcripts into structured Google Sheets using OpenAI. Perfect for teams who need to organize and analyze meeting content efficiently.

## 🌟 Key Features

- Google Account Integration
- Otter.ai Meeting Transcript Fetching
- AI-Powered Content Analysis
- Automated Google Sheets Creation
- Real-time Processing Status

## 🔄 Process Flow

### 1. Google Account Connection
- Click the avatar icon in the extension
- Authenticate with Google OAuth2
- Grants access to:
  - Google Sheets API
  - Google Drive API
  - User Profile Information

### 2. Otter.ai Integration
- Enter Otter.ai credentials
- Extension fetches:
  - Recent meeting transcripts
  - Meeting metadata (title, date, duration)
- Displays available meetings in a list

### 3. AI Processing
- Select a meeting to process
- OpenAI analyzes the transcript and structures it into categories:
  - Scope Items
  - Action Items
  - Client Challenges
  - Meeting Notes
  - Deliverables
  - Contacts
  - Risks and Issues

### 4. Google Sheets Export
- Automatically creates a new spreadsheet
- Organizes data into separate sheets by category
- Updates in real-time with processing status

## 🛠 Technical Implementation

### Google Authentication
```javascript
// Reference to authentication flow
startLine: 41
endLine: 104
```

### Otter.ai Data Fetching
```javascript
// Reference to Otter.ai handling
startLine: 165
endLine: 212
```

### OpenAI Processing
```javascript
// Reference to OpenAI schema
startLine: 6
endLine: 116
```

### Google Sheets Integration
```javascript
// Reference to sheets creation and update
startLine: 34
endLine: 91
```

## 🚀 Getting Started

1. **Clone & Install**
```bash
git clone [repository-url]
cd meeting-manager-extension
npm install
```

2. **Configure API Keys**
- Create a Google Cloud Project
- Enable required APIs:
  - Google Sheets API
  - Google Drive API
  - Identity OAuth2
- Set up OpenAI API access

3. **Update Configuration**
- Add your Google OAuth2 client ID to manifest.json
- Configure OpenAI API key
- Set necessary permissions

4. **Build & Load**
```bash
npm run build
```
- Open Chrome Extensions (chrome://extensions/)
- Enable Developer Mode
- Load unpacked extension from build directory

## 👩‍💻 Developer Guide

### Project Structure
```
meeting-manager/
├── manifest.json        # Extension configuration
├── background/          # Background service worker
├── action/             # Popup UI components
├── scripts/            # Core functionality
└── assets/            # Images and static files
```

### Key Components
1. **Background Service Worker**
   - Handles API communications
   - Manages authentication
   - Coordinates data flow

2. **Popup Interface**
   - User authentication
   - Meeting selection
   - Status display

3. **Data Processors**
   - Transcript parsing
   - AI analysis
   - Sheets formatting

### Development Tips
- Use Chrome's developer tools for debugging
- Monitor background console for API interactions
- Test with sample meeting data
- Handle API rate limits appropriately

## 📝 License
MIT License - feel free to use and modify for your needs.