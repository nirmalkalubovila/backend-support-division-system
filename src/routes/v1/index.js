const express = require('express');
const authRoute = require('./auth/auth.route');
const userRoute = require('./user-management/user.route');
const settingRoute = require('./system/setting.route');
const reportRoute = require('./reports/report.route');
const clientRoute = require('./projects/client.route');
const projectRoute = require('./projects/project.route');
const taskRoute = require('./projects/tasks/task.route');
const issueRoute = require('./issues/issue.route');
const systemRoute = require('./system/branding.route');

const router = express.Router();

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/users',
    route: userRoute,
  },
  {
    path: '/system',
    route: settingRoute,
  },
  {
    path: '/reports',
    route: reportRoute,
  },
  {
    path: '/clients',
    route: clientRoute,
  },
  {
    path: '/projects',
    route: projectRoute,
  },
  {
    path: '/issues',
    route: issueRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

module.exports = router;
