import express from 'express';
import paths from '../../utils/path.js';
export default ({}) => {
  const Router = express.Router();
  Router.get('/privacy', (req, res) => {
    res.sendFile(paths.public.privacy);
  });
  return Router;
};