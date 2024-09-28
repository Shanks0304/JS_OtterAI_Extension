document.addEventListener('DOMContentLoaded', function () {
    console.log("DOM Loaded");

    const connectGoogleAccount = document.getElementById('connectAccount');
    const createSheetButton = document.getElementById('createSheet');
    const loginForm = document.getElementById('loginForm');


    if (connectGoogleAccount) {
        console.log("Attach connect account event listener");
        connectGoogleAccount.addEventListener('click', function () {
            console.log("Connect Account Button Clicked");

            chrome.runtime.sendMessage({ action: 'connectGoogleAccount' }, function (response) {
                document.getElementById('status_connectaccount').innerText = response ? response.message : 'Error';
            });
        });
    } else {
        console.error("connectAccount button not found");
    }

    if (createSheetButton) {
        console.log("Attach create sheet event listener");
        createSheetButton.addEventListener('click', function () {
            console.log("Create Sheet Button Clicked");

            chrome.runtime.sendMessage({ action: 'createSheet' }, function (response) {
                document.getElementById('status_createsheet').innerText = response ? response.message : 'Error';
            });
        });
    } else {
        console.error("createSheet button not found");
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            console.log('email:', email);
            console.log('password:', password);
            if (email && password) {
                chrome.runtime.sendMessage({ action: 'fetchOtter', email: email, password: password }, (response) => {
                    document.getElementById('status_otter').innerText = response.message;
                    document.getElementById('otter_result').innerText = JSON.stringify(response.data.length);
                    const buttonContainer = document.getElementById('buttonContainer');
                    buttonContainer.innerHTML = '';
                    response.data.forEach((item, index) => {
                        const button = document.createElement('button');
                        let date = new Date(item.end_time * 1000);
                        button.textContent = item.title + '\n' + date.toString();
                        // Add event listener to each button  
                        button.addEventListener('click', () => {
                            // Send the index of the clicked button back to background.js
                            chrome.runtime.sendMessage({ action: 'buttonClicked', index: index });
                        });
                        buttonContainer.appendChild(button);
                    })

                });
            }
        });
    } else {
        console.error("login form not found");
    }
});