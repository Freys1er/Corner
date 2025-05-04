// js/activities.js

let currentActivityDetail = null; // Store details of the currently viewed activity

async function loadActivitiesTab(groupId, containerElement) {
    // No changes needed in this function itself
    try {
        const response = await fetch('pages/activities-tab.html');
        if (!response.ok) throw new Error('Failed to load activities tab HTML');
        const activitiesHTML = await response.text();
        containerElement.innerHTML = activitiesHTML;

        // Load existing activities
        await fetchAndRenderActivities(groupId);

    } catch (error) {
        console.error("Error loading activities tab:", error);
        containerElement.innerHTML = `<p class="error">Failed to load activities: ${error.message}</p>`;
    } finally {
        hideLoading();
    }
}

async function fetchAndRenderActivities(groupId) {
    // No changes needed in this function itself
    const activityListContainer = document.getElementById('activity-list-container');
    activityListContainer.innerHTML = '<div class="loading-spinner small">Loading activities...</div>';

    try {
        const activities = await apiGetActivities(groupId); // API call is fine

        if (!activities || activities.length === 0) {
            activityListContainer.innerHTML = '<p style="text-align: center; color: var(--ios-dark-gray); padding: 20px;">No activities planned yet.</p>';
            return;
        }

        let activitiesHTML = '<ul class="ios-list activity-list">';
        activities.forEach(activity => {
            activitiesHTML += `
                <li class="ios-list-item activity-item" data-activity-id="${activity.id}">
                    <div class="content">
                        <div class="title">${activity.title}</div>
                    </div>
                    <div class="accessory disclosure"></div>
                </li>
            `;
        });
        activitiesHTML += '</ul>';
        activityListContainer.innerHTML = activitiesHTML;

        // Add event listeners
        document.querySelectorAll('.activity-item').forEach(item => {
            item.addEventListener('click', () => showActivityDetailView(groupId, item.dataset.activityId));
        });

    } catch (error) {
        console.error("Failed to fetch activities:", error);
        activityListContainer.innerHTML = `<p class="error">Failed to load activities: ${error.message}</p>`;
    }
}


async function showActivityDetailView(groupId, activityId) {
    // No changes needed in this function itself
    const detailContainer = document.getElementById('activity-detail-container');
    detailContainer.innerHTML = '<div class="loading-spinner small">Loading details...</div>';
    detailContainer.classList.remove('hidden');

    try {
        currentActivityDetail = deepCopy(await apiGetActivityDetail(groupId, activityId)); // API call is fine
        renderActivityDetail(currentActivityDetail);
    } catch (error) {
        console.error("Failed to load activity detail:", error);
        detailContainer.innerHTML = `<p class="error">Failed to load details: ${error.message}</p>`;
        currentActivityDetail = null;
    }

    //Hide the FAB button when the detail view is open
    if (fabAddButton) {
        fabAddButton.style.display = 'none'; // Hide FAB button
    }
}


function renderActivityDetail(activity) {
    const detailContainer = document.getElementById('activity-detail-container');
    if (!activity || !activity.id) { // Check for valid activity object
        detailContainer.innerHTML = '<p class="error">Could not load activity data.</p>';
        return;
    }
    const teamCount = activity.teamCount || 1; // Get team count

    // Prepare HTML, including the new delete button
    detailContainer.innerHTML = `
        <div class="activity-detail-view">
            <h3>${activity.title || 'Untitled Activity'}</h3>

            ${activity.description ? `<div class="detail-section"><h4>Description</h4><div class="editable-field" id="activity-description" data-field="description" contenteditable="false">${activity.description}</div></div>` : `<div class="detail-section"><h4>Description</h4><div class="editable-field" id="activity-description" data-field="description" contenteditable="false">Not specified</div></div>`}
            <div class="detail-section"><h4>Materials</h4><div class="editable-field" id="activity-materials" data-field="materials" contenteditable="false">${activity.materials || 'Not specified'}</div></div>
            <div class="detail-section"><h4>Time</h4><div class="editable-field" id="activity-time" data-field="time" contenteditable="false">${activity.time || 'Not specified'}</div></div>

            <div class="detail-section teams-section">
                <h4>Teams</h4>
                <div class="controls">
                    <span>Teams: ${teamCount}</span>
                    <button id="remove-team-btn" ${teamCount <= 1 ? 'disabled' : ''}>-</button>
                    <button id="add-team-btn" ${teamCount >= 5 ? 'disabled' : ''}>+</button>
                </div>
                <!-- Add data-team-count attribute for CSS styling -->
                <div class="teams-circle-container" id="teams-display" data-team-count="${teamCount}">
                    <!-- Teams segments will be rendered here by renderTeams -->
                </div>
                <div class="unassigned-members" id="unassigned-members">
                    <!-- Unassigned members rendered here -->
                </div>
            </div>

             <!-- Action Buttons at the Bottom -->
             <div class="activity-detail-actions" style="display: flex; justify-content: space-between; margin-top: 20px; padding-top: 10px; border-top: 1px solid var(--separator-color);">
                 <button id="delete-activity-btn" data-activity-id="${activity.id}" data-activity-title="${encodeURIComponent(activity.title || '')}" class="ios-button-text" style="color: var(--ios-red);">
                      Delete Activity
                 </button>
                 <button id="close-detail-view-btn" class="ios-button-text" style="color: var(--ios-blue);">Close Details</button>
             </div>
        </div>
    `;

    console.log(activity); // Debugging output

    renderTeams(activity.teams, activity.members, teamCount); // Pass teamCount to renderTeams
    addActivityDetailEventListeners(activity.id);
}

function addActivityDetailEventListeners(activityId) {
    // Close button
    document.getElementById('close-detail-view-btn')?.addEventListener('click', () => {
        document.getElementById('activity-detail-container').classList.add('hidden');
        currentActivityDetail = null;
        //Show the FAB button again when closing the detail view
        if (fabAddButton) {
            fabAddButton.style.display = 'block'; // Show FAB button again
        }
    });

    // Delete button
    document.getElementById('delete-activity-btn')?.addEventListener('click', handleDeleteActivityClick); // New handler

    // Editable Fields
    document.querySelectorAll('.editable-field').forEach(field => {
        field.addEventListener('click', () => { if (field.contentEditable !== 'true') makeFieldEditable(field); });
        field.addEventListener('blur', (event) => { if (field.dataset.editing === 'true') saveFieldEdit(event.target, activityId); });
        field.addEventListener('keypress', (event) => { if (event.key === 'Enter' && field.tagName !== 'TEXTAREA') { event.preventDefault(); field.blur(); } });
    });

    // Team controls (+/- buttons)
    document.getElementById('add-team-btn')?.addEventListener('click', () => handleUpdateTeams(activityId, '+1'));
    document.getElementById('remove-team-btn')?.addEventListener('click', () => handleUpdateTeams(activityId, '-1'));

    // Drag and Drop setup
    setupDragAndDrop(activityId);
}



function makeFieldEditable(fieldElement) {
    // No changes needed in this function itself
    fieldElement.contentEditable = 'true';
    fieldElement.classList.add('editing');
    fieldElement.dataset.originalValue = fieldElement.textContent;
    fieldElement.dataset.editing = 'true';
    fieldElement.focus();
}

// **** MODIFIED FUNCTION ****
async function saveFieldEdit(fieldElement, activityId) {
    // Restore non-editing state
    fieldElement.contentEditable = 'false';
    fieldElement.classList.remove('editing');
    fieldElement.dataset.editing = 'false';

    const fieldName = fieldElement.dataset.field;
    const newValue = fieldElement.textContent.trim();
    const originalValue = fieldElement.dataset.originalValue;

    if (newValue === originalValue) return; // No change

    fieldElement.style.opacity = '0.5'; // Indicate saving

    try {
        await apiUpdateActivityDetail(currentGroupId, activityId, fieldName, newValue); // API call is fine

        // Update local data cache if successful
        if (currentActivityDetail) {
            currentActivityDetail[fieldName] = newValue;
            fieldElement.dataset.originalValue = newValue;
        }

        // **** CHANGE: Use currentUser for system message ****
        if (currentUser && currentActivityDetail) {
            // Use currentActivityDetail.title which reflects the latest state (important if title was edited)
            const displayTitle = currentActivityDetail.title || 'this activity';
            postSystemMessageToChat(`${currentUser.name.toUpperCase()} UPDATED ${fieldName.toUpperCase()} FOR ACTIVITY '${displayTitle.toUpperCase()}'`);
        } else {
            console.warn("Cannot post system message: currentUser or currentActivityDetail missing.");
        }

    } catch (error) {
        console.error(`Failed to update ${fieldName}:`, error);
        alert(`Failed to save ${fieldName}. Reverting changes.`);
        fieldElement.textContent = originalValue; // Revert UI on error
    } finally {
        fieldElement.style.opacity = '1';
    }
}

// **** MODIFIED FUNCTION ****
async function handleUpdateTeams(activityId, change) {
    const addButton = document.getElementById('add-team-btn');
    const removeButton = document.getElementById('remove-team-btn');
    if (addButton) addButton.disabled = true;
    if (removeButton) removeButton.disabled = true;

    try {
        const updatedActivity = await apiUpdateTeams(currentGroupId, activityId, change); // API call fine

        if (updatedActivity) {
            currentActivityDetail = deepCopy(updatedActivity); // Update local cache
            renderActivityDetail(currentActivityDetail); // Re-render the entire detail section

            // **** CHANGE: Use currentUser for system message ****
            if (currentUser && currentActivityDetail) {
                const displayTitle = currentActivityDetail.title || 'this activity';
                postSystemMessageToChat(`${currentUser.name.toUpperCase()} ADJUSTED TEAMS FOR ACTIVITY '${displayTitle.toUpperCase()}'`);
            } else {
                console.warn("Cannot post system message: currentUser or currentActivityDetail missing.");
            }

        } else {
            throw new Error("API did not return updated activity details.");
        }
    } catch (error) {
        console.error("Failed to update teams:", error);
        alert("Failed to update teams.");
        if (currentActivityDetail) renderActivityDetail(currentActivityDetail); // Re-render to restore state
    }
    // Buttons will be re-rendered/re-enabled by renderActivityDetail
}

// --- Team Rendering & Drag/Drop ---
function renderTeams(teamsData, membersData, teamCount) {
    console.log(teamsData, membersData, teamCount); // Debugging output
    const teamsDisplay = document.getElementById('teams-display'); // The circle container
    const unassignedContainer = document.getElementById('unassigned-members');
    if (!teamsDisplay || !unassignedContainer) return; // Exit if containers not found

    teamsDisplay.innerHTML = ''; // Clear previous segments
    unassignedContainer.innerHTML = '<h4>Unassigned</h4>'; // Reset unassigned

    // --- Render Numbered Team Segments ---
    // This uses CSS variables and potentially clip-path based on data-team-count attribute set on parent
    for (let i = 1; i <= teamCount; i++) {
        const teamId = `team${i}`;
        const segment = document.createElement('div');
        segment.className = `team-segment team-segment-${i}`; // Add specific class for styling
        segment.dataset.teamId = teamId;
        // Calculate rotation and other styles based on index/count (more complex, often done in CSS)
        // Example: Inline style for basic rotation (adjustments needed for perfect fit)
        const angle = 360 / teamCount;
        segment.style.transform = `rotate(${(i - 1) * angle}deg) translateY(-10% 10%)`;

        segment.innerHTML = `<h5>${teamId}</h5><div class="team-members"></div>`;
        const membersContainer = segment.querySelector('.team-members');
        (teamsData[teamId] || []).forEach(memberEmail => {
            const member = membersData[memberEmail];
            if (member) {
                const pfp = createMemberPfpElement(memberEmail, member.pfp, member.name);
                membersContainer.appendChild(pfp);
            }
        });
        teamsDisplay.appendChild(segment);
    }

    // --- Render Unassigned Members ---
    (teamsData['unassigned'] || []).forEach(memberEmail => {
        const member = membersData[memberEmail];
        if (member) {
            const pfp = createMemberPfpElement(memberEmail, member.pfp, member.name);
            unassignedContainer.appendChild(pfp);
        }
    });

    // Add drop zone listeners dynamically after rendering segments
    setupDragAndDrop(currentActivityDetail?.id); // Re-run DND setup after rendering new targets
}


function createMemberPfpElement(memberEmail, pfpUrl, memberName) {
    // No changes needed - uses passed data
    const img = document.createElement('img');
    img.src = pfpUrl || 'assets/img/placeholder-pfp.svg';
    img.alt = memberName;
    img.title = memberName;
    img.classList.add('team-member-pfp');
    img.dataset.memberId = memberEmail; // Use email as the draggable ID
    img.draggable = true;
    return img;
}

// **** MODIFIED FUNCTION (Drop Handler Part) ****
function setupDragAndDrop(activityId) {
    // Drag start/end logic is fine
    const draggables = document.querySelectorAll('.team-member-pfp');
    draggables.forEach(pfp => {
        pfp.addEventListener('dragstart', (e) => {
            // Use email (stored in dataset.memberId) as the data transferred
            e.dataTransfer.setData('text/plain', pfp.dataset.memberId);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => pfp.style.opacity = '0.5', 0);
        });
        pfp.addEventListener('dragend', (e) => {
            pfp.style.opacity = '1';
            document.querySelectorAll('.drag-over').forEach(zone => zone.classList.remove('drag-over'));
        });
    });

    // Drag over/leave logic is fine
    const dropzones = document.querySelectorAll('.team-segment, #unassigned-members');
    dropzones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', (e) => { zone.classList.remove('drag-over'); });

        // **** Drop Handler Modification ****
        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');

            const memberId = e.dataTransfer.getData('text/plain'); // This is the member's email
            // Determine target team ID (handle unassigned container specifically)
            const targetTeamId = zone.id === 'unassigned-members' ? 'unassigned' : zone.dataset.teamId;

            const draggedElement = document.querySelector(`.team-member-pfp[data-member-id="${memberId}"]`);
            const sourceZone = draggedElement ? draggedElement.closest('.team-segment, #unassigned-members') : null;
            const sourceTeamId = !sourceZone ? 'unknown' : (sourceZone.id === 'unassigned-members' ? 'unassigned' : sourceZone.dataset.teamId);

            console.log(`Drop: Member ${memberId} from ${sourceTeamId} to ${targetTeamId}`);

            if (!memberId || !targetTeamId || !draggedElement || sourceTeamId === 'unknown') {
                console.error("Drop failed: Missing data or dragged element not found.");
                return;
            }

            if (sourceTeamId === targetTeamId) {
                console.log("Drop cancelled: Source and target teams are the same.");
                return; // No change needed
            }

            draggedElement.style.display = 'none'; // Optimistic UI hide

            try {
                const updatedActivity = await apiAssignTeamMember(currentGroupId, activityId, memberId, targetTeamId); // API call is fine

                if (updatedActivity) {
                    currentActivityDetail = deepCopy(updatedActivity); // Update cache
                    renderActivityDetail(currentActivityDetail); // Re-render

                    // **** CHANGE: Use currentUser and fetched member details for system message ****
                    if (currentUser && currentActivityDetail?.members && currentActivityDetail.members[memberId]) {
                        const movedMemberName = currentActivityDetail.members[memberId].name || memberId;
                        const displayTitle = currentActivityDetail.title || 'this activity';
                        postSystemMessageToChat(`${currentUser.name.toUpperCase()} MOVED ${movedMemberName.toUpperCase()} TO ${targetTeamId.toUpperCase()} FOR ACTIVITY '${displayTitle.toUpperCase()}'`);
                    } else {
                        console.warn("Cannot post system message: Missing data for moved member or current user.");
                        // Post generic message maybe?
                        postSystemMessageToChat(`TEAMS UPDATED FOR ACTIVITY '${(currentActivityDetail?.title || 'this activity').toUpperCase()}'`);
                    }

                } else {
                    throw new Error("API did not return updated activity details after move.");
                }

            } catch (error) {
                console.error("Failed to assign team member:", error);
                alert("Failed to move member.");
                // Revert UI: Easiest is often to just re-render from the *old* data
                if (currentActivityDetail) {
                    renderActivityDetail(currentActivityDetail);
                } else {
                    // Fallback if we don't have old data - just show the element again
                    draggedElement.style.display = '';
                }
            }
        });
    });
}

function showCreateActivityModal() {
    console.log("showCreateActivityModal called");
    if (!currentGroupId) {
        console.error("Cannot create activity: currentGroupId is not set.");
        return;
    }

    // Simple modal structure for now
    const modalHTML = `
        <h2>New Activity</h2>
        <div class="form-group">
            <label for="activity-title-input">Activity Title:</label>
            <input type="text" id="activity-title-input" placeholder="e.g., Weekend Hike, Project Brainstorm">
        </div>
        <div class="form-group">
            <label for="activity-desc-input">Description (Optional):</label>
            <textarea id="activity-desc-input" rows="3" placeholder="Details about the activity..."></textarea>
        </div>
        <!-- Add inputs for materials, time if desired -->
        <div class="modal-actions">
            <button id="cancel-create-activity" class="ios-button-text">Cancel</button>
            <button id="submit-create-activity" class="ios-button-primary">Create Activity</button>
        </div>
        <style> /* Simple styles needed for form elements inside modal */
           .form-group { margin-bottom: 15px; }
           .form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
           .form-group input[type="text"], .form-group textarea { width: calc(100% - 22px); padding: 10px; border: 1px solid var(--ios-mid-gray); border-radius: 6px; font-size: 16px; }
           .form-group textarea { resize: vertical; }
       </style>
    `;

    showModal(modalHTML); // Assumes showModal is defined globally or imported

    // Add listeners for the modal buttons
    document.getElementById('cancel-create-activity')?.addEventListener('click', hideModal);
    document.getElementById('submit-create-activity')?.addEventListener('click', handleCreateActivitySubmit);
}


async function handleCreateActivitySubmit() {
    const titleInput = document.getElementById('activity-title-input');
    const descInput = document.getElementById('activity-desc-input');

    const title = titleInput?.value.trim();
    const description = descInput?.value.trim() || ''; // Optional description

    if (!title) {
        alert("Please enter an activity title.");
        titleInput?.focus();
        return;
    }

    const submitButton = document.getElementById('submit-create-activity');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Creating...';
    }
    showLoading("Creating activity..."); // Use main loading indicator

    try {
        // Call the new API function (to be created in api.js)
        const newActivity = await apiCreateActivity(currentGroupId, title, description);

        if (newActivity && newActivity.id) {
            hideModal();
            alert(`Activity "${title}" created successfully!`);
            // Refresh the activities list
            fetchAndRenderActivities(currentGroupId);
            // Optional: Add a system message to chat?
            // if (currentUser) { postSystemMessageToChat(`${currentUser.name.toUpperCase()} CREATED ACTIVITY '${title.toUpperCase()}'`); }
        } else {
            throw new Error(newActivity.message || "Backend did not return new activity details.");
        }

    } catch (error) {
        console.error("Failed to create activity:", error);
        alert(`Failed to create activity: ${error.message}`);
        if (submitButton) { // Re-enable button on error
            submitButton.disabled = false;
            submitButton.textContent = 'Create Activity';
        }
    } finally {
        hideLoading();
    }
}

async function handleDeleteActivityClick(event) {
    const button = event.currentTarget;
    const activityId = button.dataset.activityId;
    const encodedTitle = button.dataset.activityTitle;
    const activityTitle = decodeURIComponent(encodedTitle || `Activity ID ${activityId}`);

    if (!activityId) {
        console.error("Delete button clicked, but activityId not found in dataset.");
        return;
    }

    // Confirmation dialog
    if (!confirm(`Are you sure you want to permanently delete the activity "${activityTitle}"? This will remove all its details and team assignments.`)) {
        console.log("Activity deletion cancelled by user.");
        return; // User cancelled
    }

    if (fabAddButton) {
        fabAddButton.style.display = 'block'; // Show FAB button again
    }
    console.log(`Proceeding with deletion for activity ${activityId}...`);
    showLoading("Deleting activity..."); // Show loading indicator
    button.disabled = true; // Disable button while processing

    try {
        const result = await apiDeleteActivity(currentGroupId, activityId); // Call API

        if (result && result.success) {
            alert(`Activity "${activityTitle}" deleted successfully.`);
            // Hide the detail view and refresh the main activity list
            document.getElementById('activity-detail-container')?.classList.add('hidden');
            currentActivityDetail = null; // Clear cached detail
            fetchAndRenderActivities(currentGroupId); // Refresh list
        } else {
            throw new Error(result.message || "Backend reported failure to delete.");
        }
    } catch (error) {
        console.error(`Failed to delete activity ${activityId}:`, error);
        alert(`Failed to delete activity: ${error.message}`);
        button.disabled = false; // Re-enable button on error
    } finally {
        hideLoading(); // Hide loading indicator
    }
}