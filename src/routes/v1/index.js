const express = require('express');
const authRoute = require('./auth/auth.route');
const userRoute = require('./user-management/user.route');
const clientRoute = require('./projects/client.route');
const projectRoute = require('./projects/project.route');
const issueRoute = require('./issues/issue.route');

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
