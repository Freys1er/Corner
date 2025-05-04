let currentGroupId = null;
let currentGroupName = null;
let currentGroupCode = null; // Store the group code

async function loadGroupView(groupId) {
    currentGroupId = groupId;
    showLoading('Loading group...');

    try {
        // Fetch group details (name, code) - needed for header and potential settings
        const groupDetails = await apiGetGroupDetails(groupId); // Assume this returns { name, code }
        currentGroupName = groupDetails.name || 'Group';
        currentGroupCode = groupDetails.code || 'N/A';

        // Load the main group view structure from HTML file
        const response = await fetch('pages/group-view.html');
        if (!response.ok) throw new Error('Failed to load group view HTML');
        const groupHTML = await response.text();

        const appContainer = document.getElementById('app-container');
        appContainer.innerHTML = groupHTML;

        // Set header title
        document.getElementById('group-header-title').textContent = currentGroupName;

        // Add back button functionality
        document.getElementById('back-to-groups-btn').addEventListener('click', () => {
             navigateToGroupList(); // Or use history.back() if using pushState routing
             currentGroupId = null; // Clear current group
             currentGroupName = null;
             currentGroupCode = null;
        });
         // Add settings button functionality (placeholder)
         document.getElementById('group-settings-btn').addEventListener('click', showGroupSettings);


        // Set up tab switching
        const tabs = document.querySelectorAll('.tab-item');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        // Load the default tab (Chat)
        switchTab('chat');

    } catch (error) {
        console.error(`Error loading group ${groupId}:`, error);
        alert(`Failed to load group: ${error.message}`);
        navigateToGroupList(); // Go back if loading fails
    } finally {
        hideLoading();
    }
}

function switchTab(tabId) {
    const tabs = document.querySelectorAll('.tab-item');
    const contentArea = document.getElementById('group-content-area');

    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    // Load content for the selected tab
    showLoading('Loading content...'); // Show loading indicator for tab content
    contentArea.innerHTML = ''; // Clear previous content

    switch (tabId) {
        case 'chat':
            loadChatTab(currentGroupId, contentArea);
            break;
        case 'voting':
            loadVotingTab(currentGroupId, contentArea);
            break;
        case 'activities':
            loadActivitiesTab(currentGroupId, contentArea);
            break;
        default:
            contentArea.innerHTML = `<p>Unknown tab: ${tabId}</p>`;
            hideLoading();
    }
    // hideLoading() should be called within each load function upon completion
}

function showGroupSettings() {
    // Example: Use a simple modal or alert for now
    const shareUrl = `${window.location.origin}${window.location.pathname}#join=${currentGroupCode}`;

    const settingsContent = `
        <h2>Group Settings</h2>
        <p><strong>Group Code:</strong></p>
        <div class="group-code-display">${currentGroupCode}</div>
        <div class="group-actions">
            <button id="reset-code-btn"><img src="assets/img/icon-reset.svg" alt="Reset" style="width:16px; height:16px; vertical-align: middle;"> Reset Code</button>
            <button id="share-code-btn"><img src="assets/img/icon-share.svg" alt="Share" style="width:16px; height:16px; vertical-align: middle;"> Share Link</button>
        </div>
        <div class="modal-actions">
            <button id="close-settings-btn">Close</button>
        </div>
    `;
    showModal(settingsContent);

    document.getElementById('reset-code-btn').addEventListener('click', handleResetCode);
    document.getElementById('share-code-btn').addEventListener('click', () => handleShareCode(shareUrl));
    document.getElementById('close-settings-btn').addEventListener('click', hideModal);
}

async function handleResetCode() {
     if (!confirm("Are you sure you want to generate a new code? The old one will stop working.")) {
         return;
     }
     showLoading("Resetting code...");
     try {
         const result = await apiResetGroupCode(currentGroupId);
         if (result && result.newCode) {
             currentGroupCode = result.newCode;
             alert("Group code has been reset.");
             hideModal(); // Close the current modal
             showGroupSettings(); // Reopen with the new code
         } else {
             alert(result.message || "Failed to reset code.");
         }
     } catch (error) {
         console.error("Reset code failed:", error);
     } finally {
         hideLoading();
     }
}

function handleShareCode(shareUrl) {
    if (navigator.share) {
        navigator.share({
            title: `Join my group '${currentGroupName}' on Corner`,
            text: `Use this link or the code ${currentGroupCode} to join!`,
            url: shareUrl,
        })
        .then(() => console.log('Successful share'))
        .catch((error) => console.log('Error sharing', error));
    } else {
        // Fallback for browsers that don't support Web Share API
        prompt("Copy this link to share:", shareUrl);
    }
}