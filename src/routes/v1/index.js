const express = require('express');
const authRoute = require('./auth/auth.route');
const userRoute = require('./user-management/user.route');
const settingRoute = require('./system/setting.route');
const reportRoute = require('./reports/report.route');
const projectPerformanceRoute = require('./reports/project-performance.route');
const userPerformanceRoute = require('./reports/user-performance.route');
const clientRoute = require('./projects/client.route');
const projectRoute = require('./projects/project.route');
const taskRoute = require('./projects/tasks/task.route');
const crRoute = require('./projects/crs/cr.route');
const issueRoute = require('./issues/issue.route');
const timeLogRoute = require('./time-tracking/time-log.route');
const notificationRoute = require('./system/notification.route');
const { router: paymentRoute, globalRouter: financeRoute } = require('./projects/payments/payment.route');

const router = express.Router();

const defaultRoutes = [
  { path: '/auth',     route: authRoute },
  { path: '/users',    route: userRoute },
  { path: '/system',   route: settingRoute },
  { path: '/reports/performance', route: projectPerformanceRoute },
  { path: '/reports/user-performance', route: userPerformanceRoute },
  { path: '/reports',  route: reportRoute },
  { path: '/clients',  route: clientRoute },
  { path: '/projects', route: projectRoute },

  { path: '/issues',   route: issueRoute },
  { path: '/time-logs', route: timeLogRoute },
  { path: '/notifications', route: notificationRoute },
  { path: '/finance',  route: financeRoute },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

// Nested project sub-routes (mergeParams is set on the child routers)
router.use('/projects/:projectId/tasks', taskRoute);
router.use('/projects/:projectId/crs', crRoute);
router.use('/projects/:projectId/payments', paymentRoute);

module.exports = router;
