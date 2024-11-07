document.addEventListener('DOMContentLoaded', function () {
    console.log("DOM Loaded");

    const googleAccountButton = document.getElementById('accountButton');
    const loginForm = document.getElementById('loginForm');
    const buttonContainer = document.getElementById('buttonContainer');

    // Check initial auth state
    checkAuthState();

    if (googleAccountButton) {
        console.log("Attach Google Account event listener");
        googleAccountButton.addEventListener('click', handleAccountClick);
    } else {
        console.error("Google Account button not found");
    }

    async function checkAuthState() {
        chrome.storage.local.get('googleUserInfo', (result) => {
            updateUIForAuthState(result.googleUserInfo);
        });
    }

    function updateUIForAuthState(userInfo) {
        const avatarImg = document.getElementById('avatarImg');
        if (userInfo && userInfo.picture) {
            avatarImg.src = userInfo.picture;
            avatarImg.classList.add('connected');
        } else {
            avatarImg.src = '../assets/default-avatar.png';
            avatarImg.classList.remove('connected');
        }
    }

    function handleAccountClick() {
        chrome.storage.local.get('googleAuthToken', async (result) => {
            if (result.googleAuthToken) {
                // Show popup menu
                showAccountPopup();
            } else {
                // Connect account
                chrome.runtime.sendMessage(
                    { action: 'GoogleAccount', type: 'connect' },
                    handleAuthResponse
                );
            }
        });
    }

    function showAccountPopup() {
        // Remove existing popup if any
        removeAccountPopup();

        const popup = document.createElement('div');
        popup.className = 'account-popup';
        popup.innerHTML = `
        <div class="popup-content">
            <button id="signOutButton" class="popup-button">Sign Out</button>
        </div>
    `;

        document.querySelector('.account-section').appendChild(popup);

        // Add click handler for sign out
        document.getElementById('signOutButton').addEventListener('click', () => {
            chrome.runtime.sendMessage(
                { action: 'GoogleAccount', type: 'disconnect' },
                handleAuthResponse
            );
            removeAccountPopup();
        });

        // Close popup when clicking outside
        document.addEventListener('click', handleOutsideClick);
    }

    function removeAccountPopup() {
        const popup = document.querySelector('.account-popup');
        if (popup) {
            popup.remove();
            document.removeEventListener('click', handleOutsideClick);
        }
    }

    function handleOutsideClick(event) {
        const popup = document.querySelector('.account-popup');
        const accountButton = document.getElementById('accountButton');

        if (popup && !popup.contains(event.target) && !accountButton.contains(event.target)) {
            removeAccountPopup();
        }
    }

    function handleAuthResponse(response) {
        const statusText = document.getElementById('status_connectaccount');
        statusText.innerText = response.message;
        statusText.className = `status-text ${response.status}`;

        if (response.userInfo) {
            updateUIForAuthState(response.userInfo);
        } else {
            updateUIForAuthState(null);
        }
    }
    // if (createSheetButton) {
    //     console.log("Attach create sheet event listener");
    //     createSheetButton.addEventListener('click', function () {
    //         console.log("Create Sheet Button Clicked");

    //         chrome.runtime.sendMessage({ action: 'createSheet' }, function (response) {
    //             document.getElementById('status_createsheet').innerText = response ? response.message : 'Error';
    //         });
    //     });
    // } else {
    //     console.error("createSheet button not found");
    // }

    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            console.log('email:', email);
            console.log('password:', password);
            if (email && password) {
                chrome.runtime.sendMessage({ action: 'fetchOtter', email: email, password: password }, (response) => {
                    handleResponse(response, buttonContainer);
                });
            }
        });
    } else {
        console.error("login form not found");
    }
    chrome.storage.local.get('otterResult', (result) => {
        console.log(result);
        if (result) {
            const stored_response = { data: result.otterResult, message: 'Already stored!' };
            handleResponse(stored_response, buttonContainer)
        }
    });
});

// Function to handle response and render buttons  
function handleResponse(response, buttonContainer) {
    document.getElementById('status_otter').innerText = response.message;
    document.getElementById('otter_result').innerText = JSON.stringify(response.data.length);
    buttonContainer.innerHTML = '';

    response.data.forEach((item, index) => {
        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = 'meeting-item';

        const button = document.createElement('button');
        let date = new Date(item.end_time * 1000);
        button.className = 'meeting-button';

        // Create formatted date string
        const dateOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        const formattedDate = date.toLocaleDateString('en-US', dateOptions);

        // Create structured content
        button.innerHTML = `
            <div class="meeting-title">${item.title}</div>
            <div class="meeting-date">${formattedDate}</div>
        `;

        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'meeting-notification hidden';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message"></span>
                <button class="notification-close">×</button>
            </div>
        `;

        button.addEventListener('click', () => {
            // Show loading state
            button.classList.add('loading');
            notification.classList.remove('hidden');
            notification.querySelector('.notification-message').textContent = 'Processing...';

            chrome.runtime.sendMessage({ action: 'buttonClicked', index: index }, (response) => {
                // Remove loading state
                button.classList.remove('loading');

                // Update notification with response
                const notificationMessage = notification.querySelector('.notification-message');
                if (response && response.success) {
                    notification.className = 'meeting-notification success';
                    notificationMessage.textContent = 'Successfully processed meeting';
                } else {
                    notification.className = 'meeting-notification error';
                    notificationMessage.textContent = response?.error || 'Failed to process meeting';
                }

                // Auto-hide notification after 3 seconds
                setTimeout(() => {
                    notification.classList.add('hidden');
                }, 3000);
            });
        });

        // Add close button functionality
        notification.querySelector('.notification-close').addEventListener('click', (e) => {
            e.stopPropagation();
            notification.classList.add('hidden');
        });

        buttonWrapper.appendChild(button);
        buttonWrapper.appendChild(notification);
        buttonContainer.appendChild(buttonWrapper);
    });
}
