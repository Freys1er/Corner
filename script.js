// script.js (Root Router & Orchestrator)

// Assuming appContainer is globally accessible or fetched here
const appContainer = document.getElementById('app-container');

/**
 * Primary router function. Determines view based on hash and auth state.
 * Relies on functions in auth.js to check/establish auth state.
 */
async function router() {
    console.log("Router executing. Hash:", window.location.hash);
    stopChatPolling(); // Stop any active chat polling during navigation

    // Always show loading initially during route change/load
    // Use a less intrusive loading indicator if preferred for background auth checks
    showLoading("Loading view..."); // Use a message indicating view load

    const hash = window.location.hash;
    let isAuthenticated = false; // Assume not authenticated initially for routing logic

    // --- Check Authentication Status ---
    // This relies on checkAuthState function which should quickly return
    // the current status (checking currentUser variable set by previous logins
    // or the background verification process).
    isAuthenticated = checkAuthState(); // Use a synchronous check function from auth.js

    console.log(`Router: Authentication status is ${isAuthenticated}`);

    // --- Routing Logic ---
    if (hash.startsWith('#group/')) {
        const groupId = hash.substring('#group/'.length);
        if (isAuthenticated) {
            console.log(`Router: Authenticated, loading group ${groupId}`);
            await loadGroupView(groupId); // Assumes loadGroupView handles its own loading indicator hides the main one
        } else {
            console.log(`Router: Not authenticated, redirecting to login before loading group ${groupId}`);
            // Store intended destination to redirect after login? (More complex)
            // For now, just go to login.
            redirectToLogin(); // Redirect function in auth.js
        }
    } else if (hash.startsWith('#join=')) {
        const joinCode = hash.substring('#join='.length);
        console.log(`Router: Handling join code ${joinCode}`);
        // Joining requires being logged in. If not, redirect.
        if (isAuthenticated) {
             await handleJoinViaUrl(joinCode); // handleJoinViaUrl should navigate on success/failure
        } else {
             console.log(`Router: Not authenticated, redirecting to login before joining group.`);
             // Optionally store join code to attempt after login
             redirectToLogin();
        }
        // Clear the join hash after attempting, regardless of auth state
        window.location.hash = '';
    } else { // Default route (# or no hash)
        if (isAuthenticated) {
            console.log("Router: Authenticated, navigating to group list.");
            await navigateToGroupList(); // In auth.js, loads groups and renders
        } else {
            console.log("Router: Not authenticated, rendering login screen.");
            renderLoginScreen(); // In auth.js
             hideLoading(); // Login screen is the final state here
        }
    }

    // General hideLoading might be needed here if sub-functions don't handle it
    // hideLoading(); // Be careful not to hide too early if content is still loading async
}

// --- Initial Page Load & Event Listener ---

// Use window.onload from auth.js as the primary trigger after resources load
// Remove the DOMContentLoaded listener here to avoid race conditions.

/*
document.addEventListener('DOMContentLoaded', () => {
    // DO NOT CALL ROUTER HERE - let window.onload handle initial check
});
*/

// Listen for hash changes to re-route
window.addEventListener('hashchange', router);

// --- Utility Functions (Keep showLoading/hideLoading/showModal/hideModal here or move to utils.js) ---
function showLoading(message = 'Loading...') {
    let spinner = appContainer.querySelector('.loading-spinner');
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        // Make spinner less intrusive maybe? Or style it differently
        appContainer.appendChild(spinner);
    }
    spinner.textContent = message;
    spinner.style.display = 'block';
}

function hideLoading() {
    const spinner = appContainer.querySelector('.loading-spinner');
    if (spinner) {
        spinner.style.display = 'none';
    }
}

function showModal(contentHTML) { /* ... implementation ... */ }
function hideModal() { /* ... implementation ... */ }

// Note: Functions like loadGroupView, handleJoinViaUrl, navigateToGroupList, renderLoginScreen
// are assumed to be defined in other files (auth.js, group.js, etc.) and handle hiding
// the loading indicator when their specific content is ready.