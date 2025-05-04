let chatPollInterval = null; // To store the interval ID for polling
let lastMessageTimestamp = null; // To fetch only new messages

async function loadChatTab(groupId, containerElement) {
    try {
        const response = await fetch('pages/chat-tab.html');
        if (!response.ok) throw new Error('Failed to load chat tab HTML');
        const chatHTML = await response.text();
        containerElement.innerHTML = chatHTML;

        // Add event listeners
        const sendButton = document.getElementById('send-button');
        const messageInput = document.getElementById('message-input');

        sendButton.addEventListener('click', () => sendMessage(groupId, messageInput));
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { // Send on Enter, new line on Shift+Enter
                e.preventDefault(); // Prevent default newline behavior
                sendMessage(groupId, messageInput);
            }
        });
        // Auto-resize textarea
        messageInput.addEventListener('input', autoResizeTextarea, false);


        // Initial load of messages
        lastMessageTimestamp = null; // Reset for full load
        await fetchAndRenderMessages(groupId, true); // true for initial load (scroll down)

        // Start polling for new messages (adjust interval as needed)
        startChatPolling(groupId, 30000); // Poll every 5 seconds

    } catch (error) {
        console.error("Error loading chat tab:", error);
        containerElement.innerHTML = `<p class="error">Failed to load chat: ${error.message}</p>`;
    } finally {
        hideLoading(); // Hide the general loading indicator
    }
}

function autoResizeTextarea() {
    this.style.height = 'auto'; // Reset height
    this.style.height = (this.scrollHeight) + 'px'; // Set to scroll height
}


async function fetchAndRenderMessages(groupId, scrollToBottom = false) {
    const messageList = document.getElementById('message-list');
    if (!messageList) return; // Exit if chat tab isn't visible

    try {
        // Pass lastMessageTimestamp to get only new messages (if available)
        let messages = await apiGetChatMessages(groupId, lastMessageTimestamp);

        if (messages && messages.length > 0) {
            // Clear the message list if it's the first load or if messages are new
            if (lastMessageTimestamp === null) {
                messageList.innerHTML = ''; // Clear on first load
            } else {
                // Remove messages that are already displayed (optimistic UI)
                const existingMessages = Array.from(messageList.children).map(msg => msg.dataset.messageId);
                messages = messages.filter(msg => !existingMessages.includes(msg.id));
            }

            messages.forEach(msg => {
                renderMessage(msg, messageList);
                // Update the timestamp of the latest received message
                if (!lastMessageTimestamp || msg.timestamp > lastMessageTimestamp) {
                    lastMessageTimestamp = msg.timestamp;
                }
            });

            if (scrollToBottom) {
                messageList.scrollTop = messageList.scrollHeight;
            } else {
                 // Optional: Only scroll down if user is already near the bottom
                 const isScrolledToBottom = messageList.scrollHeight - messageList.clientHeight <= messageList.scrollTop + 50; // 50px tolerance
                 if (isScrolledToBottom) {
                     messageList.scrollTop = messageList.scrollHeight;
                 }
            }
        }
    } catch (error) {
        console.error("Failed to fetch messages:", error);
        // Maybe display an error within the chat list?
        // Stop polling if there's a persistent error?
        // stopChatPolling();
    }
}


function renderMessage(message, messageListElement) {
    const messageItem = document.createElement('div');
    messageItem.classList.add('message-item');
    messageItem.dataset.messageId = message.id;

    if (message.type === 'system') {
        messageItem.classList.add('system');
        messageItem.innerHTML = `<div class="message-content">${message.text}</div>`;
    } else {
        // **** CHECK: Ensure currentUser and currentUser.id (email) are available ****
        // This check relies on currentUser being correctly populated by auth.js
        const isSent = currentUser && message.userId === currentUser.id; // message.userId is the email from backend
        messageItem.classList.add(isSent ? 'sent' : 'received');

        messageItem.innerHTML = `
            ${!isSent ? `<img src="${message.userPfp || 'assets/img/placeholder-pfp.svg'}" alt="${message.userName || '?'}" class="pfp">` : ''}
            <div class="message-content-wrapper">
                ${!isSent ? `<span class="message-meta">${message.userName || 'Unknown User'}</span>` : ''}
                <div class="message-content">
                    <span class="message-text">${decodeURIComponent(message.text)}</span>
                </div>
             </div>
        `;
    }
    messageListElement.appendChild(messageItem);
}



async function sendMessage(groupId, inputElement) {
    const text = inputElement.value.trim();
    if (!text) return;

    inputElement.disabled = true;
    document.getElementById('send-button').disabled = true;

    try {
        // --- OPTIMISTIC UI UPDATE ---
        // **** CHECK: Ensure currentUser details are available if implementing this ****
        // if (currentUser) {
        //     const optimisticMsg = {
        //         id: 'temp-' + Date.now(),
        //         userId: currentUser.id,      // Email
        //         userName: currentUser.name,
        //         userPfp: currentUser.pfp,
        //         text: text,
        //         timestamp: Date.now(),
        //         type: 'user'
        //     };
        //     renderMessage(optimisticMsg, document.getElementById('message-list'));
        //     document.getElementById('message-list').scrollTop = document.getElementById('message-list').scrollHeight;
        // } else {
        //     console.warn("Cannot create optimistic message: currentUser not available.");
        // }
        // --- END OPTIMISTIC UI ---

        await apiSendMessage(groupId, text); // API call is fine, backend knows sender
        inputElement.value = '';
        inputElement.style.height = 'auto';

        // Fetch new messages immediately (removes optimistic message implicitly if IDs don't match)
        await fetchAndRenderMessages(groupId, true);

    } catch (error) {
        console.error("Failed to send message:", error);
        alert("Could not send message.");
        // Remove optimistic message if it was added and failed
        // const optimisticElement = document.querySelector(`[data-message-id^="temp-"]`);
        // optimisticElement?.remove();

    } finally {
        inputElement.disabled = false;
        document.getElementById('send-button').disabled = false;
        inputElement.focus();
    }
}


// Polling mechanism
function startChatPolling(groupId, interval) {
    stopChatPolling(); // Clear any existing interval
    console.log("Starting chat polling...");
    // Fetch immediately first time polling starts after load/switch
    fetchAndRenderMessages(groupId);
    chatPollInterval = setInterval(() => {
        // Check if chat tab is still active before fetching
         const chatContent = document.querySelector('.chat-content'); // Check if chat elements exist
         if (currentGroupId === groupId && chatContent) {
            fetchAndRenderMessages(groupId);
         } else {
             console.log("Chat tab not active, stopping polling.");
             stopChatPolling(); // Stop if user navigated away
         }

    }, interval);
}

function stopChatPolling() {
    if (chatPollInterval) {
        console.log("Stopping chat polling...");
        clearInterval(chatPollInterval);
        chatPollInterval = null;
    }
}

// Function called by other modules (e.g., Activities) to add system messages
// Note: This adds it client-side only. The backend *should* also record system messages.
function postSystemMessageToChat(text) {
    const messageList = document.getElementById('message-list');
    if (messageList && document.querySelector('.chat-content')) {
        const systemMsg = { id: 'sys-' + Date.now(), text: text, type: 'system', timestamp: Date.now() };
        renderMessage(systemMsg, messageList);
        messageList.scrollTop = messageList.scrollHeight;
    } else {
        console.log("Chat not visible, system message skipped:", text);
    }
}