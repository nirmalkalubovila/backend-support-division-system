const express = require('express');
const auth = require('../../../../middlewares/auth');
const { ChangeRequest } = require('../../../../models');

const router = express.Router();

router.get('/', auth('projects.cr.read'), async (req, res) => {
  try {
    const filter = { deletedAt: null };
    if (req.query.assignee) {
      filter.$or = [
        { assignedDevelopers: req.query.assignee },
        { assignedProjectManager: req.query.assignee }
      ];
    }
    const crs = await ChangeRequest.find(filter)
      .populate('assignedProjectManager', 'name email role avatar')
      .populate('assignedDevelopers', 'name email role avatar')
      .populate('createdBy', 'name email role avatar')
      .populate('project', 'name')
      .sort({ order: 1, createdAt: -1 });
    res.send(crs);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

module.exports = router;
