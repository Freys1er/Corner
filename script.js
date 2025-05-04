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
// Place these functions in a relevant JS file, like script.js or a dedicated utils.js

// Store reference to the currently active escape key listener
let currentEscapeKeyListener = null;
// Store reference to the element that had focus before modal opened
let previouslyFocusedElement = null;

/**
 * Displays a modal dialog overlaying the page content.
 * Removes any existing modal before showing the new one.
 *
 * @param {string} contentHTML The HTML string to be placed inside the modal's content area.
 *                             This HTML should typically include elements for interaction and closing (e.g., buttons with IDs/classes).
 * @param {boolean} [closeOnBackdropClick=true] Whether clicking the semi-transparent backdrop should close the modal.
 */
function showModal(contentHTML, closeOnBackdropClick = true) {
    console.log("Showing modal...");
    // 0. Store the currently focused element before showing the modal
    previouslyFocusedElement = document.activeElement;

    // 1. Remove any existing modal first to prevent duplicates
    hideModal(); // Ensures cleanup and resets listeners/styles

    // 2. Create backdrop element
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop'; // Use class from style.css
    backdrop.id = 'modal-backdrop';       // Use ID for easy removal and targeting

    // 3. Create content container element
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content'; // Use class from style.css
    // Make modal content focusable and announce it as a dialog
    modalContent.setAttribute('role', 'dialog');
    modalContent.setAttribute('aria-modal', 'true');
    // Optionally add aria-labelledby/aria-describedby if your contentHTML has title/description elements with IDs

    // 4. Inject the provided HTML content
    // WARNING: Assumes contentHTML is trusted internal HTML.
    // If contentHTML comes from user input or external sources,
    // it MUST be sanitized first to prevent XSS attacks.
    modalContent.innerHTML = contentHTML;

    // 5. Assemble the modal structure
    backdrop.appendChild(modalContent);

    // 6. Add event listener for closing via backdrop click (if enabled)
    if (closeOnBackdropClick) {
        backdrop.addEventListener('click', (event) => {
            // Only hide if the click is directly on the backdrop itself,
            // not on the modal content area or elements within it.
            if (event.target === backdrop) {
                hideModal();
            }
        });
    }

    // 7. Add listener for closing via Escape key (Good for accessibility)
    // Define the listener function
    currentEscapeKeyListener = (event) => {
        if (event.key === 'Escape') {
            console.log("Escape key pressed, hiding modal.");
            hideModal();
        }
    };
    // Attach listener to the document (listens globally)
    document.addEventListener('keydown', currentEscapeKeyListener);

    // 8. Append the modal to the body (so it overlays everything)
    document.body.appendChild(backdrop);

    // 9. Prevent background scrolling while modal is open (Good UX)
    document.body.style.overflow = 'hidden';

    // 10. Accessibility: Focus management
    // Try focusing the first focusable element within the modal content
    // Common focusable elements include buttons, links, inputs, selects, textareas
    const firstFocusable = modalContent.querySelector(
        'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (firstFocusable) {
        firstFocusable.focus(); // Focus the first interactive element
    } else {
        // If no interactive element, make the content container itself focusable
        // and focus it (useful for modals with just text content)
        modalContent.setAttribute('tabindex', "-1");
        modalContent.focus();
    }
    console.log("Modal shown.");
}

/**
 * Finds and removes the currently displayed modal dialog from the DOM.
 * Restores background scrolling and focus.
 */
function hideModal() {
    // 1. Find the backdrop element by its ID
    const backdrop = document.getElementById('modal-backdrop');

    // 2. If the backdrop exists, proceed with removal and cleanup
    if (backdrop) {
        console.log("Hiding modal...");
        // Remove the Escape key listener previously added
        if (currentEscapeKeyListener) {
            document.removeEventListener('keydown', currentEscapeKeyListener);
            currentEscapeKeyListener = null; // Clear the reference
            console.log("Escape key listener removed.");
        }

        // Remove the backdrop element (which contains the modal content) from the DOM
        backdrop.remove();

        // 3. Restore background scrolling
        document.body.style.overflow = ''; // Reset to default browser handling

        // 4. Restore focus to the element that had focus before the modal opened (Accessibility)
        if (previouslyFocusedElement) {
            console.log("Restoring focus to:", previouslyFocusedElement);
            try { // Add try/catch as the element might have become non-focusable
                previouslyFocusedElement.focus();
            } catch (e) {
                console.warn("Could not restore focus to previous element:", e);
            }

            previouslyFocusedElement = null; // Clear the reference
        } else {
            // Fallback: focus the body if we don't know what was focused before
            document.body.focus();
        }

        console.log("Modal hidden and cleanup complete.");
    } else {
        // If no backdrop is found, it means no modal is currently shown.
        // Ensure scrolling is reset just in case.
        if (document.body.style.overflow === 'hidden') {
            console.log("hideModal called but no modal found, ensuring body overflow is reset.");
            document.body.style.overflow = '';
        }
        // Clear any stray listener references
        if (currentEscapeKeyListener) {
            document.removeEventListener('keydown', currentEscapeKeyListener);
            currentEscapeKeyListener = null;
        }
        previouslyFocusedElement = null;
    }
}