import express from 'express';
import paths from '../../utils/path.js';
export default ({}) => {
  const Router = express.Router();
  Router.get('/admin_dashboard.index.js', (req, res) => {
    res.sendFile(paths.html.admin_dashboard_index);
  });
  return Router;
};