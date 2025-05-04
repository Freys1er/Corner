async function loadVotingTab(groupId, containerElement) {
    try {
        const response = await fetch('pages/voting-tab.html');
        if (!response.ok) throw new Error('Failed to load voting tab HTML');
        const votingHTML = await response.text();
        containerElement.innerHTML = votingHTML;

        // Add event listener for the FAB (+) button
        document.getElementById('fab-add-btn').addEventListener('click', () => showCreatePollModal(groupId));

        // Load existing polls
        await fetchAndRenderPolls(groupId);

    } catch (error) {
        console.error("Error loading voting tab:", error);
        containerElement.innerHTML = `<p class="error">Failed to load voting: ${error.message}</p>`;
    } finally {
        hideLoading();
    }
}

async function fetchAndRenderPolls(groupId) {
    const pollListContainer = document.getElementById('poll-list-container');
    pollListContainer.innerHTML = '<div class="loading-spinner small">Loading polls...</div>'; // Temporary loading

    try {
        const polls = await apiGetPolls(groupId);

        if (!polls || polls.length === 0) {
            pollListContainer.innerHTML = '<p style="text-align: center; color: var(--ios-dark-gray); padding: 20px;">No polls created yet.</p>';
            return;
        }

        let pollsHTML = '<div class="poll-list">'; // Use the list container
        polls.forEach(poll => {
            pollsHTML += renderPollItem(poll, groupId);
        });
        pollsHTML += '</div>';
        pollListContainer.innerHTML = pollsHTML;

        // Add event listeners after rendering
        addPollEventListeners(groupId);

    } catch (error) {
        console.error("Failed to fetch polls:", error);
        pollListContainer.innerHTML = `<p class="error">Failed to load polls: ${error.message}</p>`;
    }
}

// js/voting.js

// Assume other functions like loadVotingTab, fetchAndRenderPolls, addPollEventListeners, handleVote etc. exist

/**
 * Renders the HTML for a single poll item, including options with vote counts and percentage bars.
 *
 * @param {object} poll - The poll data object received from the backend, expected to contain:
 *   {
 *     id: string,
 *     title: string,
 *     options: Array<{ id: string, text: string, voteCount: number }>,
 *     userVote: string | null,
 *     totalVotes: number
 *   }
 * @param {string} groupId - The ID of the current group (needed for potential actions).
 * @returns {string} The HTML string for the poll item.
 */
function renderPollItem(poll, groupId) {
    console.log("Rendering poll item:", poll); // Log the data being rendered
    let optionsHTML = '<div class="poll-options">';

    poll.options.forEach(option => {
        const voteCount = option.voteCount || 0; // Default to 0 if missing
        const totalVotes = poll.totalVotes || 0;  // Default to 0 if missing

        // Calculate percentage, handle division by zero
        const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
        // Round percentage for display/styling if desired, e.g., percentage.toFixed(1)

        const isSelected = poll.userVote === option.id;

        // Define background style using CSS variables for easier customization
        // Note: Use percentage% directly in the gradient definition.
        const backgroundStyle = `background: linear-gradient(to right, var(--ios-blue-lighter, #a0cfff) ${percentage}%, var(--ios-option-bg, #f0f0f0) ${percentage}%);`;

        // Class for user's selection
        const selectedClass = isSelected ? 'selected' : '';

        // Add vote count to the text
        const optionTextWithCount = `${option.text} (${voteCount})`;

        optionsHTML += `
            <button
                class="poll-option-btn ${selectedClass}"
                data-poll-id="${poll.id}"
                data-option-id="${option.id}"
                style="${backgroundStyle}"
                aria-label="${option.text}, ${voteCount} votes${isSelected ? ', selected' : ''}"
                >
                <span class="poll-option-text-overlay">${optionTextWithCount}</span>
                ${isSelected ? '<span class="checkmark-overlay">✔</span>' : ''}
            </button>
        `;
        // Note: Using spans inside the button allows text to overlay the background gradient.
        //       The checkmark is also an overlay span.
    });
    optionsHTML += '</div>';

    // Main poll item structure
    return `
        <div class="poll-item" data-poll-id="${poll.id}">
            <h3>${poll.title}</h3>
            ${optionsHTML}
            <div class="poll-actions">
                <button class="info-button" data-poll-id="${poll.id}" aria-label="Poll Information">
                    <img src="assets/img/icon-info.svg" alt="Info">
                </button>
                <!-- Add other actions like delete poll if needed -->
            </div>
        </div>
    `;
}

function addPollEventListeners(groupId) {
    document.querySelectorAll('.poll-option-btn').forEach(button => {
        button.addEventListener('click', handleVote);
    });
    document.querySelectorAll('.info-button').forEach(button => {
        button.addEventListener('click', handleShowPollInfo);
    });
}

async function handleVote(event) {
    const button = event.currentTarget;
    const pollId = button.dataset.pollId;
    const optionId = button.dataset.optionId;
    const pollItemElement = button.closest('.poll-item');

    // Disable buttons within this poll during voting
    pollItemElement.querySelectorAll('.poll-option-btn').forEach(btn => btn.disabled = true);

    try {
        await apiCastVote(currentGroupId, pollId, optionId);

        // Update UI: Deselect others, select this one
        pollItemElement.querySelectorAll('.poll-option-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.optionId === optionId);
        });

    } catch (error) {
        console.error("Voting failed:", error);
        alert("Failed to record vote.");
    } finally {
        // Re-enable buttons
        pollItemElement.querySelectorAll('.poll-option-btn').forEach(btn => btn.disabled = false);
    }
}

// Ensure handleDeletePoll is added to the switch statement in Code.gs

function showCreatePollModal(groupId) {
    console.log("Create Poll Button clicked for: " + groupId)
    let modalHTML = `
        <h2>Create New Poll</h2>
        <div class="form-group">
            <label for="poll-title-input">Poll Title:</label>
            <input type="text" id="poll-title-input" placeholder="What are we deciding?">
        </div>
        <div class="form-group">
            <label>Options:</label>
            <div id="poll-options-container">
                <div class="poll-option-entry">
                    <input type="text" placeholder="Option 1">
                </div>
                <div class="poll-option-entry">
                    <input type="text" placeholder="Option 2">
                </div>
            </div>
            <button id="add-poll-option-btn" class="small-text-button">+ Add Option</button>
        </div>
        <div class="modal-actions">
            <button id="cancel-create-poll">Cancel</button>
            <button id="submit-create-poll" class="ios-button-primary">Create</button>
        </div>
        <style> /* Simple styles for form elements inside modal */
            .form-group { margin-bottom: 15px; }
            .form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
            .form-group input[type="text"] { width: calc(100% - 22px); padding: 10px; border: 1px solid var(--ios-mid-gray); border-radius: 6px; font-size: 16px; }
            #poll-options-container .poll-option-entry { margin-bottom: 8px; }
            .small-text-button { font-size: 14px; padding: 4px 8px; }
        </style>
    `;

    showModal(modalHTML);

    document.getElementById('add-poll-option-btn').addEventListener('click', addPollOptionInput);
    document.getElementById('cancel-create-poll').addEventListener('click', hideModal);
    document.getElementById('submit-create-poll').addEventListener('click', () => handleSubmitPoll(groupId));
}

async function handleShowPollInfo(event) {
    const pollId = event.currentTarget.dataset.pollId;
    const pollItemElement = event.currentTarget.closest('.poll-item');
    const pollTitle = pollItemElement ? (pollItemElement.querySelector('h3')?.textContent || `Poll ID ${pollId}`) : `Poll ID ${pollId}`;

    console.log(`Showing info for Poll ID: ${pollId}, Title: "${pollTitle}"`);

    // Show a basic loading modal immediately
    showModal(`<h2>Loading Poll Info...</h2><div class="loading-spinner small"></div>`);

    try {
        // Fetch statistics from the backend
        // This now needs to return both stats AND the original option texts
        // Let's assume apiGetPollInfo is modified or we fetch poll details again
        // Option A: Modify apiGetPollInfo backend to return options text too { stats: {...}, options: [{id, text}, ...] }
        // Option B (Simpler for now): Get stats, then re-use existing poll data from frontend if possible
        const pollInfo = await apiGetPollInfo(currentGroupId, pollId); // Returns { stats: {optId: count} }

        // We need the option text. Find the original poll data rendered on the page
        // NOTE: This relies on the poll data being present in the DOM. A more robust
        // way might be to fetch full poll details again or have apiGetPollInfo return text.
        const optionsData = [];
        pollItemElement.querySelectorAll('.poll-option-btn').forEach(btn => {
             // Extract text before the vote count parenthesis
             const fullText = btn.querySelector('.poll-option-text-overlay')?.textContent || '';
             const textMatch = fullText.match(/^(.*)\s\(\d+\)$/); // Match text before " (count)"
             optionsData.push({
                 id: btn.dataset.optionId,
                 text: textMatch ? textMatch[1] : fullText // Extract text part
             });
        });


        if (!pollInfo || !pollInfo.stats) {
             throw new Error("Received invalid data from API.");
        }

        let statsHTML = '<p>No votes recorded yet.</p>';
        const voteStats = pollInfo.stats;
        const totalVotes = Object.values(voteStats).reduce((sum, count) => sum + count, 0);

        if (totalVotes > 0) {
            statsHTML = '<ul class="poll-stats-list">'; // Use a list for stats
            optionsData.forEach(option => {
                const count = voteStats[option.id] || 0;
                const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0;
                // Simple list display: Text: Count (Percentage%)
                statsHTML += `<li>${option.text || 'Unknown Option'}: ${count} vote(s) (${percentage}%)</li>`;
                // Optional: Add a visual bar here too if desired
                // statsHTML += `<div class="stat-bar" style="width: ${percentage}%;"></div>`;
            });
            statsHTML += `<li><strong>Total Votes: ${totalVotes}</strong></li>`;
            statsHTML += '</ul>';
             // Add CSS for .poll-stats-list and potentially .stat-bar
        }

        // Construct the final modal content
        const infoContentHTML = `
            <h2 style="word-wrap: break-word;">Info: ${pollTitle}</h2>
            <h4>Results</h4>
            ${statsHTML}
            <div class="modal-actions" style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
                 <!-- Delete Button (use caution icon or red color) -->
                 <button id="delete-poll-btn" data-poll-id="${pollId}" data-poll-title="${encodeURIComponent(pollTitle)}" class="ios-button-text" style="color: var(--ios-red);">
                      🗑️ Delete Poll
                 </button>
                 <!-- Close Button -->
                 <button id="close-info-btn" class="ios-button-primary">Close</button>
            </div>
        `;

        // Update the modal content (re-call showModal)
        showModal(infoContentHTML);

        // Add listeners for the new buttons inside the modal
        const closeButton = document.getElementById('close-info-btn');
        if (closeButton) closeButton.addEventListener('click', hideModal);

        const deleteButton = document.getElementById('delete-poll-btn');
        if (deleteButton) {
             deleteButton.addEventListener('click', handleDeletePollClick); // Call separate handler
        } else {
             console.error("Could not find delete button in modal.");
        }

    } catch (error) {
         hideModal(); // Hide the loading modal on error
         alert(`Failed to load poll info: ${error.message}`);
         console.error("Poll info error:", error);
    }
}


async function handleDeletePollClick(event) {
    const pollId = event.currentTarget.dataset.pollId;
    const encodedTitle = event.currentTarget.dataset.pollTitle; // Get encoded title
    const pollTitle = decodeURIComponent(encodedTitle || `Poll ID ${pollId}`); // Decode for display

    console.log(`Delete button clicked for Poll ID: ${pollId}, Title: "${pollTitle}"`);

    // --- Confirmation Dialog ---
    // Use a simple confirm() for now, could be replaced with a custom modal later
    if (!confirm(`Are you sure you want to permanently delete the poll "${pollTitle}"? This cannot be undone.`)) {
        console.log("Poll deletion cancelled by user.");
        return; // User cancelled
    }

    // --- Proceed with Deletion ---
    console.log(`Proceeding with deletion for poll ${pollId}...`);
    // Optionally show a loading state within the modal
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = 'Deleting...';

    try {
        const result = await apiDeletePoll(currentGroupId, pollId); // Assumes apiDeletePoll exists

        if (result && result.success) {
            alert(`Poll "${pollTitle}" deleted successfully.`);
            hideModal(); // Close the info modal
            // Refresh the main poll list to remove the deleted poll
            fetchAndRenderPolls(currentGroupId); // Assumes this function exists
        } else {
            throw new Error(result.message || "Backend reported failure but no specific error.");
        }
    } catch (error) {
        console.error(`Failed to delete poll ${pollId}:`, error);
        alert(`Failed to delete poll: ${error.message}`);
        // Re-enable button if deletion failed
        event.currentTarget.disabled = false;
        event.currentTarget.textContent = '🗑️ Delete Poll';
    }
}

function addPollOptionInput() {
    const container = document.getElementById('poll-options-container');
    const optionCount = container.querySelectorAll('.poll-option-entry').length;
    const newOption = document.createElement('div');
    newOption.classList.add('poll-option-entry');
    newOption.innerHTML = `<input type="text" placeholder="Option ${optionCount + 1}">`;
    container.appendChild(newOption);
}

async function handleSubmitPoll(groupId) {
    const titleInput = document.getElementById('poll-title-input');
    const title = titleInput.value.trim();
    const optionInputs = document.querySelectorAll('#poll-options-container input[type="text"]');

    const options = Array.from(optionInputs)
        .map(input => input.value.trim())
        .filter(optionText => optionText !== ''); // Filter out empty options

    if (!title) {
        alert("Please enter a poll title.");
        titleInput.focus();
        return;
    }
    if (options.length < 2) {
        alert("Please provide at least two non-empty options.");
        return;
    }

    // Disable button, show loading state within modal?
    const submitButton = document.getElementById('submit-create-poll');
    submitButton.disabled = true;
    submitButton.textContent = 'Creating...';

    try {
        await apiCreatePoll(groupId, title, options);
        hideModal();
        alert("Poll created successfully!");
        // Refresh the poll list in the background
        fetchAndRenderPolls(groupId);
    } catch (error) {
        console.error("Failed to create poll:", error);
        alert(`Failed to create poll: ${error.message}`);
        // Re-enable button
        submitButton.disabled = false;
        submitButton.textContent = 'Create';
    }
}