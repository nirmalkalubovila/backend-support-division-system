const express = require('express');
const authRoute = require('./auth/auth.route');
const userRoute = require('./user-management/user.route');

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
    path: '/projects',
    route: require('./project.route'),
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

module.exports = router;
