import express from 'express';
import paths from '../../utils/path.js';
export default ({}) => {
  const Router = express.Router();
  Router.get('/component.js', (req, res) => {
    res.sendFile(paths.html.component);
  });
  return Router;
};