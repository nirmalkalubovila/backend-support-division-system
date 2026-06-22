/**
 * task.workflow.js
 * State machine for task status transitions.
 * Hard blocks: invalid path + role-restricted transitions.
 * Field requirements are advisory only (enforced in the UI as hints).
 */

const TRANSITIONS = {
  'To Do':       ['In Progress'],
  'In Progress': ['Review', 'To Do'],
  'Review':      ['In Progress', 'Done'],
  'Done':        ['In Progress'],
};

// Only these two transitions have role restrictions — everything else is open.
const ROLE_GATES = {
  'Review->Done':      ['super_admin', 'manager', 'senior_engineer', 'engineer'],
  'Done->In Progress': ['super_admin', 'manager', 'senior_engineer'],
};

/**
 * @param {{ fromStatus: string, toStatus: string, userRole: string, task: object }} params
 * @returns {{ valid: boolean, reason: string|null }}
 */
const validateTransition = ({ fromStatus, toStatus, userRole }) => {
  if (fromStatus === toStatus) return { valid: true, reason: null };

  const allowed = TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    return {
      valid: false,
      reason: `Cannot move from "${fromStatus}" to "${toStatus}". Allowed: ${allowed.join(', ') || 'none'}.`,
    };
  }

  const key = `${fromStatus}->${toStatus}`;
  const restrictedRoles = ROLE_GATES[key];
  if (restrictedRoles && !restrictedRoles.includes(userRole)) {
    return {
      valid: false,
      reason: `Your role (${userRole}) cannot move tasks from "${fromStatus}" to "${toStatus}". Requires: ${restrictedRoles.join(', ')}.`,
    };
  }

  return { valid: true, reason: null };
};

const getRulesForClient = () => ({ TRANSITIONS, ROLE_GATES });

module.exports = { validateTransition, getRulesForClient, TRANSITIONS, ROLE_GATES };
