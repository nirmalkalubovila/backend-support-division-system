const express = require('express');
const authRoute = require('./auth/auth.route');
const userRoute = require('./user-management/user.route');
const settingRoute = require('./system/setting.route');
const reportRoute = require('./reports/report.route');

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
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

module.exports = router;
