// js/auth.js - Handles Authentication, User State, Login/Logout UI, Group List Rendering

// --- Constants ---
const GOOGLE_CLIENT_ID = '490934668566-dpcfvk9p5kfpk44ko8v1gl3d5i9f83qr.apps.googleusercontent.com';
const ID_TOKEN_STORAGE_KEY = 'cornerAppIdToken_LS'; // Key for localStorage

// --- State Variables ---
let currentUser = null; // Holds user object {id: email, name, pfp} if authenticated
let isVerifyingToken = false; // Flag to prevent duplicate verification calls on load

// --- Helper function to get token from localStorage ---
function getIdTokenFromStorage() {
    return localStorage.getItem(ID_TOKEN_STORAGE_KEY);
}

// --- Primary Initialization on Page Load ---
// This function is the main entry point called once all initial resources are loaded.
window.onload = function () {
    console.log("window.onload: Starting initialization...");
    initializeApp(); // Call main initialization logic
};

/**
 * Initializes the application state: checks storage, verifies token if needed,
 * initializes Google Sign-In library, and then calls the main router.
 */
async function initializeApp() {
    const storedToken = getIdTokenFromStorage();
    console.log("initializeApp: Token found in localStorage:", storedToken ? "Yes" : "No");

    // Only attempt verification if a token exists, we don't have a user yet,
    // and we aren't already in the process of verifying.
    if (storedToken && !currentUser && !isVerifyingToken) {
        console.log("initializeApp: Found stored token, attempting background verification...");
        isVerifyingToken = true;
        showLoading("Checking session..."); // Show initial loading indicator
        await verifyStoredTokenAndSetUser(storedToken); // Attempt verification (sets currentUser on success)
        isVerifyingToken = false;
        console.log("initializeApp: Background verification attempt finished.");
    } else if (currentUser) {
        console.log("initializeApp: User already exists from previous verification. No background check needed.");
    } else {
        console.log("initializeApp: No stored token or already verifying. Proceeding without background check.");
    }

    // Initialize the Google Sign-In library AFTER the initial token check attempt.
    // This ensures the login button can be rendered if needed.
    initializeGoogleSignIn();

    // Call the main router (defined in script.js) AFTER initialization attempt.
    // The router will use checkAuthState() to decide the correct view.
    console.log("initializeApp: Calling router...");
    if (typeof router === 'function') {
        await router(); // Use await if router function itself is async
    } else {
        console.error("initializeApp: router() function not found!");
        hideLoading(); // Hide loading if router cannot be called
    }

    // General hideLoading might be needed if router/sub-view doesn't handle it
    // hideLoading(); // Be cautious with placement
}

/**
 * Attempts to verify a token stored in localStorage via the backend.
 * Sets the global `currentUser` object on success. Clears token on failure.
 * @param {string} storedToken The token retrieved from localStorage.
 */
async function verifyStoredTokenAndSetUser(storedToken) {
    console.log("verifyStoredTokenAndSetUser: Verifying stored token...");
    // Don't show/hide loading here, initializeApp manages the initial loading state.
    try {
        // Call the API function (defined in api.js) to verify the token
        const backendResponse = await apiVerifyGoogleToken(storedToken);
        console.log("verifyStoredTokenAndSetUser: Backend response:", backendResponse);

        if (backendResponse && backendResponse.verified) {
            // Success! Set the global user state.
            currentUser = {
                id: backendResponse.email,
                name: backendResponse.name,
                pfp: backendResponse.pfp
            };
            console.log("verifyStoredTokenAndSetUser: Session restored! currentUser set:", currentUser.id);
            // No need to update localStorage, the token is still valid.
        } else {
            // Verification failed (token invalid, expired, etc.)
            console.log("verifyStoredTokenAndSetUser: Stored token verification failed by backend. Clearing storage.");
            currentUser = null;
            localStorage.removeItem(ID_TOKEN_STORAGE_KEY);
        }
    } catch (error) {
        // Handle errors during the API call itself (network, server error)
        // Check if error indicates an invalid token vs. a network/server issue
        if (error.message.includes("invalid") || error.message.includes("expired") || error.message.includes("Authentication token not found")) {
            console.warn("verifyStoredTokenAndSetUser: Verification failed due to invalid/expired token or missing token.");
        } else {
            console.error("Error during stored token verification API call:", error);
            // Optionally inform user non-blockingly about session check failure
            // alert("Could not verify your previous session. Please log in if needed.");
        }
        currentUser = null;
        localStorage.removeItem(ID_TOKEN_STORAGE_KEY);
    } finally {
        console.log("verifyStoredTokenAndSetUser: Verification attempt finished.");
        isVerifyingToken = false; // Ensure flag is reset
    }
}

/**
 * Initializes the Google Sign-In library (google.accounts.id).
 * Should be called after the GIS script has potentially loaded.
 */
function initializeGoogleSignIn() {
    try {
        console.log("Initializing Google Sign-In library...");
        // Check if the google object and necessary sub-objects exist
        if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
            console.error("Google Identity Services library not available for initialization.");
            // Attempt to load it dynamically? Or rely on the script tag loading.
            return; // Exit if library isn't ready
        }
        // Initialize the library with Client ID and callback
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse, // Function called on successful sign-in
            ux_mode: "popup",                   // Use popup UX
        });
        console.log("Google Sign-In library initialized successfully.");
        // Attempt to render button immediately if the container is already present
        renderGoogleSignInButton();
    } catch (error) {
        console.error("Error initializing Google Sign-In library:", error);
        // Potentially show an error message to the user
    }
}

// --- Google Sign-In Callback (Called by Google Library) ---
/**
 * Handles the credential response from Google after a successful sign-in action.
 * Verifies the token with the backend, sets user state, stores token, and navigates.
 * @param {object} response The credential response object containing the ID token.
 */
async function handleCredentialResponse(response) {
    console.log("handleCredentialResponse: Received credential from Google.");
    // Validate response structure
    if (!response || !response.credential) {
        console.error("handleCredentialResponse: Credential response missing token.");
        alert("Sign-in failed: No token received from Google.");
        localStorage.removeItem(ID_TOKEN_STORAGE_KEY); // Ensure storage is clear on failure
        return;
    }

    const idToken = response.credential;
    showLoading("Verifying your account...");

    try {
        // Call backend API to verify the fresh token
        const backendResponse = await apiVerifyGoogleToken(idToken);

        if (backendResponse && backendResponse.verified) {
            // Verification successful!
            currentUser = { // Set global user state
                id: backendResponse.email,
                name: backendResponse.name,
                pfp: backendResponse.pfp
            };
            // Store the new, valid token in localStorage
            localStorage.setItem(ID_TOKEN_STORAGE_KEY, idToken);
            console.log("handleCredentialResponse: User verified and token stored:", currentUser.id);

            hideModal(); // Close any open modals (like sign-in prompt)
            navigateToGroupList(); // Navigate to the main view after successful login

        } else {
            // Backend verification failed
            localStorage.removeItem(ID_TOKEN_STORAGE_KEY); // Clear storage
            throw new Error(backendResponse.error || "Account verification failed on the server.");
        }
    } catch (error) {
        // Handle errors during verification process
        console.error("Google Sign-In verification process failed:", error);
        alert(`Sign-in failed: ${error.message}`);
        currentUser = null; // Clear user state
        localStorage.removeItem(ID_TOKEN_STORAGE_KEY); // Clear storage
        renderLoginScreen(); // Show login screen again on failure
    } finally {
        hideLoading();
    }
}

// --- Synchronous State Check (Used by Router) ---
/**
 * Synchronously checks if the user is currently considered authenticated.
 * @returns {boolean} True if currentUser object is populated, false otherwise.
 */
function checkAuthState() {
    const isAuthenticated = !!currentUser;
    console.log("checkAuthState: Returning", isAuthenticated);
    return isAuthenticated;
}

// --- UI Rendering Functions ---

/**
 * Renders the login screen UI into the app container.
 * Clears any existing user session token from localStorage.
 */
function renderLoginScreen() {
    console.log("Rendering Login Screen - Clearing Token");
    const appContainer = document.getElementById('app-container');
    if (!appContainer) { console.error("renderLoginScreen: appContainer not found!"); return; }

    // Clear current user state and stored token
    currentUser = null;
    localStorage.removeItem(ID_TOKEN_STORAGE_KEY);

    // Set the HTML for the login view
    appContainer.innerHTML = `
        <div class="login-container">
           <h1>Welcome to Corner</h1>
           <p>Connect with your friends.</p>
           <!-- Container for the Google Sign-In button -->
           <div id="google-signin-button-container" style="margin-bottom: 20px; display: flex; justify-content: center;">
               <!-- Rendered by renderGoogleSignInButton -->
               <span style="color: var(--ios-dark-gray); font-size: 14px;">Loading Sign-In...</span>
           </div>
           <p>Or join an existing group (after signing in):</p>
            <div class="join-group-section">
               <input type="text" id="join-code-input" placeholder="Enter Group Code">
               <button id="join-group-btn" class="ios-button-primary">Join Group</button>
           </div>
        </div>
    `;

    // Render the Google button now that the container exists
    renderGoogleSignInButton();

    // Add event listener for the manual join button
    const joinButton = document.getElementById('join-group-btn');
    if (joinButton) {
        joinButton.addEventListener('click', handleJoinGroup);
    } else {
        console.error("renderLoginScreen: Could not find join-group-btn.");
    }
    hideLoading(); // Hide loading, login screen is the final view
}

/**
 * Renders the Google Sign-In button into its container ('google-signin-button-container').
 * Checks if the Google library is ready before attempting to render.
 */
function renderGoogleSignInButton() {
    const buttonContainer = document.getElementById('google-signin-button-container');
    if (!buttonContainer) {
        // console.log("renderGoogleSignInButton: Container not found (maybe not on login screen).");
        return; // Silently return if container doesn't exist
    }
    try {
        // Check if Google library objects are available
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            buttonContainer.innerHTML = ''; // Clear loading text/previous button
            google.accounts.id.renderButton(
                buttonContainer,
                // Button configuration (customize as needed)
                { theme: "outline", size: "large", type: "standard", shape: "rectangular", text: "signin_with", logo_alignment: "left", width: "250" }
            );
            console.log("Google Sign-In button rendered.");
        } else {
            console.warn("renderGoogleSignInButton: Google library not ready yet.");
            // Keep the "Loading..." text or show an error state
            buttonContainer.innerHTML = '<span style="color: var(--ios-dark-gray); font-size: 14px;">Sign-In Loading...</span>';
        }
    } catch (error) {
        console.error("Error rendering Google Sign-In button:", error);
        buttonContainer.innerHTML = '<span style="color: var(--ios-red); font-size: 14px;">Sign-In Button Error</span>';
    }
}

/**
 * Navigates to the group list view by fetching groups and rendering the list.
 * Assumes user is already authenticated.
 */
async function navigateToGroupList() {
    // Safety check, although router should handle this
    if (!checkAuthState()) {
        console.warn("navigateToGroupList called without authentication. Redirecting to login.");
        return redirectToLogin();
    }

    showLoading('Loading your groups...'); // Show specific loading message
    try {
        // Fetch groups using the API function (which sends the stored token)
        const groups = await apiGetGroups(); // Assumes apiGetGroups is defined in api.js
        renderGroupList(groups); // Render the list with fetched data
    } catch (error) {
        // Handle errors during group fetching
        console.error("Failed to load groups:", error);
        alert(`Error loading groups: ${error.message}. Please try again.`);
        // Critical failure loading groups might warrant logging out
        handleLogout();
    }
    // Note: hideLoading() is called within renderGroupList upon completion
}

/**
 * Renders the group list UI into the app container.
 * Includes error handling for adding event listeners.
 * Hides the main loading indicator when rendering is complete.
 * @param {Array<Object>} groups Array of group objects { id, name }.
 */
// js/auth.js

// ... (other functions like checkAuthState, navigateToGroupList etc. should be present) ...

/**
 * Renders the group list UI into the app container.
 * Includes error handling for adding event listeners.
 * Hides the main loading indicator when rendering is complete.
 * @param {Array<Object>} groups Array of group objects { id, name }.
 */
function renderGroupList(groups) {
    console.log("Rendering group list with data:", groups);
    const appContainer = document.getElementById('app-container');
    if (!appContainer) { console.error("renderGroupList: appContainer not found!"); hideLoading(); return; }

    let groupListHTML = '<ul class="ios-list">';
    // Build group list items HTML
    if (groups && groups.length > 0) {
        groups.forEach(group => {
            // Use backticks for the template literal string
            groupListHTML += `
                <li class="ios-list-item group-list-entry" data-group-id="${group.id}" style="cursor: pointer;">
                    <img src="assets/img/placeholder-pfp.svg" class="pfp" alt="Group Icon">
                    <div class="content">
                        <div class="title">${group.name || 'Unnamed Group'}</div>
                    </div>
                    <div class="accessory disclosure"></div>
                </li>
            `;
        });
    } else {
        // Provide feedback when no groups are joined
        groupListHTML += `<li class="ios-list-item"><div class="content" style="text-align: center; color: var(--ios-dark-gray); padding: 20px 15px;">No groups joined yet. Create one below or join using a code!</div></li>`;
    }
    groupListHTML += '</ul>';

    // --- CORRECTED innerHTML assignment ---
    // Set the container's HTML, ensuring all expected elements (including logout-btn) are present.
    appContainer.innerHTML = `
        <div class="ios-header">
            <div class="title">Your Groups</div>
            <div class="right-action">
                 <!-- ** THE MISSING BUTTON ** -->
                 <button id="logout-btn" style="color: var(--ios-red); font-weight: 500; font-size: 16px; padding: 5px;">Logout</button>
                 <!-- ** END MISSING BUTTON ** -->
            </div>
        </div>
        <div class="group-list-container content-area">
             ${groupListHTML}
             <hr style="border: none; border-top: 1px solid var(--separator-color); margin: 20px 0;">
             <div class="join-group-section" style="padding: 0 15px;">
                 <input type="text" id="join-code-input-list" placeholder="Enter Group Code" style="margin-bottom: 10px;">
                 <button id="join-group-btn-list" class="ios-button-primary" style="width: 100%;">Join Group</button>
             </div>
              <button id="create-group-btn" style="margin-top: 20px; display: block; margin-left: auto; margin-right: auto; padding: 8px 15px;">+ Create New Group</button>
        </div>
    `;
    // --- END CORRECTED innerHTML assignment ---


    console.log("renderGroupList: HTML updated. Adding event listeners...");

    // --- Add Event Listeners with Null Checks (Keep these as they are) ---
    try { // Group List Items
        appContainer.querySelectorAll('.group-list-entry').forEach(item => {
            if (item) item.addEventListener('click', () => { window.location.hash = `#group/${item.dataset.groupId}`; });
            else console.warn("renderGroupList: Found null item in querySelectorAll('.group-list-entry')");
        });
    } catch (e) { console.error("Error adding listener to group list entries:", e); }

    try { // Join Button
        const joinButton = document.getElementById('join-group-btn-list');
        if (joinButton) {
            joinButton.addEventListener('click', () => {
                const codeInput = document.getElementById('join-code-input-list');
                if (codeInput) handleJoinGroupWithInput(codeInput);
                else console.error("renderGroupList: Could not find code input 'join-code-input-list'.");
            });
            console.log("renderGroupList: Added listener to join-group-btn-list.");
        } else { console.error("renderGroupList Error: Could not find element with ID 'join-group-btn-list'."); }
    } catch (e) { console.error("Error adding listener to join button:", e); }

    try { // Create Button
        const createButton = document.getElementById('create-group-btn');
        if (createButton) { createButton.addEventListener('click', handleCreateGroup); console.log("renderGroupList: Added listener to create-group-btn."); }
        else { console.error("renderGroupList Error: Could not find element with ID 'create-group-btn'."); }
    } catch (e) { console.error("Error adding listener to create button:", e); }

    // This listener should now find the button
    try { // Logout Button
        const logoutButton = document.getElementById('logout-btn');
        if (logoutButton) { // Check if the button was found
            logoutButton.addEventListener('click', handleLogout);
            console.log("renderGroupList: Added listener to logout-btn.");
        } else {
            // This error should no longer appear if the innerHTML is correct
            console.error("renderGroupList Error: Could not find element with ID 'logout-btn' AFTER setting innerHTML.");
        }
    } catch (e) {
        console.error("Error adding listener to logout button:", e);
    }


    hideLoading(); // Hide loading indicator *after* UI is rendered and listeners attached
    console.log("renderGroupList: Finished rendering and adding listeners.");
}

// Ensure other functions like hideLoading, handleJoinGroupWithInput, handleCreateGroup, handleLogout
// are defined correctly elsewhere in auth.js or related files.

// --- Other Authenticated Actions (handleJoin*, handleCreate*) ---
// These functions should check authentication status at the beginning.

/** Handles joining group using code from an input element. Requires auth. */
async function handleJoinGroupWithInput(codeInputElement) {
    if (!checkAuthState()) {
        alert("Please sign in to join a group.");
        return redirectToLogin(); // Redirect if not logged in
    }
    const code = codeInputElement.value.trim().toUpperCase();
    if (!code) { alert("Please enter a group code."); return; }
    showLoading('Joining group...');
    try {
        const result = await apiJoinGroup(code); // Assumes apiJoinGroup is defined in api.js
        if (result && result.groupId) {
            alert(`Successfully joined group!`);
            codeInputElement.value = '';
            window.location.hash = `#group/${result.groupId}`; // Navigate via router
        } else { alert(result.message || "Failed to join group."); }
    } catch (error) { console.error("Join group failed:", error); /* alert shown by callApi */ }
    finally { hideLoading(); }
}

/** Handles joining group from the main login screen button. Requires auth. */
async function handleJoinGroup() {
    if (!checkAuthState()) {
        alert("Please sign in to join a group.");
        return; // Don't redirect from login screen, just inform
    }
    const codeInput = document.getElementById('join-code-input');
    if (codeInput) {
        handleJoinGroupWithInput(codeInput); // Reuse logic
    } else {
        console.error("handleJoinGroup: Could not find #join-code-input");
    }
}

/** Handles creating a new group. Requires auth. */
async function handleCreateGroup() {
    if (!checkAuthState()) {
        alert("Please sign in to create a group.");
        return redirectToLogin();
    }
    const groupName = prompt("Enter a name for your new group:");
    if (!groupName || groupName.trim() === '') { alert("Group name cannot be empty."); return; }
    showLoading('Creating group...');
    try {
        const result = await apiCreateGroup(groupName.trim()); // Assumes apiCreateGroup is defined in api.js
        if (result && result.groupId) {
            alert(`Group "${groupName}" created! Code: ${result.code || 'N/A'}`);
            navigateToGroupList(); // Refresh the list
        } else { alert(result.message || "Failed to create group."); }
    } catch (error) { console.error("Create group failed:", error); /* alert shown by callApi */ }
    finally { hideLoading(); }
}

/** Handles joining a group via URL hash parameter. Called by router. Assumes auth check done by router. */
async function handleJoinViaUrl(code) {
    console.log(`handleJoinViaUrl attempting to join with code: ${code}`);
    showLoading('Joining group via URL...');
    try {
        const result = await apiJoinGroup(code.toUpperCase());
        if (result && result.groupId) {
            console.log("Join via URL successful, navigating to group.");
            window.location.hash = `#group/${result.groupId}`; // Navigate to group
        } else {
            alert(result.message || `Failed to join group with code ${code}. You might already be a member.`);
            window.location.hash = ''; // Go back to default view (group list)
            // Need to explicitly call router if just clearing hash doesn't trigger it reliably
            // router();
        }
    } catch (e) {
        console.error("Join via URL failed:", e);
        alert(`Failed to join group using the provided link/code.`);
        window.location.hash = '';
        // router(); // Go back to default view
    }
    finally {
        // Do not hide loading here, navigation or router call should handle it
    }
}


// --- Logout Function ---
/**
 * Clears user state, removes token from localStorage, disables Google auto-select,
 * and renders the login screen.
 */
function handleLogout() {
    console.log("handleLogout called.");
    const wasLoggedIn = !!currentUser;
    currentUser = null; // Clear in-memory user object
    localStorage.removeItem(ID_TOKEN_STORAGE_KEY); // Clear token from storage

    // Disable Google's automatic sign-in for the next visit
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        try { // Add try/catch around Google calls
            google.accounts.id.disableAutoSelect();
            console.log("Google auto sign-in disabled.");
        } catch (e) {
            console.error("Error disabling Google auto select:", e);
        }
    }

    if (wasLoggedIn) {
        // alert("You have been logged out."); // Optional: User feedback
    }
    renderLoginScreen(); // Immediately render the login screen
}

// --- Utility Functions ---
/**
 * Utility function to navigate to the login screen, typically by changing hash.
 */
function redirectToLogin() {
    console.log("Redirecting to login via hash change...");
    // Setting hash to # should trigger router, which calls checkAuth, finds no user, and calls renderLoginScreen
    window.location.hash = '#';
    // If hash change doesn't reliably trigger router quickly enough, call renderLoginScreen directly:
    // renderLoginScreen();
}
