// js/api.js (Revised callApi for clarity and robustness)

const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbycEC2HuwdMMn7lKcJZyPPgkv4p2lX2PQtogifFNBjKfRihxL2soraapqNoTTlOuuk0Gw/exec';
//const ID_TOKEN_STORAGE_KEY = 'cornerAppIdToken_LS';

async function callApi(params) {
    console.log("callApi called with params:", params);
    // 1. Basic Checks & Copy
    if (API_ENDPOINT.includes('PASTE_YOUR_DEPLOYMENT_URL_HERE')) { /* Error */ throw new Error("API_ENDPOINT not configured."); }
    const outgoingParams = { ...params }; // Defensive copy

    // 2. Handle Authentication Token
    const storedToken = localStorage.getItem(ID_TOKEN_STORAGE_KEY);
    if (outgoingParams.action !== 'verifyToken') {
        if (storedToken) {
            outgoingParams.id_token = storedToken;
        } else {
            console.error(`Action '${outgoingParams.action}' requires auth, token missing.`);
            if (typeof handleLogout === 'function') handleLogout(); else window.location.hash = '';
            throw new Error("Authentication token not found. Please log in.");
        }
    }
    if (!outgoingParams.action) { /* Error */ throw new Error("Internal error: API action not specified."); }

    // 3. Prepare URL Search Parameters (using URLSearchParams for auto-encoding)
    const searchParams = new URLSearchParams();
    Object.keys(outgoingParams).forEach(key => {
        let value = outgoingParams[key];
        if (value !== null && value !== undefined) {
            // Stringify complex types before appending
            if (typeof value === 'object') { // Arrays are typeof 'object' too
                try {
                    value = JSON.stringify(value); // Stringify arrays/objects
                } catch (e) {
                    console.error(`Failed to stringify parameter '${key}':`, value, e);
                    return; // Skip this parameter
                }
            }
            // URLSearchParams automatically handles URL encoding
            searchParams.append(key, value);
        }
    });

    // 4. Construct Final URL
    const finalUrl = `${API_ENDPOINT}?${searchParams.toString()}`;
    console.log("Calling API Action:", outgoingParams.action);
    // console.log("Final URL:", finalUrl); // Avoid logging token in production if possible

    // 5. Fetch and Handle Response (Same error handling as before)
    try {
        // *** Still using GET method ***
        const response = await fetch(finalUrl, { method: 'GET', redirect: 'follow' });

        let forceLogout = false;
        if (response.status === 401) { console.warn("API 401"); forceLogout = true; }
        const responseText = await response.text();
        if (!response.ok && !forceLogout) { throw new Error(`API Error: Status ${response.status}. Body: ${responseText}`); }
        let data = {};
        try { data = JSON.parse(responseText); }
        catch (e) {
            if (!response.ok && !forceLogout) { throw new Error(`API Error: Status ${response.status}. Non-JSON Body: ${responseText}`); }
            console.error("Failed to parse JSON response:", responseText); throw new Error("Failed to parse server response.");
        }
        if (data.error) {
            if (data.error.includes("Authentication failed") || data.error.includes("token missing") || data.error.includes("expired token") || data.error.includes("Invalid token")) {
                console.warn("Backend token error:", data.error); forceLogout = true;
            } else { throw new Error(`API Error: ${data.error}`); }
        }
        if (forceLogout) {
            if (typeof handleLogout === 'function') handleLogout(); else window.location.hash = '';
            throw new Error("Your session is invalid. Please log in again.");
        }

        console.log(data);
        return data.result;
    } catch (error) {
        console.error('API Call Failed:', error);
        if (error.message !== "Your session is invalid. Please log in again." &&
            error.message !== "Authentication token not found. Please log in.") {
            //alert(`Operation failed: ${error.message}`);
        }
        throw error;
    }
}
// --- API Action Functions ---

// Authentication / Group Management
function apiCheckLoginStatus() {
    // This is tricky with just doGet. Need a way to identify the user.
    // Google Sign-In library usually manages this client-side.
    // The backend doGet would need access to the user's identity, maybe via ScriptApp.getIdentityToken() if called via fetch authenticated with Google.
    // For now, we'll simulate it.
    console.warn("apiCheckLoginStatus: Requires proper Google Auth integration.");
    return Promise.resolve({ loggedIn: false, user: null }); // Simulate logged out
    // return Promise.resolve({ loggedIn: true, user: { id: '123', name: 'Test User', pfp: 'assets/img/placeholder-pfp.svg' } }); // Simulate logged in
}

function apiGetGroups() {
    // The backend identifies the user via the ID token sent by callApi
    // console.warn("apiGetGroups: Making actual API call."); // Optional: Change warn to log for debugging
    return callApi({ action: 'getGroups' }); // Make the actual API call
    // No longer returning simulated data:
    // return Promise.resolve([
    //     { id: 'grp_abc', name: 'Weekend Warriors' },
    //     { id: 'grp_def', name: 'Project Squad' }
    // ]);
}

function apiCreateGroup(groupName) {
    console.warn("apiCreateGroup: Requires user identification on backend.");
    return callApi({ action: 'createGroup', name: groupName }); // Needs encoding?
}

function apiJoinGroup(groupCode) {
    console.warn("apiJoinGroup: Requires user identification on backend.");
    return callApi({ action: 'joinGroup', code: groupCode });
}

function apiGetGroupDetails(groupId) {
    return callApi({ action: 'getGroupDetails', groupId: groupId });
    // Should return { name: '...', code: '...', members: [...] }
}

function apiResetGroupCode(groupId) {
    return callApi({ action: 'resetGroupCode', groupId: groupId });
}

// Chat
function apiGetChatMessages(groupId, sinceTimestamp = null) {
    const params = { action: 'getChat', groupId: groupId };
    if (sinceTimestamp) {
        params.since = sinceTimestamp;
    }
    return callApi(params);
    // Should return array of messages: { id, userId, userName, userPfp, text, timestamp, type: 'user'/'system' }
}

function apiSendMessage(groupId, messageText) {
    // User identity needs to be associated server-side via Google Auth context
    console.warn("apiSendMessage: Requires user identification on backend.");
    return callApi({
        action: 'sendMessage',
        groupId: groupId,
        message: encodeURIComponent(messageText) // Encode message for URL
    });
}

// Voting
function apiGetPolls(groupId) {
    return callApi({ action: 'getPolls', groupId: groupId });
    // Returns array: { id, title, options: [{id, text}], userVote: optionId | null }
}


function apiCreatePoll(groupId, title, options) {
    // Log the raw input received from the frontend logic (e.g., voting.js)
    console.log("apiCreatePoll called with:", { groupId, title, options });

    // --- Frontend Input Validation ---
    // Catch basic errors before attempting the API call.
    if (!groupId || typeof groupId !== 'string' || groupId.trim() === '') {
        console.error("apiCreatePoll Error: Invalid or missing groupId.");
        // Return a rejected promise to indicate failure to the caller
        return Promise.reject(new Error("Invalid or missing Group ID provided."));
    }
    if (!title || typeof title !== 'string' || title.trim() === '') {
        console.error("apiCreatePoll Error: Invalid or missing title.");
        return Promise.reject(new Error("Invalid or missing poll title provided."));
    }
    if (!Array.isArray(options) || options.length < 2) {
        console.error("apiCreatePoll Error: Invalid or insufficient options provided (requires array with at least 2 elements).");
        return Promise.reject(new Error("Invalid or insufficient poll options provided (requires at least 2)."));
    }
    // Optional: Add check to ensure all options are strings?
    if (!options.every(opt => typeof opt === 'string')) {
        console.warn("apiCreatePoll Warning: Not all options are strings. Attempting conversion.");
        // Attempt basic conversion, backend handleCreatePoll also cleans this
        options = options.map(opt => String(opt));
    }


    // --- Prepare Parameters for callApi ---
    // Create the parameter object. Pass the raw title string and the raw options array.
    // The modified `callApi` function will handle stringifying the 'options' array
    // and URL-encoding both 'title' and the stringified 'options'.
    const params = {
        action: 'createPoll', // The specific backend action to trigger
        groupId: groupId,
        title: title,       // Pass the raw title string
        options: options    // Pass the raw JavaScript options array
    };

    // --- Make the API Call ---
    // callApi will add the id_token, stringify/encode params, make the fetch, handle errors.
    // No need for try/catch here unless there were complex preparations *before* callApi.
    console.log("apiCreatePoll: Calling callApi with params:", params);
    return callApi(params);
}
function apiDeletePoll(groupId, pollId) {
    // callApi handles adding auth token and encoding automatically
    return callApi({
        action: 'deletePoll', // New action name
        groupId: groupId,
        pollId: pollId
    });
}


// Voting.gs

/**
 * Handles the 'createPoll' action. Creates a poll and its options.
 * Expects title to be URL-decoded string, and options to be a URL-decoded JSON array string.
 * @param {Object} params Parameters { groupId: string, title: string, options: string (JSON array string) }
 * @param {string} userEmail Requesting user's email.
 * @return {Object} The new poll object.
 * @throws {Error} If parameters are invalid, user is not authorized, or parsing fails.
 */
function handleCreatePoll(params, userEmail) {
    const groupId = params.groupId;
    let title = null;
    let optionsArray = null;

    // --- 1. Decode and Validate Input Parameters ---
    // NOTE: Assuming a general decoding loop in Code.gs handles basic URL decoding.
    // If not, you would add decodeURIComponent here. Let's assume Code.gs decodes.
    try {
        // Validate Title (already decoded by Code.gs or passed directly if no encoding needed)
        title = params.title ? String(params.title).trim() : null;
        if (!title) throw new Error("Title parameter is missing or empty.");

        // Parse Options JSON String (already decoded by Code.gs)
        if (!params.options) throw new Error("Missing options parameter.");
        const optionsJsonString = params.options; // Should be the decoded JSON string now
        Logger.log(`handleCreatePoll: Received options string for parsing: ${optionsJsonString}`);

        optionsArray = JSON.parse(optionsJsonString); // Parse the JSON string

        if (!Array.isArray(optionsArray) || optionsArray.length < 2) {
            throw new Error("Options parameter must be a JSON array string with at least two elements.");
        }
        // Clean and validate options
        optionsArray = optionsArray.map(opt => String(opt).trim()).filter(opt => opt !== '');
        if (optionsArray.length < 2) {
            throw new Error("Need at least two non-empty options after trimming.");
        }

    } catch (e) {
        Logger.log(`Error parsing poll parameters. Raw Title: ${params.title}, Raw Options: ${params.options}. Error: ${e}`);
        if (e.message.includes("JSON")) {
            throw new Error("Invalid JSON format for options parameter.");
        } else {
            throw new Error(`Parameter validation failed: ${e.message}`);
        }
    }

    // --- 2. Authorization Check ---
    if (!groupId) { throw new Error("Missing groupId parameter."); }
    if (!isUserMemberOfGroup(userEmail, groupId)) { throw new Error("Access denied."); }

    // --- 3. Proceed with Creating Poll ---
    const pollsSheet = getPollsSheet();
    const optionsSheet = getPollOptionsSheet();
    const pollId = generateUniqueId('pol_');
    const timestamp = Date.now();

    appendRowData(pollsSheet, [pollId, groupId, title, timestamp]); // Use validated title

    const createdOptions = optionsArray.map(optionText => {
        const optionId = generateUniqueId('opt_');
        appendRowData(optionsSheet, [optionId, pollId, optionText]);
        return { id: optionId, text: optionText };
    });

    if (createdOptions.length < 2) {
        Logger.log(`Warning: Poll ${pollId} ended up with fewer than 2 valid options.`);
    }

    Logger.log(`Poll created by ${userEmail} in group ${groupId}: ${title}`);

    // --- 4. Return Result ---
    return {
        id: pollId,
        title: title,
        options: createdOptions,
        userVote: null
    };
}
// Ensure the rest of api.js (callApi, other API functions) is also present.

function apiCastVote(groupId, pollId, optionId) {
    return callApi({ action: 'castVote', groupId: groupId, pollId: pollId, option: optionId });
}

function apiGetPollInfo(groupId, pollId) {
    return callApi({ action: 'getPollInfo', groupId: groupId, pollId: pollId });
    // Returns { stats: { optionId: count, ... }, comments: [...] } (comments TBD)
}


// Activities
function apiGetActivities(groupId) {
    return callApi({ action: 'getActivities', groupId: groupId });
    // Returns array: { id, title, /* maybe short desc/date */ }
}

function apiGetActivityDetail(groupId, activityId) {
    return callApi({ action: 'getActivityDetail', groupId: groupId, activityId: activityId });
    // Returns { id, title, description, materials, time, teams: { 'team1': [memberId1, ...], ... }, members: { memberId: {name, pfp}, ...} }
}

function apiUpdateActivityDetail(groupId, activityId, field, value) {
    // User identity associated server-side
    console.warn("apiUpdateActivityDetail: Requires user identification on backend.");
    return callApi({
        action: 'updateActivityDetail',
        groupId: groupId,
        activityId: activityId,
        field: field, // 'materials' or 'time'
        value: value
    });
    // Backend should also trigger system message in chat
}

function apiUpdateTeams(groupId, activityId, change) { // change = '+1' or '-1'
    console.warn("apiUpdateTeams: Requires user identification on backend.");
    return callApi({
        action: 'updateTeams',
        groupId: groupId,
        activityId: activityId,
        change: change
    });
}

function apiAssignTeamMember(groupId, activityId, memberId, teamId) {
    console.warn("apiAssignTeamMember: Requires user identification on backend.");
    return callApi({
        action: 'assignTeamMember',
        groupId: groupId,
        activityId: activityId,
        memberId: memberId,
        teamId: teamId // 'team1', 'team2' etc. or 'unassigned'
    });
}

function apiVerifyGoogleToken(idToken) {
    // callApi will NOT add the token from storage for this specific action
    return callApi({
        action: 'verifyToken',
        id_token: idToken // Pass the fresh token explicitly
    });
}

function apiCreateActivity(groupId, title, description = '') {
    // callApi handles stringify/encoding
    return callApi({
        action: 'createActivity',
        groupId: groupId,
        title: title,
        description: description
        // Add other fields like materials, time if needed
    });
}

function apiDeleteActivity(groupId, activityId) {
    return callApi({
        action: 'deleteActivity', // New action name
        groupId: groupId,
        activityId: activityId
    });
}