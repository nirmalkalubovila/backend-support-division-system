const express = require('express');
const auth = require('../../../../middlewares/auth');
const { Task } = require('../../../../models');

const router = express.Router();

router.get('/', auth('projects.task.read'), async (req, res) => {
  try {
    const filter = { deletedAt: null };
    if (req.query.assignee) {
      filter.assignees = req.query.assignee;
    }
    const tasks = await Task.find(filter)
      .populate('assignees', 'name email role avatar')
      .populate('parent', 'name')
      .populate('project', 'name')
      .populate('cr', 'crNumber title _id')
      .sort({ order: 1, createdAt: -1 });
    res.send(tasks);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

module.exports = router;
