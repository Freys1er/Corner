async function loadVotingTab(groupId, containerElement) {
    try {
        const response = await fetch('pages/voting-tab.html');
        if (!response.ok) throw new Error('Failed to load voting tab HTML');
        const votingHTML = await response.text();
        containerElement.innerHTML = votingHTML;

        // Add event listener for the FAB (+) button
        document.getElementById('fab-add-poll-btn').addEventListener('click', () => showCreatePollModal(groupId));

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

async function handleShowPollInfo(event) {
    const pollId = event.currentTarget.dataset.pollId;
    alert(`Info button clicked for poll ${pollId}. Stats/comments view TBD.`);
    // Implementation:
    // 1. Show loading state in a modal
    // 2. Call `apiGetPollInfo(currentGroupId, pollId)`
    // 3. Render the stats (e.g., bars or percentages) and comments in the modal
}

function showCreatePollModal(groupId) {
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